// ============================================================
// Parser de pedidos en lenguaje natural (reglas, sin LLM).
// Extrae ítems, cantidades y modificadores/extras a partir de
// un catálogo de productos y una lista de modificadores.
//
// Ejemplo:
//   "Quiero 2 hamburguesas con extra queso y 1 Coca-Cola cero"
//   -> [
//        { producto: "hamburguesa", cantidad: 2, extras: ["extra queso"] },
//        { producto: "gaseosa",     cantidad: 1, extras: ["cero"] }
//      ]
//
// Nota: para frases muy libres, lo robusto en producción es usar un
// LLM (Claude) para el parsing. Esto cubre el caso estructurado/MVP.
// ============================================================

export interface ProductoCatalogo {
  nombre: string;
  aliases?: string[];
  precio?: number;
}

export interface Modificador {
  nombre: string;
  aliases?: string[];
}

export interface ItemPedido {
  producto: string;
  cantidad: number;
  extras: string[];
}

// Modificadores por defecto si el tenant no define los suyos.
export const MODIFICADORES_DEFAULT: Modificador[] = [
  { nombre: "extra queso", aliases: ["queso extra", "con extra queso", "doble queso"] },
  { nombre: "cero", aliases: ["zero", "sin azucar", "light", "dietetica"] },
  { nombre: "sin cebolla", aliases: ["no cebolla"] },
  { nombre: "sin tomate", aliases: ["no tomate"] },
  { nombre: "picante", aliases: ["con picante", "extra picante"] },
];

const NUMEROS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, media: 1, medio: 1,
};

/** Minúsculas, sin acentos, sin signos; colapsa espacios. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Phrase {
  tokens: string[];
  canonical: string;
  type: "product" | "modifier";
}

/** Genera una variante en plural simple del último token de la frase. */
function pluralizar(tokens: string[]): string[] {
  if (tokens.length === 0) return tokens;
  const last = tokens[tokens.length - 1];
  const plural = /[aeiou]$/.test(last) ? last + "s" : last + "es";
  return [...tokens.slice(0, -1), plural];
}

function buildPhrases(
  catalog: ProductoCatalogo[],
  modifiers: Modificador[],
): Phrase[] {
  const phrases: Phrase[] = [];

  const add = (raw: string, canonical: string, type: Phrase["type"]) => {
    const tokens = normalize(raw).split(" ").filter(Boolean);
    if (tokens.length === 0) return;
    phrases.push({ tokens, canonical, type });
    // variante plural automática (hamburguesa -> hamburguesas)
    const pl = pluralizar(tokens);
    if (pl.join(" ") !== tokens.join(" ")) {
      phrases.push({ tokens: pl, canonical, type });
    }
  };

  for (const p of catalog) {
    add(p.nombre, p.nombre, "product");
    for (const a of p.aliases ?? []) add(a, p.nombre, "product");
  }
  for (const m of modifiers) {
    add(m.nombre, m.nombre, "modifier");
    for (const a of m.aliases ?? []) add(a, m.nombre, "modifier");
  }

  // Más tokens primero: matching greedy de la frase más larga.
  phrases.sort((a, b) => b.tokens.length - a.tokens.length);
  return phrases;
}

function matchPhraseAt(
  tokens: string[],
  i: number,
  phrases: Phrase[],
): Phrase | null {
  for (const ph of phrases) {
    if (i + ph.tokens.length > tokens.length) continue;
    let ok = true;
    for (let k = 0; k < ph.tokens.length; k++) {
      if (tokens[i + k] !== ph.tokens[k]) {
        ok = false;
        break;
      }
    }
    if (ok) return ph;
  }
  return null;
}

/**
 * Extrae los ítems del pedido a partir del texto libre.
 * @param texto   mensaje del cliente
 * @param catalog productos conocidos del tenant
 * @param modifiers modificadores conocidos (usa MODIFICADORES_DEFAULT si se omite)
 */
export function parsePedido(
  texto: string,
  catalog: ProductoCatalogo[],
  modifiers: Modificador[] = MODIFICADORES_DEFAULT,
): ItemPedido[] {
  const phrases = buildPhrases(catalog, modifiers);
  const tokens = normalize(texto).split(" ").filter(Boolean);

  const items: ItemPedido[] = [];
  let current: ItemPedido | null = null;
  let pendingQty: number | null = null;

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];

    // Cantidad numérica (dígitos)
    if (/^\d+$/.test(tok)) {
      pendingQty = parseInt(tok, 10);
      i++;
      continue;
    }
    // Cantidad en palabra (dos, tres, ...)
    if (tok in NUMEROS) {
      pendingQty = NUMEROS[tok];
      i++;
      continue;
    }

    const m = matchPhraseAt(tokens, i, phrases);
    if (m) {
      if (m.type === "product") {
        current = { producto: m.canonical, cantidad: pendingQty ?? 1, extras: [] };
        items.push(current);
        pendingQty = null;
      } else if (current) {
        // modificador -> se asocia al ítem actual
        if (!current.extras.includes(m.canonical)) current.extras.push(m.canonical);
      }
      i += m.tokens.length;
      continue;
    }

    // conector / palabra desconocida -> ignorar
    i++;
  }

  return items;
}

/**
 * Calcula detalles enriquecidos (precio_unitario, subtotal) y total
 * a partir de los ítems parseados y el catálogo con precios.
 */
export function calcularDetallesYTotal(
  items: ItemPedido[],
  catalog: ProductoCatalogo[],
): { detalles: Array<ItemPedido & { precio_unitario: number; subtotal: number }>; total: number } {
  const byName = new Map(catalog.map((p) => [normalize(p.nombre), p]));
  let total = 0;
  const detalles = items.map((it) => {
    const prod = byName.get(normalize(it.producto));
    const precio = prod?.precio ?? 0;
    const subtotal = precio * it.cantidad;
    total += subtotal;
    return { ...it, precio_unitario: precio, subtotal };
  });
  return { detalles, total };
}

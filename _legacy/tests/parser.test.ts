// Tests del parser de pedidos. Ejecutar con:  deno test tests/parser.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calcularDetallesYTotal,
  parsePedido,
  type ProductoCatalogo,
} from "../supabase/functions/whatsapp-webhook/parser.ts";

const CATALOGO: ProductoCatalogo[] = [
  { nombre: "hamburguesa", precio: 18000, aliases: ["burger", "burguer"] },
  { nombre: "pizza", precio: 25000, aliases: [] },
  { nombre: "gaseosa", precio: 5000, aliases: ["coca cola", "coca-cola", "coca", "soda"] },
];

Deno.test("pedido del enunciado: 2 hamburguesas con extra queso y 1 coca-cola cero", () => {
  const items = parsePedido(
    "Quiero 2 hamburguesas con extra queso y 1 Coca-Cola cero",
    CATALOGO,
  );
  assertEquals(items, [
    { producto: "hamburguesa", cantidad: 2, extras: ["extra queso"] },
    { producto: "gaseosa", cantidad: 1, extras: ["cero"] },
  ]);
});

Deno.test("cantidades en palabras", () => {
  const items = parsePedido("dame tres pizzas y una hamburguesa", CATALOGO);
  assertEquals(items, [
    { producto: "pizza", cantidad: 3, extras: [] },
    { producto: "hamburguesa", cantidad: 1, extras: [] },
  ]);
});

Deno.test("sin cantidad explícita -> 1", () => {
  const items = parsePedido("una pizza por favor", CATALOGO);
  assertEquals(items, [{ producto: "pizza", cantidad: 1, extras: [] }]);
});

Deno.test("alias de producto (coca -> gaseosa)", () => {
  const items = parsePedido("2 cocas", CATALOGO);
  assertEquals(items, [{ producto: "gaseosa", cantidad: 2, extras: [] }]);
});

Deno.test("modificador sin cebolla", () => {
  const items = parsePedido("1 hamburguesa sin cebolla", CATALOGO);
  assertEquals(items, [{ producto: "hamburguesa", cantidad: 1, extras: ["sin cebolla"] }]);
});

Deno.test("mensaje sin productos -> vacío", () => {
  const items = parsePedido("hola buenos dias", CATALOGO);
  assertEquals(items, []);
});

Deno.test("cálculo de total", () => {
  const items = parsePedido("2 hamburguesas y 1 coca cola", CATALOGO);
  const { total, detalles } = calcularDetallesYTotal(items, CATALOGO);
  assertEquals(total, 41000); // 2*18000 + 1*5000
  assertEquals(detalles[0].subtotal, 36000);
  assertEquals(detalles[1].subtotal, 5000);
});

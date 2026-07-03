# Módulo: Asistente de WhatsApp

Recepción automática de pedidos vía WhatsApp Cloud API de Meta.

## ¿Dónde está el código?

La lógica desplegable vive como Edge Function de Supabase (Deno), porque ahí
es donde se ejecuta el webhook:

```
supabase/functions/whatsapp-webhook/
├── index.ts     # Handler del webhook (GET verificación, POST mensajes)
├── parser.ts    # Parser de pedidos en lenguaje natural (reglas)
└── db.ts        # Acceso a datos (tenant, catálogo, cliente, pedido)
```

Esta carpeta (`whatsapp_assistant/`) contiene la documentación del módulo.
La guía de configuración de Meta está en [`docs/01-meta-cloud-api-setup.md`](../docs/01-meta-cloud-api-setup.md).

## Flujo

```
Cliente (WhatsApp)
      │  "Quiero 2 hamburguesas con extra queso y 1 Coca-Cola cero"
      ▼
Meta Cloud API ──POST──► Edge Function whatsapp-webhook
                              │ 1. verifica firma
                              │ 2. phone_number_id ─► tenant
                              │ 3. parsePedido(texto, catálogo)
                              │ 4. upsert cliente
                              │ 5. insert pedido (detalles_json + total)
                              ▼
                         Supabase (Postgres)
```

## Comandos

```bash
# Inicializar Supabase (una sola vez, desde la raíz del repo)
supabase init

# Levantar Supabase localmente (Docker)
supabase start

# Aplicar migraciones + seed
supabase db reset

# Probar el parser (Deno)
deno test tests/parser.test.ts

# Servir la función localmente
supabase functions serve whatsapp-webhook --no-verify-jwt --env-file supabase/functions/.env

# Desplegar (pública para que Meta pueda llamarla)
supabase functions deploy whatsapp-webhook --no-verify-jwt

# Configurar secrets en producción
supabase secrets set WHATSAPP_VERIFY_TOKEN=xxx META_APP_SECRET=xxx WHATSAPP_ACCESS_TOKEN=xxx
```

## Limitaciones actuales (MVP)

- El parser es por reglas: reconoce productos del catálogo + modificadores.
  Para frases muy libres conviene un LLM (Claude) en una fase posterior.
- Los extras no suman precio todavía (se guardan, pero `subtotal` solo usa el
  precio base del producto).
- Aún no se envía respuesta de confirmación al cliente (Fase 2: responder por
  la Cloud API usando `WHATSAPP_ACCESS_TOKEN`).

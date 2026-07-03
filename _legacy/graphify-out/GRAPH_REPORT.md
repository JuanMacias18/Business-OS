# Graph Report - .  (2026-07-01)

## Corpus Check
- Corpus is ~3,725 words - fits in a single context window. You may not need a graph.

## Summary
- 46 nodes · 72 edges · 12 communities (7 shown, 5 thin omitted)
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Arquitectura de modulos|Arquitectura de modulos]]
- [[_COMMUNITY_Modelos de datos del parser|Modelos de datos del parser]]
- [[_COMMUNITY_Acceso a datos Supabase|Acceso a datos Supabase]]
- [[_COMMUNITY_Pruebas del parser|Pruebas del parser]]
- [[_COMMUNITY_Parseo de pedidos (reglas)|Parseo de pedidos (reglas)]]
- [[_COMMUNITY_Flujo de procesamiento de pedido|Flujo de procesamiento de pedido]]
- [[_COMMUNITY_Verificacion de firma (seguridad)|Verificacion de firma (seguridad)]]
- [[_COMMUNITY_Resolucion de tenant|Resolucion de tenant]]
- [[_COMMUNITY_Verificacion del webhook (GET)|Verificacion del webhook (GET)]]
- [[_COMMUNITY_Token de acceso WhatsApp|Token de acceso WhatsApp]]
- [[_COMMUNITY_Regla de respuesta HTTP 200|Regla de respuesta HTTP 200]]
- [[_COMMUNITY_Stack Supabase|Stack Supabase]]

## God Nodes (most connected - your core abstractions)
1. `parsePedido()` - 9 edges
2. `procesarMensaje()` - 8 edges
3. `Flujo de recepcion de pedido` - 6 edges
4. `getTenantByPhoneNumberId()` - 5 edges
5. `Modulo Asistente WhatsApp (doc)` - 5 edges
6. `upsertCliente()` - 4 edges
7. `insertPedido()` - 4 edges
8. `calcularDetallesYTotal()` - 4 edges
9. `MiSaaSTech (plataforma)` - 4 edges
10. `Modulo Asistente WhatsApp` - 4 edges

## Surprising Connections (you probably didn't know these)
- `phone_number_id -> tenant` --references--> `getTenantByPhoneNumberId()`  [INFERRED]
  docs/01-meta-cloud-api-setup.md → supabase/functions/whatsapp-webhook/db.ts
- `Flujo de recepcion de pedido` --references--> `getTenantByPhoneNumberId()`  [INFERRED]
  whatsapp_assistant/README.md → supabase/functions/whatsapp-webhook/db.ts
- `Flujo de recepcion de pedido` --references--> `verifySignature()`  [INFERRED]
  whatsapp_assistant/README.md → supabase/functions/whatsapp-webhook/index.ts
- `Parser por reglas (MVP)` --rationale_for--> `parsePedido()`  [INFERRED]
  whatsapp_assistant/README.md → supabase/functions/whatsapp-webhook/parser.ts
- `Flujo de recepcion de pedido` --references--> `upsertCliente()`  [INFERRED]
  whatsapp_assistant/README.md → supabase/functions/whatsapp-webhook/db.ts

## Import Cycles
- 1-file cycle: `supabase/functions/whatsapp-webhook/index.ts -> supabase/functions/whatsapp-webhook/index.ts`
- 1-file cycle: `tests/parser.test.ts -> tests/parser.test.ts`
- 2-file cycle: `supabase/functions/whatsapp-webhook/db.ts -> supabase/functions/whatsapp-webhook/index.ts -> supabase/functions/whatsapp-webhook/db.ts`

## Hyperedges (group relationships)
- **Flujo de pedido WhatsApp (webhook)** — supabase_functions_whatsapp_webhook_index_verifysignature, supabase_functions_whatsapp_webhook_db_gettenantbyphonenumberid, supabase_functions_whatsapp_webhook_parser_parsepedido, supabase_functions_whatsapp_webhook_db_upsertcliente, supabase_functions_whatsapp_webhook_db_insertpedido [INFERRED 0.85]
- **Credenciales Meta Cloud API** — docs_01_meta_cloud_api_setup_verify_token, docs_01_meta_cloud_api_setup_access_token, docs_01_meta_cloud_api_setup_app_secret, docs_01_meta_cloud_api_setup_phone_number_tenant [INFERRED 0.80]

## Communities (12 total, 5 thin omitted)

### Community 0 - "Arquitectura de modulos"
Cohesion: 0.25
Nodes (9): WhatsApp Cloud API de Meta, Dashboard de administracion (React), Modulo Inventario automatico, Meta Cloud API (WhatsApp), MiSaaSTech (plataforma), Nequi API (pagos), Modulo Pagos Nequi, Modulo Asistente WhatsApp (+1 more)

### Community 1 - "Modelos de datos del parser"
Cohesion: 0.29
Nodes (5): ItemPedido, Modificador, MODIFICADORES_DEFAULT, NUMEROS, Phrase

### Community 2 - "Acceso a datos Supabase"
Cohesion: 0.47
Nodes (4): getCatalogo(), Tenant, supabase, @supabase/supabase-js@2 (esm.sh, externo)

### Community 3 - "Pruebas del parser"
Cohesion: 0.40
Nodes (4): Deno std assert/mod.ts (externo), calcularDetallesYTotal(), ProductoCatalogo, CATALOGO

### Community 4 - "Parseo de pedidos (reglas)"
Cohesion: 0.40
Nodes (5): buildPhrases(), matchPhraseAt(), normalize(), parsePedido(), Parser por reglas (MVP)

### Community 5 - "Flujo de procesamiento de pedido"
Cohesion: 0.83
Nodes (4): insertPedido(), upsertCliente(), procesarMensaje(), Flujo de recepcion de pedido

### Community 6 - "Verificacion de firma (seguridad)"
Cohesion: 0.67
Nodes (3): App Secret (META_APP_SECRET), Firma X-Hub-Signature-256 (HMAC-SHA256), verifySignature()

## Knowledge Gaps
- **17 isolated node(s):** `Tenant`, `supabase`, `Modificador`, `ItemPedido`, `MODIFICADORES_DEFAULT` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Modulo Asistente WhatsApp` connect `Arquitectura de modulos` to `Acceso a datos Supabase`?**
  _High betweenness centrality (0.217) - this node is a cross-community bridge._
- **Why does `parsePedido()` connect `Parseo de pedidos (reglas)` to `Modelos de datos del parser`, `Acceso a datos Supabase`, `Pruebas del parser`, `Flujo de procesamiento de pedido`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Flujo de recepcion de pedido` (e.g. with `getTenantByPhoneNumberId()` and `insertPedido()`) actually correct?**
  _`Flujo de recepcion de pedido` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `getTenantByPhoneNumberId()` (e.g. with `phone_number_id -> tenant` and `Flujo de recepcion de pedido`) actually correct?**
  _`getTenantByPhoneNumberId()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Tenant`, `supabase`, `Modificador` to the rest of the system?**
  _19 weakly-connected nodes found - possible documentation gaps or missing edges._
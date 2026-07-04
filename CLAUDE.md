# CLAUDE.md — Business OS (MysaasTech)

Guardrails y contexto operativo para Claude Code en este repo. Este archivo manda sobre cualquier instrucción ambigua. Si una tarea entra en conflicto con estas reglas: **parar y preguntar al owner**.

## Qué es este proyecto (30 segundos)

Business OS **multi-tenant, modular y white-label** para PYMES colombianas. v1 = **un vertical (restaurantes), una región (Colombia), módulos del core**. Cliente final por WhatsApp (Meta Cloud API directa); negocio opera un panel web. La plataforma **nunca custodia dinero** (no-agregador; fondos directos al tenant).

- **Fuente de verdad:** `docs/00-INDEX.md` → leer el doc del hito activo antes de codificar (divulgación progresiva; no leer los 33 docs).
- **Plan de entrega:** `docs/PLAN-DE-ACCION-claude-code.md` (fases, gates, loops).
- **Decisiones:** `docs/03-arquitectura/03-11-adr/` — los ADR Aceptados son ley; se supersede, no se editan.

## Stack

React + Vite + Tailwind + TS estricto (panel, Vercel) · Supabase: Postgres + RLS, Auth, Storage, Edge Functions (Deno) · pnpm monorepo · pgTAP para tests de base · GitHub `JuanMacias18`.

```
apps/panel/        # frontend (anon key + JWT, NUNCA service_role)
packages/core/     # tipos compartidos, cliente supabase, puerto PaymentGateway
supabase/          # migrations/ functions/ tests/ seed.sql
docs/              # documentación (docs-as-code)
```

## Comandos

```bash
pnpm dev             # panel local
pnpm db:reset        # supabase db reset (migraciones + seed)
supabase test db     # suite pgTAP (incluye aislamiento — FF-1)
deno test --config supabase/functions/deno.json --allow-net --allow-env --allow-read supabase/functions supabase/tests/concurrency
                     # tests de Edge Functions (incluye replay — FF-4) + tests de
                     # concurrencia (LOOP B, ver 03-05). Requieren SUPABASE_URL/
                     # SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY del stack local
                     # (`supabase status`); sin ellas, se saltan solos. Los tests de
                     # pagos (Fase 5, 03-07) ademas requieren WOMPI_TEST_PUBLIC_KEY/
                     # WOMPI_TEST_PRIVATE_KEY/WOMPI_TEST_EVENTS_SECRET/
                     # WOMPI_TEST_INTEGRITY_SECRET (llaves de sandbox, nunca
                     # hardcodeadas — repo público). En CI son secrets del repo.
pnpm lint && pnpm typecheck && pnpm test
pnpm e2e             # Playwright
```

## Reglas de oro (no negociables)

1. **Plan antes de ejecutar.** Toda tarea no trivial arranca proponiendo un plan (Fase 0) y espera aprobación del owner antes de tocar código.
2. **Ramas:** trabajar en `dev` (o feature → `dev`). **Jamás merge a `main` sin aprobación explícita del owner.**
3. **RLS obligatoria:** toda tabla nueva nace en la misma migración con RLS habilitado, policies deny-by-default y **test de aislamiento pgTAP** (tenant A no ve/escribe B). Sin test, el PR no existe. Prohibido `using (true)` fuera de la lista blanca de tablas de referencia.
4. **`service_role` solo server-side** (Edge Functions), solo cuando el JWT del usuario no alcanza, siempre con filtro explícito de `tenant_id` y comentario `// WHY`. Nunca en `apps/` ni `packages/` (CI lo bloquea — FF-3).
5. **Webhooks:** validar firma → persistir con clave de idempotencia → responder 200 rápido → procesar asíncrono (cola en Postgres). Todo webhook tiene test de replay (mismo payload ×2 ⇒ un efecto — FF-4). En pagos, la verdad es `getStatus` en la pasarela, nunca el webhook solo, nunca el redirect del usuario.
6. **Migraciones inmutables** una vez en `main`: corregir = nueva migración. Todo cambio debe sobrevivir `supabase db reset` limpio.
7. **Doc y código en el mismo PR:** si el cambio altera una decisión o contrato documentado, el doc dependiente se actualiza en el mismo PR (regla del índice §2).
8. **Módulos no contaminan el core:** `identidad/tenancy, catálogo, pagos, notificaciones, panel` no importan nada de `pedidos` (ni de futuros módulos). Si lo necesitas, es un smell: parar y preguntar.
9. **Secretos:** jamás en el repo ni en texto plano. Credenciales de pasarela/WABA por tenant, cifradas (Vault/pgsodium). Nada de datos de tarjeta, solo referencias de pasarela.
10. **Una sesión de Claude Code por área a la vez** (evita `.git/index.lock`). Si aparece el lock: verificar que no hay otra sesión activa antes de borrarlo.
11. **Loops con salida:** toda tarea tiene EXIT verificable por comando; iterar hasta verde. **A la 3ª iteración fallida sin progreso: parar y reportar** el bloqueo con hipótesis — no fuerza bruta.
12. **Alcance v1 blindado:** nada de reservas/citas, dine-in, white-label profundo, multi-región, app nativa ni POS (01-01 §6.2). Si una tarea lo pide, señalar el conflicto antes de ejecutar.

## Definición de Hecho (todo PR)

- [ ] Lint + typecheck + tests verdes en CI (incluye `supabase test db`)
- [ ] Fitness functions FF-1..FF-4 verdes (aislamiento, RLS total, no-service_role en cliente, idempotencia)
- [ ] Tabla nueva ⇒ test de aislamiento incluido
- [ ] Docs dependientes actualizados en el mismo PR
- [ ] Sin secretos, sin `console.log` sobrante, migraciones pasan `db reset`
- [ ] Descripción del PR: qué, por qué, cómo verificarlo (comando)

## Convenciones

Prosa y commits en español; identificadores, SQL y código en inglés técnico. Commits: `tipo(área): descripción` (`feat(pedidos): reserva de stock con TTL`). Diagramas en Mermaid junto al doc. Errores de dominio tipados; `event_log` con `tenant_id` + correlation id en toda transición de estado.

## Contexto colombiano relevante

Ley 1581 (datos personales): minimizar datos, autorización con finalidad, derechos ARCO — diseño, no parche. No-agregador ante Superfinanciera: restricción permanente. Pasarelas y precios de Meta cambian: verificar condiciones vigentes antes de fijarlas en un ADR o en pricing.

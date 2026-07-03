# Plan de Acción Ejecutable — Business OS × Claude Code

| Metadato | Valor |
|---|---|
| Versión | 1.0.0 · 2026-07-02 |
| Complementa | `AUDITORIA-business-os.md` (aplica sus parches en T0.2) y `CLAUDE.md` (guardrails del agente) |
| Principio rector | El riesgo se valida con código y con terceros, no con prosa. Docs mínimos primero, just-in-time después; cada fase cierra con un **gate ejecutable**. |
| Equipo | 1 persona (owner) + Claude Code |

---

## 0. Cómo funciona este plan (léelo antes de ejecutar)

### 0.1 El mecanismo de loops

Todas las tareas usan el formato **GOAL / CONTEXTO / LOOP / EXIT / GUARDRAILS**. La regla que hace que el loop funcione de verdad:

> **El EXIT debe ser verificable por comando.** Si Claude Code puede correr un comando y ver rojo/verde, puede iterar solo hasta cumplirlo. Si el criterio es humano ("que se vea bien", "que el owner apruebe"), el loop se detiene ahí y pregunta — nunca lo auto-aprueba.

Cada bloque de tarea está redactado para **pegarse directamente como prompt** en Claude Code (añadiendo "Lee CLAUDE.md y el CONTEXTO indicado antes de proponer tu plan"). Toda tarea no trivial arranca con tu Fase 0 habitual: Claude Code propone el plan, tú apruebas, luego ejecuta.

### 0.2 Fitness functions: los EXIT que se quedan a vivir

Los EXIT críticos no se verifican una vez — **se quedan en CI para siempre** e impiden regresiones (fitness functions). Las cuatro del proyecto:

| FF | Comprobación en CI | Protege |
|---|---|---|
| FF-1 | Suite de aislamiento multi-tenant (`supabase test db`) en verde | O4 / amenaza #1 |
| FF-2 | Script que falla si existe una tabla sin RLS habilitado o una policy `using (true)` no permitida | Deny-by-default |
| FF-3 | Grep en CI: `service_role` no aparece en `apps/` ni `packages/` (solo en `supabase/functions/` justificado) | Bypass de RLS |
| FF-4 | Tests de idempotencia de webhooks (mismo payload ×2 ⇒ un solo efecto) | Dinero duplicado |

### 0.3 Reglas de sesión (resumen; detalle en CLAUDE.md)

Una sesión de Claude Code por área a la vez (evita el `.git/index.lock` que ya conoces) · `dev → main` solo con tu aprobación · migraciones inmutables una vez en `main` · doc y código que se afectan mutuamente van en el mismo PR.

### 0.4 Mapa de fases y objetivos

| Fase | Nombre | Valida | Objetivo de 01-01 | Duración estimada* |
|---|---|---|---|---|
| 0 | Decisiones y fundación | Decisiones + relojes externos | — | Semana 1 |
| 1 | Documentación mínima viable | Coherencia del núcleo | — | Semana 1–2 (paralela) |
| 2 | Walking skeleton | RLS/aislamiento, webhooks, panel-tenant | **O4** (como gate de CI) | Semana 2–3 |
| 3 | Catálogo | Núcleo + Storage por tenant | — | Semana 3–4 |
| 4 | Módulo Pedidos + Inventario | FSM, reserva, concurrencia | — | Semana 4–6 |
| 5 | Pagos (pasarela D-7) | Webhook + getstatus + conciliación | — | Semana 6–8 |
| 6 | WhatsApp | Ciclo E2E de laboratorio | **O1** (lab) | Semana 8–10 |
| 7 | Onboarding + piloto | Cliente real pagando | **O2, O3, O1** (real) | Semana 10–12+ |

\* Las fechas son orientativas; **mandan los gates, no el calendario**. El riesgo real de cronograma son los relojes externos de T0.5 — por eso arrancan el día 1.

---

## FASE 0 — Decisiones y fundación (Semana 1)

**Goal de fase:** todas las decisiones que bloquean el primer commit están tomadas y registradas; el monorepo existe con CI verde; los trámites externos están en curso.

### T0.1 — Sesión de decisiones (owner, con Claude como sparring) — 1-2 h
Cerrar en una sola sesión, usando las propuestas por defecto de la auditoría:

- [ ] **D-1** nombre (suficiente con confirmar "MysaasTech" como nombre de trabajo; renombrar después es barato).
- [ ] **D-2/ADR-011** alcance v1 → `Aceptado`.
- [ ] **ADR-002** multi-tenant RLS → `Aceptado`, con la nota "v1 = solo shared-schema + RLS; dedicado = costura sin código" (C7).
- [ ] **ADR-003, 008** → `Aceptado`. **ADR-009, 010** → `Aceptado` como costuras (alcance v1 = solo la costura).
- [ ] **ADR-001** → `Aceptado` + disparador de supersede (D-3).
- [ ] **D-6** → lista definitiva de módulos v1 (propuesta: identidad/tenancy, catálogo, pedidos, pagos, inventario, notificaciones WhatsApp, panel — y nada más).
- [ ] **D-7** primera pasarela → se decide con el spike T0.5 (criterio: sandbox funcional primero).
- [ ] **D-8** estructura de repos → monorepo pnpm (propuesta ADR-012).

**EXIT:** los ADR actualizados y ADR-012 redactado, commiteados junto con los parches de T0.2.

### T0.2 — Aplicar parches de auditoría *(prompt para Claude Code)*
```
GOAL: 00-INDEX.md pasa a v2.1.0 y 01-01 a v1.0.1 aplicando los parches
      PA-1..PA-12 de docs/auditorias/AUDITORIA-business-os.md, con las
      decisiones tomadas en T0.1.
CONTEXTO: AUDITORIA-business-os.md §5; 00-INDEX.md; 01-01.
LOOP: aplicar parche → verificar consistencia interna (estados de ADR
      coinciden entre §4.4, §7 y 01-01 §14; métricas de §8 cuadran con
      el conteo real de filas del catálogo) → siguiente parche.
EXIT: - grep de estados inconsistentes sin resultados
      - conteo de filas por estado == métricas de §8
      - changelog v2.1.0 registrado; PR a dev listo para mi revisión.
GUARDRAILS: no reescribir prosa fuera de los parches; no cambiar
      decisiones, solo registrarlas.
```

### T0.3 — Monorepo y CI *(prompt para Claude Code)*
```
GOAL: monorepo pnpm funcional con CI verde en GitHub Actions.
CONTEXTO: CLAUDE.md; ADR-012 (D-8); ADR-007 (stack panel).
ESTRUCTURA:
  business-os/
  ├── CLAUDE.md
  ├── docs/                 # mysaastech-docs absorbido + auditorias/
  ├── apps/panel/           # React + Vite + Tailwind + TS estricto
  ├── packages/core/        # tipos compartidos, cliente supabase tipado
  ├── supabase/
  │   ├── migrations/  ├── functions/  ├── tests/   # pgTAP
  │   └── seed.sql
  └── .github/workflows/ci.yml
LOOP: scaffold → `pnpm install && pnpm lint && pnpm typecheck &&
      pnpm test` → corregir → repetir hasta verde local → push a dev
      → CI verde.
EXIT: - CI verde en dev con lint + typecheck + test (placeholder ok)
      - FF-3 activa en CI (grep service_role) aunque aún no haya código
      - README raíz de 10 líneas apuntando a docs/00-INDEX.md.
GUARDRAILS: rama dev; sin merge a main; sin dependencias más allá de
      las estándar del stack; cero secretos en el repo.
```

### T0.4 — Entorno local reproducible *(prompt para Claude Code)*
```
GOAL: entorno local levanta y se resetea con dos comandos.
CONTEXTO: CLAUDE.md; Supabase CLI + Docker ya instalados (WSL2).
LOOP: configurar supabase/config.toml → `supabase start` →
      `supabase db reset` → smoke test (query trivial vía cliente de
      packages/core) → corregir → repetir.
EXIT: - `supabase start` y `supabase db reset` sin errores
      - script `pnpm db:reset` y `pnpm dev` documentados en CLAUDE.md
      - .env.example completo (sin valores reales).
GUARDRAILS: no tocar CI; no crear tablas de negocio todavía.
```

### T0.5 — Arrancar relojes externos (owner, humano — el mismo día 1)
- [ ] **Spike D-7**: solicitar credenciales sandbox de la(s) pasarela(s) candidatas y cronometrar cuánto tarda cada una en darte un pago de prueba funcionando. La primera que funcione define D-7. Verifica condiciones vigentes (comisiones, dispersión) antes de fijar el ADR.
- [ ] **Meta**: crear/confirmar la app de Meta for Developers, WABA de pruebas de la plataforma y número de test; iniciar verificación del negocio si aplica.
- [ ] **Piloto**: lista corta de 3-5 restaurantes candidatos y primer contacto (el trámite de *su* pasarela y *su* WABA es parte de la venta — O3).

**EXIT de FASE 0:** decisiones registradas · CI verde · entorno local reproducible · trámites externos en curso con fecha de solicitud anotada.

---

## FASE 1 — Documentación mínima viable (Semana 1–2, paralela a Fase 0/2)

**Goal de fase:** existen los únicos 4 documentos que el código del núcleo necesita. El resto se escribe just-in-time (mapa en §9).

Orden: `01-04` Glosario → `03-02` Tenancy → `03-03` Modelo de datos (núcleo) → `06-01` (solo la sección de pruebas de aislamiento).

### Loop de redacción (uno por documento) *(prompt para Claude Code)*
```
GOAL: docs/<ID>.md redactado y Vigente según las reglas del índice.
CONTEXTO: 00-INDEX.md (propósito y dependencias del doc, incl. los
      requisitos de contenido añadidos por PA-12); 01-01; glosario si
      ya existe; ADRs aceptados relacionados.
LOOP: redactar → checklist de consistencia:
        1. términos == glosario (o el glosario se amplía en el mismo PR)
        2. cero TBD/placeholder
        3. dependencias declaradas y coherentes
        4. diagramas en Mermaid renderizan
      → corregir → repetir.
EXIT: checklist completa + estado Vigente + fila del índice
      actualizada EN EL MISMO PR + mi aprobación (gate humano).
GUARDRAILS: 03-02 DEBE cubrir los bordes de C5 (service_role, storage,
      realtime, performance de policies, deny-by-default). 03-03 v1
      cubre SOLO núcleo: tenants, users/profiles, memberships+roles,
      event_log — pedidos/pagos llegan en sus fases.
```

---

## FASE 2 — Walking skeleton (Semana 2–3)

**Goal de fase:** una bala trazadora atraviesa todas las capas con lo mínimo: tenancy con RLS verificada en CI (O4 vivo desde ya), un webhook idempotente y un panel que resuelve tenant. **No implementa pedidos ni pagos** — prueba las costuras.

### T2.1 — Núcleo de tenancy con RLS verificada *(prompt para Claude Code)*
```
GOAL: migración inicial (tenants, profiles, memberships+roles,
      event_log) con RLS deny-by-default y suite de aislamiento en CI.
CONTEXTO: docs/03-02, docs/03-03, CLAUDE.md (reglas RLS).
LOOP (TDD-RLS):
  1. Escribir en supabase/tests/ los casos pgTAP que DEBEN fallar:
     - usuario del tenant A no lee filas del tenant B (select)
     - usuario del tenant A no escribe en B (insert/update/delete)
     - usuario sin membership no lee nada
     - roles: member no hace lo que admin sí
     (patrón: `set local request.jwt.claims` para simular cada JWT)
  2. Escribir migración + policies.
  3. `supabase db reset && supabase test db`.
  4. Rojo → corregir → volver a 3.
EXIT: - `supabase test db` verde en CI (FF-1 activa)
      - FF-2 activa: script en CI que falla si alguna tabla tiene RLS
        deshabilitado o una policy `using (true)` fuera de la lista
        blanca de tablas de referencia
      - función `current_tenant_id()` estable y usada por las policies
      - índices compuestos liderados por tenant_id.
GUARDRAILS: cero uso de service_role en tests de aislamiento (probaría
      nada). Si una policy parece exigir service_role, PARA y pregunta.
```

### T2.2 — Webhook echo idempotente *(prompt para Claude Code)*
```
GOAL: Edge Function `webhook-echo` que valida una firma HMAC dummy,
      persiste el evento en event_log con clave de idempotencia y
      responde 200 rápido; el procesamiento es asíncrono (cola en
      Postgres: tabla jobs + función de proceso).
CONTEXTO: docs/03-03 (event_log); patrón webhook-rápido (auditoría m6).
LOOP: test Deno del handler (unit, lógica en _shared/) → test de
      replay: mismo payload ×2 ⇒ 1 fila de efecto, 2 recepciones
      registradas → implementar → `deno test` → iterar.
EXIT: - FF-4 activa para este handler
      - firma inválida ⇒ 401 y nada persiste
      - p50 de respuesta del handler < 1s en local (el trabajo pesado
        quedó en la cola).
GUARDRAILS: si usas service_role aquí, filtra por tenant_id explícito
      y justifícalo en comentario // WHY.
```

### T2.3 — Panel "hola, tenant" *(prompt para Claude Code)*
```
GOAL: apps/panel con login (Supabase Auth), resolución de tenant por
      membership y una pantalla que muestra datos del tenant vía RLS
      (anon key + JWT; jamás service_role en cliente).
CONTEXTO: docs/03-02 (resolución de tenant); ADR-007.
LOOP: e2e mínimo (Playwright) con dos usuarios seed de tenants
      distintos → implementar → `pnpm e2e` → iterar.
EXIT: - e2e verde: el usuario A ve el nombre/datos del tenant A y no
        existe forma de ver los del B (incluida manipulación de la URL)
      - FF-3 sigue verde.
GUARDRAILS: UI mínima sin diseño; el objetivo es la costura, no la
      estética.
```

**GATE de FASE 2 (el más importante del proyecto):** FF-1..FF-4 activas y verdes en CI · demo de 2 minutos: dos tenants, dos usuarios, cero fuga. A partir de aquí, **toda tabla nueva nace con test de aislamiento o el CI la rechaza**.

---

## FASE 3 — Catálogo + panel (Semana 3–4)

**Docs just-in-time:** ampliar `03-03` (entidades de catálogo e inventario básico), `02-01` (solo RF de catálogo).

### T3.1 — Módulo catálogo
```
GOAL: productos por tenant (CRUD completo en panel), imágenes en
      Storage con policies por tenant, disponibilidad on/off.
LOOP: TDD-RLS extendido a las tablas nuevas y al bucket (subir imagen
      como tenant A, intentar leerla como B ⇒ denegado) → implementar
      → suites verdes → iterar.
EXIT: - aislamiento verde incluyendo Storage (amplía FF-1)
      - CRUD cubierto por e2e
      - seed de catálogo demo para desarrollo.
GUARDRAILS: sin categorías anidadas ni variantes complejas en v1
      (scope 01-01 §6.2); optimización de imágenes con el pipeline
      sharp que ya usas si aplica, pero sin bloquear el gate por ello.
```

**GATE:** un tenant gestiona su catálogo end-to-end sin tocar la base a mano.

---

## FASE 4 — Módulo Pedidos + Inventario (Semana 4–6)

**Docs just-in-time:** `03-05` (FSM del pedido — redactar ANTES de codificar, es el contrato), ampliar `03-03` (orders, order_items, stock_reservations), `02-01` (RF de pedidos/inventario).

### T4.1 — FSM del pedido + reserva de stock
```
GOAL: máquina de estados del pedido implementada tal como la define
      docs/03-05 (creado → pendiente_pago → confirmado → preparando →
      entregado | cancelado/expirado), con:
      - reserva de stock al crear la solicitud de pago (ADR-006)
      - expiración que libera reserva (pg_cron o scheduled function)
      - decremento atómico al confirmar
        (UPDATE ... SET stock = stock - qty WHERE id=$p AND tenant_id=$t
         AND stock >= qty; rowcount 0 = insuficiente)
CONTEXTO: docs/03-05; ADR-006; docs/03-03 ampliado.
LOOP A (transiciones): tabla de transiciones válidas/inválidas como
      tests → implementar guardas → verde.
LOOP B (concurrencia): script que dispara N pedidos concurrentes sobre
      stock=1 ⇒ exactamente 1 confirma, 0 sobreventa, N-1 rechazan
      limpio → correr 20 veces → determinístico o se corrige.
LOOP C (expiración): reserva con TTL corto en test ⇒ pasado el TTL el
      stock vuelve y el pedido queda expirado.
EXIT: - los 3 loops verdes en CI
      - event_log registra cada transición con correlation id
      - aislamiento extendido a las tablas nuevas (FF-1).
GUARDRAILS: "Pedidos" es un MÓDULO: nada del core (identidad, catálogo,
      pagos) puede importar de él (01-01 §5). Si necesitas ese import,
      PARA — es un smell de acoplamiento del límite más caro del
      proyecto.
```

**GATE:** pedido manual desde el panel recorre la FSM completa; imposible sobrevender bajo concurrencia; expiración devuelve stock sola.

---

## FASE 5 — Pagos, pasarela D-7 (Semana 6–8)

**Docs just-in-time:** `03-07` (capa de pagos), `03-06` (contratos de webhooks), secciones de `04-04` que apliquen a v1.

### T5.1 — Puerto de pagos + adaptador D-7
```
GOAL: interfaz PaymentGateway en packages/core
      (createPaymentRequest / getStatus / verifyWebhook / parseEvent)
      + adaptador de la pasarela D-7 + Edge Function de webhook real.
CONTEXTO: docs/03-07; ADR-003; fixtures = payloads REALES capturados
      del sandbox (T0.5), guardados en supabase/tests/fixtures/.
LOOP (contrato): contract tests contra fixtures → implementar
      adaptador → replay tests (FF-4) → getstatus-como-verdad: el
      webhook NUNCA confirma solo; siempre se consulta getStatus antes
      de transicionar a confirmado y descontar → iterar.
EXIT: - pago sandbox aprobado ⇒ pedido confirmado + stock descontado
      - pago rechazado/expirado ⇒ reserva liberada + notificación
      - webhook con firma inválida ⇒ 401, nada cambia
      - replay ×3 del webhook ⇒ un solo efecto
      - job de conciliación: re-consulta pagos `pendiente` con más de
        X min y resuelve o alerta.
GUARDRAILS: credenciales de pasarela por tenant CIFRADAS (Vault/
      pgsodium), jamás en texto plano ni en el repo. Nada de datos de
      tarjeta: solo referencias de la pasarela.
```

**GATE:** demo E2E de laboratorio sin WhatsApp: panel crea pedido → link/instrucción de pago sandbox → pago → confirmación automática → inventario correcto → conciliación en verde.

---

## FASE 6 — WhatsApp (Semana 8–10)

**Docs just-in-time:** `03-08` (integración WhatsApp), plantillas a aprobar en Meta (hazlo al INICIO de la fase: la aprobación tarda).

### T6.1 — Recepción, envío y pedido conversacional mínimo
```
GOAL: webhook de Meta (verify token + firma), estado de conversación
      en Postgres (nunca en memoria), flujo mínimo: saludo → catálogo →
      carrito → confirmar → instrucción/link de pago → notificaciones
      de estado (plantillas fuera de la ventana de 24h).
CONTEXTO: docs/03-08; patrón webhook-rápido de Fase 2; tu experiencia
      previa con Meta Cloud API directa.
LOOP: tests de la FSM conversacional con mensajes simulados →
      idempotencia por message_id (Meta reenvía; FF-4) → implementar →
      probar con el número de test de la WABA de plataforma → iterar.
EXIT (= O1 en laboratorio):
      - flujo real completo: WhatsApp → pedido → pago sandbox →
        confirmación por WhatsApp → inventario descontado, sin tocar
        nada a mano
      - mensaje duplicado de Meta ⇒ cero efecto doble
      - fallo de la Cloud API ⇒ reintento idempotente + degradación
        ("estamos procesando tu pago…").
GUARDRAILS: tokens por tenant con expiración monitoreada (alerta
      simple); quality rating vigilado desde el día 1.
```

**GATE:** grabas un video del ciclo completo desde tu teléfono. Ese video es también tu material de venta para el piloto.

---

## FASE 7 — Onboarding + piloto (Semana 10–12+)

**Docs just-in-time:** `05-02` (runbook de onboarding — se escribe HACIENDO el primer alta), `05-04` mínimo (alertas de pagos/webhooks/tokens), `01-03` (pricing con costos reales medidos, incl. costo WhatsApp por tenant con precios vigentes de Meta).

### T7.1 — Onboarding scriptado
```
GOAL: script/checklist que da de alta un tenant completo: registro,
      branding básico (logo+colores), catálogo inicial, credenciales
      de pasarela (cifradas), conexión WABA, smoke test E2E del tenant.
LOOP: ejecutar el alta del tenant de prueba → cronometrar → anotar
      cada paso manual → automatizar el más lento → repetir.
EXIT: - runbook 05-02 refleja la realidad (no la teoría)
      - tiempo de alta medido y decreciente (O3: el 5º debe ser
        sustancialmente más rápido que el 1º).
```

### T7.2 — Piloto real (owner)
- [ ] Alta del primer restaurante (sus trámites de pasarela/WABA vienen corriendo desde T0.5 como parte de la venta).
- [ ] Dos semanas de operación acompañada; `event_log` + alertas como fuente de fricciones.
- [ ] Precio real cobrado desde el día 1, aunque sea precio de piloto — un piloto gratis no valida O2.

**GATE FINAL v1:** O1 real (>95 % de pedidos sin intervención manual, medido en event_log) · O2 (primer pago de suscripción o el aprendizaje documentado de por qué no) · O3 (curva de onboarding bajando) · O4 (FF-1..FF-4 verdes ininterrumpidas).

---

## 8. Loops transversales (siempre activos)

1. **Loop doc↔código:** todo PR que cambia una decisión de arquitectura actualiza el doc dependiente en el mismo PR (la regla del índice §2, ahora ejecutable — Claude Code la tiene en CLAUDE.md).
2. **Loop de seguridad por fase:** al cierre de cada fase, checklist RLS sobre lo nuevo (FF-2 lo automatiza; la revisión humana mira las policies con ojos de atacante).
3. **Mini-auditoría documental por fase:** consistencia, glosario y trazabilidad SOLO de los docs tocados en la fase (reemplaza la auditoría monolítica final — parche PA-6).
4. **Loop de re-planificación:** disparadores para volver a este plan y ajustarlo: (a) el spike D-7 tarda >2 semanas en dar sandbox ⇒ cambiar de pasarela candidata; (b) la verificación de Meta se atasca ⇒ adelantar Fase 7 comercial con demo en video; (c) cualquier FF en rojo >1 día ⇒ se detiene el desarrollo de features hasta verde.

## 9. Mapa doc→fase (qué se escribe y cuándo)

| Fase | Se redacta (Vigente al cierre de la fase) |
|---|---|
| 0 | ADR-002/003/008/009/010/011 aceptados · ADR-012 · CLAUDE.md · parches índice |
| 1 | 01-04 · 03-02 · 03-03 (núcleo) · 06-01 (aislamiento) |
| 3 | 03-03 (catálogo) · 02-01 (RF catálogo) |
| 4 | 03-05 · 03-03 (pedidos) · 02-01 (RF pedidos/inventario) |
| 5 | 03-07 · 03-06 · 04-04 (v1) |
| 6 | 03-08 |
| 7 | 05-02 · 05-04 (mínimo) · 01-03 (con costos reales) |
| Post-v1 | 01-02 · 01-05 · 02-02 · 02-03 · 03-01 (C4, con el sistema ya real) · 03-04 · 03-09 · 03-10 · 04-01/02/03 · 05-01/03/05 · 06-02 · 07-01/02 · 08-01/02 |

Nota honesta: 03-01 (C4) y 03-04 (módulos/entitlements) posponerse duele — son "el mapa". El trade-off es deliberado: el C4 dibujado tras el walking skeleton describe la realidad; dibujado antes, describe una hipótesis que igual vas a corregir. El sistema de entitlements formal no se necesita con 3-5 tenants del mismo vertical; en v1 basta un campo `enabled_modules` por tenant como costura (documentado en 03-03), y ADR-008 se implementa completo cuando entre la segunda vertical.

## 10. Riesgos de este plan

| Riesgo | Señal | Respuesta |
|---|---|---|
| Relojes externos (pasarela/Meta) más lentos que el código | T0.5 sin sandbox en semana 2 | Disparador 4a/4b de §8; el desarrollo no se detiene, la fase 5/6 usa mocks contra los contratos hasta tener sandbox |
| Scope creep hacia entitlements/white-label/C4 "porque la arquitectura lo pide" | Tareas que no mapean a un gate de fase | GUARDRAILS + no-objetivos 01-01 §6.2; lo que no tiene gate, no se codifica |
| Fatiga documental (saltarse la DMV "para avanzar") | Código de Fase 2 sin 03-02 Vigente | El gate de Fase 2 exige los docs de Fase 1; CLAUDE.md lo recuerda |
| Loops que no convergen (Claude Code itera sin salir) | >3 iteraciones sin acercarse al EXIT | Regla en CLAUDE.md: a la 3ª iteración fallida, parar y reportar el bloqueo con hipótesis, no seguir a fuerza bruta |

---

*Primer paso concreto: hoy mismo T0.1 (decisiones, 1-2 h) y T0.5 (solicitudes externas). Mañana, T0.2 y T0.3 en Claude Code.*

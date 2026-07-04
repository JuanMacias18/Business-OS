# MysaasTech (Business OS) — Índice Maestro de Documentación

> **Producto:** *MysaasTech* — un **Business Operating System (Business OS)** modular, multi-tenant y white-label para PYMES. Nombre a confirmar (ver D-1).
> **Concepto:** un núcleo tecnológico reutilizable sobre el que distintas verticales (restaurantes, cafeterías, panaderías, barberías, salones, tiendas, minimercados, licorerías, consultorios, gimnasios, servicios y otras PYMES) activan solo los módulos que necesitan.
> **Modelo de despliegue:** multi-tenant (una plataforma, muchas empresas), con aislamiento lógico por tenant vía RLS y aislamiento dedicado opcional para tiers superiores.
> **Alcance geográfico:** Colombia primero; arquitectura preparada para expansión regional (region packs).
> **Documento:** Índice maestro del repositorio. Fuente de verdad sobre qué documentos existen, para qué sirven y cómo se relacionan.

| Metadato | Valor |
|---|---|
| Estado del índice | **Vigente** |
| Versión | 2.1.1 |
| Última actualización | 2026-07-03 |
| Cambio v1→v2 | Pivote de "SaaS de un vertical, instancia aislada por cliente" a "Business OS multi-tenant, modular y white-label". |
| Cambio v2.0.0→v2.1.0 | Correcciones de auditoría 2026-07-02 (parches PA-1..PA-12) tras sesión de decisiones T0.1: ADR-001/002/003/008/009/010/011/012 pasan a Aceptado; D-1, D-2, D-4, D-6, D-8 cerradas; D-3 con disparador definido; DMV añadida (§1.1); métricas de §8 recalculadas. |
| Cambio v2.1.0→v2.1.1 | D-7 cerrada (2026-07-03): gana Wompi, sandbox verificado funcional (spike T0.5); nota añadida a ADR-003. |
| Responsable | CTO / Arquitecto |
| Idioma del repo | Español (es-CO) |

---

## 1. Propósito del repositorio

Contiene la documentación completa y de calidad de producción de **MysaasTech (Business OS)**, previa al desarrollo. Objetivo: que **cualquier desarrollador o modelo de IA pueda continuar el proyecto leyendo únicamente esta documentación**, comprendiendo la arquitectura y el porqué de cada decisión.

No es un conjunto de resúmenes ni plantillas. Cada documento marcado *Vigente* es un artefacto autosuficiente y accionable.

Principios de arquitectura del proyecto (declarados por el owner, adoptados como restricciones de diseño):

modularidad · escalabilidad · simplicidad · seguridad · mantenibilidad · reutilización · extensibilidad · bajo acoplamiento · alta cohesión · **configuración sobre personalización** · documentación como parte del desarrollo.

Orden de prioridad cuando estos principios entran en conflicto en una decisión concreta:

1. **Seguridad y aislamiento entre tenants** (datos de terceros y dinero de por medio).
2. **Mantenibilidad y bajo acoplamiento** (un solo núcleo, operado por equipo mínimo + Claude Code).
3. **Simplicidad** (menos piezas móviles = menos falla y menos costo).
4. **Modularidad, extensibilidad y reutilización** (nueva vertical = módulos nuevos sobre el mismo núcleo).
5. **Escalabilidad** (suficiente para años, sin sobre-ingeniería hoy).
6. **Bajo costo operativo**.
7. **Experiencia de usuario** (dueño PYME, su personal, cliente final, y el revendedor white-label).
8. **Facilidad de venta** (explicable, cotizable, activable rápido).

Se optimiza para **la evolución del producto a lo largo de los años**, minimizando deuda técnica — no para velocidad de desarrollo del primer sprint.

### Nota de estrategia (ADR-011): arquitectura vs. alcance de producto

Se separan dos planos deliberadamente:

- **Arquitectura:** plataforma-ready desde el día 1 (multi-tenant, modular, pagos y región abstraídos). Hacerlo bien ahora es barato; retrofitearlo después es una reescritura.
- **Alcance de producto v1:** estrecho. Un vertical (**restaurantes**), una región (**Colombia**), solo módulos del core. Las capacidades de plataforma (más verticales, white-label profundo, más regiones) se encienden por fases sobre la misma arquitectura, sin reescribirla.

Racional: las plataformas horizontales exitosas se *extraen* de un vertical validado con clientes reales; no se diseñan universales en el vacío. Construir el núcleo para 12 verticales antes del primer cliente pagando es el principal riesgo de no lanzar. Ver `03-11/ADR-011`.

### 1.1 Documentación mínima viable (DMV) para iniciar código

33+ documentos y 12 ADR antes de escribir código reintroduce, en el plano documental, el mismo riesgo que ADR-011 elimina en el de producto: no lanzar nunca. Por eso el código del núcleo arranca con la **mínima documentación que lo desbloquea**, no con el catálogo completo:

- `01-04` Glosario
- `03-02` Tenancy y aislamiento
- `03-03` Modelo de datos (solo núcleo: tenants, users/profiles, memberships+roles, event_log)
- `06-01` (solo la sección de pruebas de aislamiento)
- Los ADR ya *Aceptados* (ver §4.4)

El resto del catálogo se redacta **just-in-time por hito**, según el mapa doc→fase de `docs/PLAN-DE-ACCION-claude-code.md` §9. Las tres auditorías finales de §6 se reemplazan por mini-auditorías por lote al cierre de cada fase.

---

## 2. Cómo leer este repositorio

Orden recomendado para un dev/IA nuevo:

1. `01-01` Visión y alcance → el problema y el modelo Business OS.
2. `01-04` Glosario → vocabulario (tenant, módulo, entitlement, vertical, white-label, region pack, RLS).
3. `01-05` Verticales y matriz de módulos → qué activa cada vertical.
4. `02-01` / `02-02` Requisitos funcionales y no funcionales.
5. `03-01` Visión de arquitectura (C4) → el mapa completo.
6. `03-11` ADR (todos) → *por qué* la arquitectura es como es.
7. `03-02` Tenancy → aislamiento multi-tenant (el pilar de seguridad).
8. `03-03` Modelo de datos + `03-04` Sistema de módulos y entitlements → el corazón del núcleo.
9. `03-05` a `03-10` Estados, API, pagos, WhatsApp, white-label, regionalización.
10. `04-*` Seguridad y cumplimiento (obligatorio antes de tocar pagos o datos personales).
11. `05-*` DevOps → cómo se provisiona un tenant y se opera la plataforma.
12. `06-*` Calidad → qué se prueba (incluye aislamiento entre tenants).
13. `07-*` Roadmap y backlog.
14. `08-*` Estándares (incluye cómo se autoría un módulo/vertical nuevo).

Regla de dependencia: si un documento depende de otro (columna *Depende de*), ambos se mantienen alineados; un cambio en el origen obliga a revisar sus dependientes en el mismo PR.

---

## 3. Convenciones del repositorio

### 3.1 Estructura de archivos

```
mysaastech-docs/
├── 00-INDEX.md
├── 01-vision-producto/
│   ├── 01-01-vision-y-alcance.md
│   ├── 01-02-usuarios-y-jtbd.md
│   ├── 01-03-modelo-negocio-y-pricing.md
│   ├── 01-04-glosario.md
│   └── 01-05-verticales-y-matriz-de-modulos.md
├── 02-requisitos/
│   ├── 02-01-requisitos-funcionales.md
│   ├── 02-02-requisitos-no-funcionales.md
│   └── 02-03-historias-y-criterios-aceptacion.md
├── 03-arquitectura/
│   ├── 03-01-vision-arquitectura-c4.md
│   ├── 03-02-tenancy-y-aislamiento.md
│   ├── 03-03-modelo-de-datos-y-erd.md
│   ├── 03-04-sistema-de-modulos-y-entitlements.md
│   ├── 03-05-maquina-de-estados-del-pedido.md
│   ├── 03-06-contrato-api-y-edge-functions.md
│   ├── 03-07-capa-de-pagos-multipasarela.md
│   ├── 03-08-integracion-whatsapp.md
│   ├── 03-09-white-label-y-theming.md
│   ├── 03-10-configuracion-regional-e-i18n.md
│   └── 03-11-adr/
│       ├── ADR-index.md
│       ├── ADR-001-whatsapp-meta-directo.md
│       ├── ADR-002-arquitectura-multi-tenant-rls.md
│       ├── ADR-003-pagos-multipasarela-sin-agregador.md
│       ├── ADR-004-n8n-fuera-de-la-ruta-critica.md
│       ├── ADR-005-edge-functions-como-webhook.md
│       ├── ADR-006-reserva-de-stock-en-solicitud-de-pago.md
│       ├── ADR-007-stack-frontend-panel.md
│       ├── ADR-008-sistema-de-modulos-entitlements.md
│       ├── ADR-009-white-label-theming-y-dominios.md
│       ├── ADR-010-regionalizacion-region-packs.md
│       └── ADR-011-alcance-v1-un-vertical-una-region.md
├── 04-seguridad-cumplimiento/
│   ├── 04-01-arquitectura-de-seguridad.md
│   ├── 04-02-modelo-de-amenazas.md
│   ├── 04-03-proteccion-datos-ley-1581-e-i18n.md
│   └── 04-04-cumplimiento-pagos-regulatorio.md
├── 05-devops/
│   ├── 05-01-entornos-y-configuracion.md
│   ├── 05-02-provisioning-y-onboarding-de-tenant.md
│   ├── 05-03-ci-cd-migraciones-y-versionado.md
│   ├── 05-04-observabilidad-y-alertas.md
│   └── 05-05-respaldo-y-recuperacion.md
├── 06-calidad/
│   ├── 06-01-estrategia-de-pruebas.md
│   └── 06-02-definicion-de-hecho-y-release.md
├── 07-entrega/
│   ├── 07-01-roadmap-y-fases.md
│   └── 07-02-backlog-inicial-y-estimaciones.md
└── 08-estandares/
    ├── 08-01-convenciones-codigo-repos-y-modulos.md
    └── 08-02-estandares-de-documentacion.md
```

> Directorio en disco: `mysaastech-docs/`. El nombre comercial definitivo se cierra en D-1 (por defecto, MysaasTech).

### 3.2 Ciclo de vida de estado de un documento

| Estado | Significado |
|---|---|
| **En cola** | Enumerado, aún no redactado. |
| **En redacción** | Se está escribiendo en esta iteración. |
| **En revisión** | Redactado; pendiente de auditoría de consistencia. |
| **Vigente** | Completo, revisado, sin "por completar". Único estado válido para producción. |
| **Obsoleto** | Reemplazado; se conserva con enlace al sucesor. |

La columna **Estado** de los catálogos es un rastreador de entrega, no una sección incompleta dentro de un documento. Ningún documento *Vigente* contiene contenido de relleno, placeholders, "TBD" ni "por completar".

### 3.3 Versionado

- Documentos: versionado semántico ligero `MAYOR.MENOR.PARCHE`.
- ADR: inmutables una vez *Aceptado*; no se editan, se *supersede* con un ADR nuevo enlazado.
- Encabezado obligatorio por documento: título, estado, versión, fecha, responsable (rol), y *Depende de / Es dependencia de*.

### 3.4 Proceso ADR

Formato: **Contexto → Decisión → Alternativas consideradas → Consecuencias (positivas y negativas) → Estado**. Se registra lo elegido y lo descartado. Ver `03-11/ADR-index.md`.

### 3.5 Idioma y notación

Prosa en es-CO; identificadores, tablas/campos y comandos en inglés técnico. Diagramas en **Mermaid** (C4, ERD, máquinas de estado, secuencia), versionados junto al texto.

---

## 4. Catálogo de documentos

Roles: **PM** Product · **CTO** CTO/Arquitecto · **SEC** Security · **DEV** DevOps · **QA** QA Lead · **TW** Technical Writer.

### 4.1 Dominio 01 — Visión y producto

| ID | Documento | Propósito | Rol | Depende de | Estado |
|---|---|---|---|---|---|
| 01-01 | Visión y alcance | Business OS: problema, propuesta de valor, objetivos y no-objetivos, alcance v1 vs plataforma, confirmación de nombre. | PM | — | **Vigente** |
| 01-02 | Usuarios y JTBD | Personas multi-vertical (dueño PYME, personal/cajero, cliente final, operador de plataforma, revendedor white-label) y jobs-to-be-done. | PM | 01-01 | En cola |
| 01-03 | Modelo de negocio y pricing | Suscripción SaaS por módulo/vertical/seat; tier white-label/revendedor; unit economics multi-tenant; costo por tenant. | PM | 01-01 | En cola |
| 01-04 | Glosario | Vocabulario único (tenant, módulo, entitlement, vertical, white-label, region pack, RLS, anticipo, getstatus, WABA…). | TW | — | **Vigente** |
| 01-05 | Verticales y matriz de módulos | Qué módulos son del core y cuáles por vertical; matriz vertical × módulo; criterio para añadir verticales. | PM | 01-01 | En cola |

### 4.2 Dominio 02 — Requisitos

| ID | Documento | Propósito | Rol | Depende de | Estado |
|---|---|---|---|---|---|
| 02-01 | Requisitos funcionales | RF por módulo del core (identidad/tenancy, catálogo, pedidos, pagos, inventario, notificaciones, panel) + módulos de restaurantes (v1). **v0.1 (En revisión) cubre solo catálogo** — el resto se añade just-in-time por fase. | PM | 01-01, 03-03 | En revisión |
| 02-02 | Requisitos no funcionales | Aislamiento multi-tenant, rendimiento, disponibilidad, seguridad, idempotencia/consistencia, white-label, i18n, límites, costo objetivo. | CTO | 01-01 | En cola |
| 02-03 | Historias y criterios de aceptación | Historias con criterios Gherkin trazadas a RF; base de 06 y 07. | QA | 02-01 | En cola |

### 4.3 Dominio 03 — Arquitectura

| ID | Documento | Propósito | Rol | Depende de | Estado |
|---|---|---|---|---|---|
| 03-01 | Visión de arquitectura (C4) | C4 (contexto/contenedores/componentes) de la plataforma modular multi-tenant; principios; estilo edge-first con event-log. | CTO | 02-02 | En cola |
| 03-02 | Tenancy y aislamiento | Multi-tenant: shared-schema + RLS por defecto; aislamiento por niveles (esquema/DB dedicado para enterprise); resolución de tenant; blast radius. | CTO | ADR-002, ADR-007, 01-04 | **Vigente** |
| 03-03 | Modelo de datos y ERD | Esquema multi-tenant (tenant_id, RLS), entidades del core (tenants, usuarios, roles, productos, inventario, pedidos, items, pagos, mensajes, event_log) y límites por módulo; ERD. **v1.1 (Vigente) cubre núcleo + `jobs` (T2.2) + `productos`/Storage (T3.1)** — pedidos/pagos/mensajería se añaden just-in-time por fase (§1.1, §9). | CTO | 03-02, 01-04 | **Vigente** |
| 03-04 | Sistema de módulos y entitlements | Registro de módulos, activación por tenant/vertical, feature flags, límites de acoplamiento entre módulos, extensibilidad. **(Pilar nuevo.)** | CTO | 03-01, ADR-008, 01-05 | En cola |
| 03-05 | Máquina de estados del pedido | FSM del módulo Pedidos (v1 restaurantes): estados, transiciones, reserva de stock, expiraciones, reversas, idempotencia. | CTO | 03-03, ADR-006 | En cola |
| 03-06 | Contrato de API y Edge Functions | Endpoints internos y Edge Functions (webhooks pago/WhatsApp, envío de mensajes, API del panel): contratos, validación de firma, idempotencia, contexto de tenant. | CTO | 03-03, 03-04 | En cola |
| 03-07 | Capa de pagos multi-pasarela | Abstracción de pasarelas (Nequi, Wompi, Mercado Pago, PayU, ePayco); sin agregador, fondos directos al tenant; credenciales por tenant cifradas; getstatus como verdad. | CTO | 03-05, 03-06, ADR-003 | En cola |
| 03-08 | Integración WhatsApp | Recepción/envío, plantillas, tokens, quality rating, versionado; **decisión de onboarding a escala reabierta** (Meta directo vs BSP/Embedded Signup). | CTO | 03-06, ADR-001 | En cola |
| 03-09 | White-label y theming | Branding por tenant (logo, colores, tokens de tema), dominios/subdominios personalizados, límites de personalización. **(Nuevo.)** | CTO | 03-01, ADR-009 | En cola |
| 03-10 | Configuración regional e i18n | Region packs: pasarelas, impuestos, protección de datos, locale/moneda; cómo se añade una región sin tocar el core. **(Nuevo.)** | CTO | 03-07, ADR-010 | En cola |
| 03-11 | Registro de decisiones (ADR) | Carpeta e índice de ADR. Ver 4.4. | CTO | — | En cola |

### 4.4 Log de ADR (dentro de 03-11)

| ADR | Título | Decisión resumida | Estado |
|---|---|---|---|
| ADR-001 | WhatsApp: Meta Cloud API directo | Integración directa con Graph API. Candidato a supersede vía D-3. Disparador: el onboarding manual de WABA supere ≈15-20 tenants activos, o el tiempo de alta por tenant no baje pese al runbook (07-01/T7.1). | Aceptado |
| ADR-002 | Arquitectura multi-tenant con RLS | Postgres compartido con `tenant_id` + RLS como aislamiento por defecto; esquema/DB dedicado para tiers enterprise. **Reemplaza** la decisión v1 de instancia aislada por cliente. v1 implementa exclusivamente shared-schema + RLS; el aislamiento dedicado es una costura sin código hasta demanda enterprise real. | Aceptado |
| ADR-003 | Pagos multi-pasarela, sin agregador | Abstracción de pasarelas; cada tenant usa sus credenciales y recibe fondos directo; la plataforma nunca custodia dinero. **Primera pasarela de v1 (D-7): Wompi** — sandbox verificado funcional el 2026-07-03 (llave pública y privada autentican contra la API real; acepta NEQUI, PSE, CARD, DAVIPLATA, Bancolombia en modo sandbox). Nequi API directa seguía en revisión al momento de decidir; gana Wompi por la regla "la primera con sandbox funcional" (`AUDITORIA-business-os.md` C6). La abstracción multi-pasarela sigue permitiendo agregar Nequi directa después sin reescribir. | Aceptado |
| ADR-004 | n8n fuera de la ruta crítica | La ruta pedido→pago→inventario va en Edge Functions; n8n solo para automatizaciones adyacentes. | Aceptado |
| ADR-005 | Edge Functions como webhook | Supabase Edge Functions como endpoint HTTPS de pasarelas y Meta. | Aceptado |
| ADR-006 | Reserva de stock en la solicitud de pago | Stock reservado al generar la solicitud, no al confirmar; expiración libera la reserva. | Aceptado |
| ADR-007 | Stack del panel (frontend) | React + Vite + Tailwind en Vercel para el panel; theming compatible con white-label. | Aceptado |
| ADR-008 | Sistema de módulos y entitlements | Núcleo modular con activación por tenant/vertical vía registro de módulos + entitlements. | Aceptado |
| ADR-009 | White-label: theming y dominios | Branding y dominios por tenant mediante tokens de tema y resolución de dominio. Alcance v1 = solo la costura (branding básico: logo y colores); dominios personalizados y portal de revendedor diferidos. | Aceptado (costura) |
| ADR-010 | Regionalización por region packs | La lógica regional (pagos, impuestos, datos, locale) vive en paquetes configurables, no hardcodeada. Alcance v1 = solo la costura; único region pack implementado es Colombia. | Aceptado (costura) |
| ADR-011 | Alcance v1: un vertical, una región | Arquitectura plataforma-ready; producto v1 = restaurantes + Colombia + módulos del core. | Aceptado |
| ADR-012 | Estructura de repositorios: monorepo pnpm | Monorepo (`apps/panel`, `packages/core`, `supabase/`, `docs/`) para PRs atómicos doc+código y un solo CI; alternativa multi-repo descartada por carga operativa de un equipo de una persona. | Aceptado |

### 4.5 Dominio 04 — Seguridad y cumplimiento

| ID | Documento | Propósito | Rol | Depende de | Estado |
|---|---|---|---|---|---|
| 04-01 | Arquitectura de seguridad | Aislamiento multi-tenant, RLS, authn/authz y roles por tenant, secretos por tenant (Vault/pgsodium), server-side only, seguridad de dominios white-label. | SEC | 03-01, 03-02, 03-06 | En cola |
| 04-02 | Modelo de amenazas | STRIDE con **fuga cross-tenant como amenaza #1**; webhooks, pagos, replay/idempotencia, toma de dominio, abuso, límites de tasa. | SEC | 04-01, 03-07 | En cola |
| 04-03 | Protección de datos (Ley 1581 + i18n) | Roles responsable (tenant) / encargado (plataforma) en multi-tenant white-label; autorización, ARCO, retención, contrato de tratamiento; preparación GDPR por region pack. | SEC | 03-03, 03-10 | En cola |
| 04-04 | Cumplimiento de pagos y regulatorio | Por qué no se es agregador (Superfinanciera) con multi-pasarela; facturación DIAN; obligaciones por región. | SEC | ADR-003, 03-10 | En cola |

### 4.6 Dominio 05 — DevOps e infraestructura

| ID | Documento | Propósito | Rol | Depende de | Estado |
|---|---|---|---|---|---|
| 05-01 | Entornos y configuración | Local (WSL2 + Docker + Supabase CLI + Cloudflare Tunnel), staging, prod; variables; gestión de secretos por tenant. | DEV | 03-01 | En cola |
| 05-02 | Provisioning y onboarding de tenant | Alta de un tenant (no de un proyecto): creación, selección de vertical/módulos/región, branding, dominio; checklist de credenciales del negocio (pasarela, WABA). | DEV | 05-01, 03-02, 03-09 | En cola |
| 05-03 | CI/CD, migraciones y versionado | Repos, ramas (dev→main con aprobación), CI, **migraciones únicas sobre base compartida** (ya no N proyectos), despliegue de Edge Functions, versionado de módulos. | DEV | 05-01 | En cola |
| 05-04 | Observabilidad y alertas | `event_log` + correlation IDs con tenant_id, métricas por tenant, alertas críticas por WhatsApp, Sentry, monitoreo de quality rating y expiración de tokens. | DEV | 03-03, 04-02 | En cola |
| 05-05 | Respaldo y recuperación | Backups y PITR de la base compartida, aislamiento en restauración, plan DR, RTO/RPO. | DEV | 05-01, 03-02 | En cola |

### 4.7 Dominio 06 — Calidad

| ID | Documento | Propósito | Rol | Depende de | Estado |
|---|---|---|---|---|---|
| 06-01 | Estrategia de pruebas | Pirámide; **pruebas de aislamiento multi-tenant como categoría de primera clase**; contract tests de webhooks; idempotencia/concurrencia de stock; sandbox de pasarelas/Meta. **v1.0 (Vigente) cubre solo la sección de aislamiento** — el resto se añade just-in-time en Fases 4-6. | QA | 03-02, 03-03 | **Vigente** |
| 06-02 | Definición de Hecho y release | DoD (incluye verificación de RLS), checklist de release, versiones, changelog. | QA | 06-01, 05-03 | En cola |

### 4.8 Dominio 07 — Entrega y planificación

| ID | Documento | Propósito | Rol | Depende de | Estado |
|---|---|---|---|---|---|
| 07-01 | Roadmap y fases | Fase 0 (core multi-tenant + módulos base + vertical restaurantes + CO). Fases: más módulos, más verticales, white-label profundo, más regiones. Criterios de salida por fase. | PM | 01-01, 03-01, ADR-011 | En cola |
| 07-02 | Backlog inicial y estimaciones | Épicas → historias priorizadas (MoSCoW), estimaciones, dependencias, primer sprint. | PM | 02-03, 07-01 | En cola |

### 4.9 Dominio 08 — Estándares y contribución

| ID | Documento | Propósito | Rol | Depende de | Estado |
|---|---|---|---|---|---|
| 08-01 | Convenciones de código, repos y módulos | Estructura del núcleo reutilizable, naming, TypeScript, estilo, estructura de Edge Functions, **cómo se autoría un módulo/vertical nuevo** sin acoplar el core. | CTO | 03-04, 03-06 | En cola |
| 08-02 | Estándares de documentación | Cómo se mantiene el repo: formato, proceso ADR, versionado, definición de "documento vigente". | TW | — | En cola |
| 08-03 | Flujo de trabajo con Claude Code (CLAUDE.md) | Guardrails del agente: plan-antes-de-ejecutar, dev→main con aprobación, reglas RLS/service_role, reglas de sesión, Definición de Hecho. El archivo vive en la raíz del repo de código; este ítem lo referencia. | CTO | 08-01 | En redacción |

---

## 5. Trazabilidad y consistencia

```
Necesidad (01-02 JTBD) / Vertical (01-05)
  → Requisito funcional (02-01 RF-xx)
    → Historia + criterio de aceptación (02-03)
      → Decisión de diseño (03-xx / ADR)
        → Prueba (06-01, incluye aislamiento)
          → Ítem de backlog (07-02)
```

Un requisito sin prueba, o una prueba sin requisito, es un defecto de documentación y se corrige antes de declarar *Vigente* el conjunto.

---

## 6. Protocolo de auditoría

**Mini-auditoría por lote**: al cierre de cada fase del plan de entrega (`docs/PLAN-DE-ACCION-claude-code.md`) se auditan consistencia, glosario, dependencias y trazabilidad de los documentos tocados en esa fase — no del catálogo completo.

**Auditoría final ligera**, antes de declarar el paquete terminado, sobre las tres dimensiones originales:

1. **Arquitectura** — coherencia C4 ↔ tenancy ↔ datos ↔ módulos ↔ estados ↔ contratos; ADR y diagramas sin contradicción; RNF alcanzables; detección de sobre-ingeniería; que el aislamiento multi-tenant sea íntegro.
2. **Documentación** — sin contradicciones, sin duplicados, sin vacíos; glosario respetado; dependencias alineadas; trazabilidad (sección 5) intacta.
3. **Producto** — el v1 (un vertical, una región) es vendible y entregable; unit economics de suscripción cierran; el onboarding es realista dados los tiempos de aprobación de pasarela/Meta que no controlamos.

Tras la auditoría final ligera se actualiza lo afectado y solo entonces el paquete se declara **terminado**.

---

## 7. Decisiones abiertas (requieren confirmación del owner)

Las decisiones cerradas se conservan en esta tabla por trazabilidad (referencian el momento y mecanismo del cierre).

| # | Decisión abierta | Documento que la cierra | Propuesta por defecto |
|---|---|---|---|
| D-1 | Confirmar **nombre** del producto/plataforma | 01-01 | **Cerrada (T0.1, 2026-07-02).** Se mantiene "MysaasTech" como nombre de trabajo. Al ser white-label, el cliente final ve la marca del tenant; el nombre es B2B/ventas — renombrar después sigue siendo barato. |
| D-2 | Validar **alcance de v1** (ADR-011): un vertical (restaurantes) + CO | 01-01 / 07-01 | **Cerrada.** ADR-011 → Aceptado (ver §4.4). |
| D-3 | **WhatsApp a escala**: Meta directo con alta manual vs BSP/Embedded Signup (reabre ADR-001) | 03-08 | **Abierta, con disparador definido (T0.1).** Meta directo en v1; reconsiderar BSP/Embedded Signup cuando el onboarding manual de WABA supere ≈15-20 tenants activos, o el tiempo de alta por tenant no baje pese al runbook de onboarding (07-01/T7.1). |
| D-4 | **Estrategia de aislamiento** por defecto y tiers | 03-02 | **Cerrada.** ADR-002 → Aceptado: shared-schema + `tenant_id` + RLS por defecto; esquema/DB dedicado = costura sin código, solo para tiers enterprise futuros (nota C7). |
| D-5 | **Modelo de pricing** de suscripción (por módulo/vertical/seat) y tier white-label/revendedor | 01-03 | **Abierta.** Se define con costos reales en Fase 7 (`01-03`); no bloquea Fase 0. |
| D-6 | **Módulos del core** y primeros módulos verticales de restaurantes | 01-05 / 02-01 | **Cerrada (T0.1).** Flujo: para-llevar/domicilio; dine-in diferido (01-01 §6.2). Módulos v1: identidad/tenancy, catálogo, pedidos, pagos, inventario, notificaciones WhatsApp, panel — y nada más. |
| D-7 | Primera pasarela de v1: Nequi API directa vs. pasarela con Nequi como método de pago | ADR-003 / 03-07 | **Cerrada (2026-07-03).** Gana **Wompi**: sandbox funcional verificado (llaves pública/privada autentican, NEQUI disponible como método dentro de Wompi). Nequi API directa seguía en revisión — regla "la primera que responde con sandbox funcional gana" (`AUDITORIA-business-os.md` C6). Comisión de referencia: 2.65% + $700 COP + IVA (tarjeta, plan agregador); verificar de nuevo antes de cobrar en producción, las tarifas cambian. |
| D-8 | Estructura de repositorios | ADR-012 / 05-03 | **Cerrada (T0.1).** Monorepo pnpm (`apps/panel`, `packages/core`, `supabase/`, `docs/`). |

---

## 8. Estado global del paquete

Denominador: filas del catálogo §4.1-4.9 (35 documentos) + filas de §4.4 (12 ADR). El índice (`00-INDEX.md`) no es una fila del catálogo — su vigencia se rastrea en el metadato "Estado del índice" (§ encabezado), no en este conteo.

| Métrica | Valor |
|---|---|
| Documentos totales (catálogo) | 35 |
| Vigentes | 5 (`01-01`, `01-04`, `03-02`, `03-03` v1.1 núcleo+catálogo, `06-01` v1.0 aislamiento) |
| En revisión | 1 (`02-01` v0.1 RF de catálogo — pendiente de aprobación del owner) |
| En redacción | 1 (`08-03`) |
| En cola | 28 |
| ADR totales | 12 |
| ADR Aceptados | 12 (9 Aceptado, 2 Aceptado-costura: 009/010, 1 con disparador de supersede: 001) |
| ADR Propuestos | 0 |
| Próximo documento a redactar | Ninguno pendiente de DMV. Fase 3 (catálogo, T3.1) ya redactó sus docs just-in-time (`03-03` v1.1, `02-01` v0.1). El resto del catálogo se redacta just-in-time por fase (§9). |
| Auditorías finales | Reemplazadas por mini-auditorías por lote (§6); auditoría final ligera pendiente |

---

*Fin del índice maestro v2.1.0. Documentación Mínima Viable completa y aprobada por el owner el 2026-07-02 (`01-04`, `03-02`, `03-03` núcleo, `06-01` aislamiento — las 4, Vigentes). Siguiente artefacto: código de T2.1 (walking skeleton), no un documento.*

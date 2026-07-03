# 01-04 · Glosario

| Metadato | Valor |
|---|---|
| Documento | Glosario de MysaasTech (Business OS) |
| Estado | **Vigente** |
| Versión | 1.0.0 |
| Última actualización | 2026-07-02 |
| Responsable | TW (con revisión de CTO) |
| Depende de | — (documento base de vocabulario, no asume ninguna decisión previa) |
| Es dependencia de | `03-02`, `03-03`, `03-04`, `03-05`, `03-06`, `03-07`, `03-08`, `04-01`, `04-02`, `05-02`, `05-04`, `06-01` y `CLAUDE.md` |

---

Vocabulario único del proyecto. Todo documento que use uno de estos términos lo usa con el significado definido aquí; si un documento necesita un matiz distinto, ese matiz se agrega a esta entrada en el mismo PR (regla de dependencia, `00-INDEX` §2), no se redefine localmente.

## A

**ADR (Architecture Decision Record).** Registro formal de una decisión de arquitectura: Contexto → Decisión → Alternativas consideradas → Consecuencias → Estado. Inmutable una vez `Aceptado`; para cambiarlo se *supersede* con un ADR nuevo enlazado, nunca se edita el original. Viven en `03-11/ADR-*`.

**Anon key.** Llave pública de Supabase que el panel usa para autenticarse como el usuario final (vía JWT). Respeta RLS por completo. Es la única llave que puede vivir en `apps/` o `packages/` — ver *service_role*.

**Anticipo.** Pago parcial por adelantado que se cobra al agendar, propio del flujo de la familia **Agenda/reserva** (módulo Reservas, futuro — ver *Vertical*). No aplica al flujo de v1 (Comercio/pedido), que reserva stock en vez de cobrar anticipo (`01-01` §5, §9).

## B

**Blast radius.** El alcance del daño que causa una falla. En un modelo multi-tenant de esquema compartido, una migración mala o un bug de RLS puede afectar a *todos* los tenants a la vez (a diferencia de instancias aisladas por cliente) — es el costo explícito que el pivote v1→v2 acepta a cambio de operar con equipo mínimo (`AUDITORIA-business-os.md` §6).

**Business OS.** El producto: una plataforma multi-tenant, modular y white-label sobre la que distintas PYMES operan su negocio activando solo los módulos que necesitan, construida sobre un núcleo reutilizable (identidad, tenancy, catálogo, pagos, notificaciones, panel).

## C

**Correlation ID.** Identificador que se propaga a través de todas las filas de `event_log` generadas por una misma operación de negocio (p. ej. un pedido completo), para poder reconstruir la secuencia de eventos de punta a punta al depurar o auditar.

**Costura (seam).** Un punto de extensión diseñado deliberadamente barato de activar más adelante, aunque hoy no tenga código real detrás (p. ej. white-label, regionalización, aislamiento dedicado). Distinto de sobre-ingeniería: una costura es *arquitectura* sin *producto*; construirla completa sin demanda real sí sería sobre-ingeniería (`01-01` §4, ADR-009/010).

## D

**Deny-by-default.** Postura de seguridad en la que el acceso está bloqueado salvo que una policy lo permita explícitamente. Regla de oro del proyecto: RLS habilitado al 100% de las tablas desde la migración que las crea; prohibido `using (true)` fuera de una lista blanca de tablas de referencia públicas justificadas (`CLAUDE.md` regla #3, hallazgo C5 de la auditoría).

**DMV (Documentación Mínima Viable).** El subconjunto de documentos que desbloquea el código del núcleo (`01-04`, `03-02`, `03-03` núcleo, `06-01` aislamiento + ADR aceptados), en vez de redactar el catálogo completo antes de codificar. El resto se escribe *just-in-time* por hito (`00-INDEX` §1.1).

## E

**Edge Function.** Función serverless de Supabase (runtime Deno) usada como endpoint HTTPS para webhooks (pasarela de pago, Meta) y como capa de API interna. Sigue el patrón *webhook-rápido*: validar firma → persistir con clave de idempotencia → responder 200 → procesar asíncrono (ADR-005).

**Entitlement.** El permiso concreto de que un tenant tiene activado un módulo determinado. El sistema de módulos y entitlements (`03-04`, ADR-008) decide, por tenant y por vertical, qué entitlements existen; en v1 se implementa con un campo simple `enabled_modules` por tenant, no con un motor de reglas complejo.

**event_log.** Tabla del núcleo que registra cada transición de estado relevante del negocio, con `tenant_id` y *correlation id*. Es la fuente de verdad para O1 (medir el % de pedidos sin intervención manual) y para observabilidad/alertas (`05-04`).

## F

**FF (Fitness Function).** Un EXIT crítico que no se verifica una sola vez sino que queda viviendo en CI para siempre, bloqueando cualquier regresión futura. Las cuatro del proyecto (aislamiento multi-tenant, RLS total, `service_role` fuera del cliente, idempotencia de webhooks) están numeradas FF-1 a FF-4 (`PLAN-DE-ACCION-claude-code.md` §0.2).

**FSM (máquina de estados finita).** Modelo formal de los estados válidos de una entidad y las transiciones permitidas entre ellos. El proyecto lo usa para el ciclo de vida del pedido (`03-05`) y para la conversación de WhatsApp (`03-08`); toda FSM del proyecto se redacta como contrato *antes* de codificarla.

## G

**Getstatus (como verdad).** Principio de diseño de la capa de pagos: un webhook de pasarela nunca confirma un pago por sí solo; antes de transicionar un pedido a `confirmado` y descontar inventario, el sistema siempre consulta el estado real en la pasarela (`getStatus`). Protege contra webhooks falsificados, duplicados o fuera de orden (`01-01` §9, `03-07`).

## I

**Idempotencia / clave de idempotencia.** Propiedad de que procesar el mismo evento dos veces produce un único efecto de negocio. Todo webhook del proyecto persiste una clave de idempotencia junto al evento recibido, de modo que un reintento o reenvío (Meta reenvía mensajes; pasarelas reenvían webhooks) no duplique dinero, stock ni notificaciones (FF-4).

## M

**Membership.** La relación que autoriza a un usuario (`auth.users`) a operar dentro de un tenant específico, con un rol asociado (p. ej. `admin`, `staff`). Es la tabla sobre la que se apoyan las policies de RLS para decidir qué tenant puede ver/escribir cada usuario (`03-02`, `03-03`).

**Meta Cloud API.** La API de WhatsApp Business que el proyecto integra de forma directa (sin BSP intermediario) en v1, vía Graph API de Meta (ADR-001). Requiere una app en Meta for Developers, un WABA y, para producción, verificación de negocio.

**Módulo.** Unidad de funcionalidad que se activa o no por tenant/vertical (p. ej. Pedidos, Reservas, Inventario). El núcleo es agnóstico a los módulos verticales: "Pedidos" es el primer módulo, no un concepto del core, precisamente para que verticales de otra naturaleza (familia Agenda/reserva) puedan enchufar su propio módulo sin tocarlo (`01-01` §5).

**Monorepo.** Estructura de un solo repositorio git que contiene `apps/`, `packages/`, `supabase/` y `docs/` (ADR-012), elegida sobre multi-repo para permitir PRs atómicos que tocan doc + código a la vez, con un solo pipeline de CI, operable por una persona.

## N

**No-agregador.** Restricción de diseño permanente (no solo de v1): la plataforma nunca custodia dinero de terceros ni actúa como agregador de pagos ante la Superintendencia Financiera. Cada tenant usa sus propias credenciales de pasarela y recibe los fondos directo a su cuenta (ADR-003, `04-04`).

## O

**Onboarding (de un tenant).** El proceso de dar de alta un negocio nuevo en la plataforma: crear el tenant, configurar catálogo, conectar credenciales de pasarela y de WhatsApp. Se mide como objetivo de producto (O3): el quinto onboarding debe ser sustancialmente más rápido que el primero (`05-02`).

## P

**pgTAP.** Framework de pruebas para PostgreSQL usado para verificar RLS y aislamiento multi-tenant directamente en la base de datos (`supabase test db`), incluyendo los casos que **deben** fallar (tenant A no lee/escribe filas de tenant B).

**PITR (Point-In-Time Recovery).** Mecanismo de respaldo que permite restaurar la base a un instante exacto en el pasado. En un esquema compartido, un PITR restaura *toda* la base a la vez; restaurar un solo tenant sin afectar a los demás requiere un mecanismo aparte (exports lógicos por tenant), tema abierto para `05-05` (hallazgo C5).

## R

**Region pack.** Paquete configurable que encapsula la lógica dependiente de un país (pasarelas disponibles, impuestos, protección de datos, locale/moneda), de modo que agregar una región nueva no requiere tocar el núcleo. v1 solo implementa el pack de Colombia; la costura existe desde ADR-010.

**Reserva de stock.** Patrón de diseño del módulo Pedidos: el inventario se reserva al generar la solicitud de pago (no al confirmarlo), y la reserva expira automáticamente si el pago no llega a tiempo, liberando el stock (ADR-006, `03-05`).

**RLS (Row Level Security).** Mecanismo nativo de PostgreSQL que filtra qué filas puede ver o modificar cada conexión, según policies definidas por tabla. Es el aislamiento multi-tenant por defecto del proyecto (ADR-002) y la amenaza #1 declarada (`04-02`) — ver también *deny-by-default* y *service_role*.

**RTO / RPO (Recovery Time/Point Objective).** Métricas de continuidad: cuánto tiempo puede estar el sistema caído tras un desastre (RTO) y cuántos datos como máximo se pueden perder (RPO). Pendientes de fijar explícitamente para el escenario de restauración por tenant en `05-05`.

## S

**service_role.** Llave de Supabase que **ignora RLS por completo**. Solo puede vivir server-side (Edge Functions), nunca en `apps/` ni `packages/` (bloqueado en CI por FF-3), y solo cuando el JWT del usuario no alcanza — siempre filtrando explícitamente por `tenant_id` y documentando el motivo (`CLAUDE.md` regla #4, hallazgo C5).

## T

**Tenant.** Una empresa (negocio PYME) que usa la plataforma. La unidad de aislamiento: todo dato de negocio lleva `tenant_id`, y ningún usuario de un tenant puede ver o escribir datos de otro (O4).

## V

**Vecino ruidoso (noisy neighbor).** Riesgo de un esquema compartido: un tenant con volumen anómalo de uso puede degradar el rendimiento de los demás. Tolerable en v1 (3-5 restaurantes); a vigilar con métricas por tenant a medida que crece (`05-04`, `AUDITORIA-business-os.md` §6).

**Vertical.** El giro de negocio de un tenant (p. ej. restaurante, barbería, gimnasio). Las verticales objetivo se agrupan en dos familias con flujos distintos — **Comercio/pedido** y **Agenda/reserva** — cada una con su módulo primario (`01-01` §5, `01-05`).

## W

**WABA (WhatsApp Business Account).** La cuenta de negocio de WhatsApp asociada a un número, requerida para enviar/recibir mensajes vía Meta Cloud API. Cada tenant necesita la suya; el trámite de alta y verificación es un cuello de botella conocido de onboarding a escala (D-3, ADR-001).

**Walking skeleton.** La primera versión mínima del sistema que atraviesa todas sus capas (tenancy con RLS, un webhook idempotente, un panel que resuelve tenant) sin implementar features de negocio todavía. Prueba las costuras, no el producto (Fase 2 del plan de entrega).

**White-label.** Capacidad de que un tenant (o un revendedor) opere la plataforma bajo su propia marca (logo, colores, dominio). En v1 solo se activa la costura de branding básico (logo y colores); dominios personalizados y portal de revendedor quedan diferidos (`01-01` §6.2, ADR-009).

---

*Documento vigente. Aprobado por el owner el 2026-07-02.*

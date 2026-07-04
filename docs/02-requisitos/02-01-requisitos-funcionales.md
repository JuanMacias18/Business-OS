# 02-01 · Requisitos Funcionales (catálogo + pedidos)

| Metadato | Valor |
|---|---|
| Documento | Requisitos funcionales — catálogo y pedidos |
| Estado | **En revisión** |
| Versión | 0.2.0 (alcance: catálogo + pedidos/inventario básico; pagos/notificaciones/panel general se añaden just-in-time en fases posteriores) |
| Última actualización | 2026-07-03 |
| Responsable | PM |
| Depende de | `01-01` (alcance v1), `03-03` §5.2/§5.3 (esquemas ya implementados), `03-05` (FSM del pedido) |
| Es dependencia de | `02-03` (historias de aceptación), `06-01` (pruebas más allá de aislamiento) |

---

## 1. Alcance de esta versión

Documento just-in-time de Fases 3 y 4 (`00-INDEX` §9, `PLAN-DE-ACCION-claude-code.md` §9). Cubre los requisitos funcionales del módulo Catálogo (T3.1) y del módulo Pedidos (T4.1). El resto de RF (pagos, notificaciones, panel general) se redactan cuando se codifiquen sus fases correspondientes.

## 2. RF de catálogo

| ID | Requisito | Rol | Estado |
|---|---|---|---|
| RF-CAT-01 | Un admin puede crear un producto en el catálogo de su tenant, con nombre, precio y stock inicial. | admin | Implementado (T3.1) |
| RF-CAT-02 | Un admin puede editar el precio y el stock de un producto existente de su catálogo. | admin | Implementado (T3.1) |
| RF-CAT-03 | Un admin puede marcar un producto como disponible o no disponible sin eliminarlo. | admin | Implementado (T3.1) |
| RF-CAT-04 | Un admin puede eliminar un producto de su catálogo. | admin | Implementado (T3.1) |
| RF-CAT-05 | Un admin puede subir una imagen para un producto. | admin | Implementado (T3.1) |
| RF-CAT-06 | Cualquier miembro del tenant (admin o staff) puede consultar el catálogo completo de su propio tenant. | admin, staff | Implementado (T3.1) |
| RF-CAT-07 | Ningún miembro puede leer, editar ni eliminar productos de un tenant distinto al suyo, bajo ninguna circunstancia. | — | Implementado (T3.1, FF-1) |

## 3. Semántica de "disponible"

Un producto marcado `disponible = false` sigue existiendo en el catálogo (no se pierde su historial ni su configuración) pero no debe ofrecerse al cliente final. La conexión real de este campo con el flujo de pedidos (`cliente → catálogo → pedido`) es responsabilidad del canal de WhatsApp (Fase 6) — este documento solo define el campo y su intención; no define todavía cómo ese canal lo consume.

## 4. RF de pedidos e inventario básico (T4.1)

| ID | Requisito | Rol | Estado |
|---|---|---|---|
| RF-PED-01 | Cualquier miembro del tenant (admin o staff) puede crear un pedido manual eligiendo un producto de su catálogo y una cantidad. | admin, staff | Implementado (T4.1) |
| RF-PED-02 | Al solicitar el pago de un pedido, el sistema reserva (descuenta) el stock del producto de forma atómica; si no hay stock suficiente, el pedido no avanza y el stock no se toca. | admin, staff | Implementado (T4.1) |
| RF-PED-03 | Un pedido pendiente de pago puede confirmarse manualmente (simulación de pago exitoso — la pasarela real llega en Fase 5). | admin, staff | Implementado (T4.1) |
| RF-PED-04 | Un pedido pendiente de pago puede cancelarse manualmente antes de confirmarse; el stock reservado se libera de inmediato. | admin, staff | Implementado (T4.1) |
| RF-PED-05 | Un pedido confirmado avanza a "preparando" y luego a "entregado" mediante acciones explícitas del negocio. | admin, staff | Implementado (T4.1) |
| RF-PED-06 | Ninguna combinación de acciones permite saltarse un estado de la FSM (p. ej. confirmar sin haber solicitado pago, o reabrir un pedido entregado). | — | Implementado (T4.1, trigger de validación) |
| RF-PED-07 | Bajo solicitudes concurrentes sobre el mismo producto, nunca se vende más stock del disponible (cero sobreventa). | — | Implementado (T4.1, verificado 20 corridas) |
| RF-PED-08 | Una reserva de stock no confirmada a tiempo se libera automáticamente (invocación manual/programada de `expirar_reservas_vencidas()` en v1 — sin disparador automático todavía). | — | Implementado (T4.1) |
| RF-PED-09 | Ningún miembro puede ver ni operar pedidos de un tenant distinto al suyo. | — | Implementado (T4.1, FF-1) |

## 5. No-objetivos de esta versión

- Sin categorías de producto ni categorías anidadas, sin variantes/modificadores, sin descuentos ni precios variables por canal (`01-01` §6.2).
- Sin optimización/procesamiento de imágenes (pipeline `sharp` u otro) — se sube la imagen tal cual; una optimización futura no bloquea este gate (guardrail de T3.1).
- Sin integración real de pasarela de pago (Fase 5) — `RF-PED-03` es una confirmación manual/simulada.
- Sin estado `rechazado` explícito ni cancelación posterior a confirmado (reembolsos) — se decide en `03-07`, Fase 5.
- Sin disparador automático de expiración (`pg_cron` u otro) — costura pendiente hasta que el volumen real lo exija (`03-05` §5).
- No define RF de pagos, notificaciones ni panel general.

## 6. Decisiones y documentos relacionados

- `03-03` §5.2/§5.3 — esquemas reales de `productos`, `orders`, `order_items`, `stock_reservations`.
- `03-02` §7 — mecanismo de autorización por rol (`is_tenant_admin()`) que hace cumplir RF-CAT-01 a 05.
- `03-05` — contrato completo de la FSM del pedido (estados, transiciones, mecanismo de reserva/liberación) que implementa RF-PED-01 a 09.
- `01-01` §6.2 — no-objetivos de v1 que acotan el alcance de este documento.

---

*Documento en revisión. Pendiente: lectura y aprobación del owner antes de pasar a Vigente.*

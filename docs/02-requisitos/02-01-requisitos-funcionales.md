# 02-01 · Requisitos Funcionales (RF de catálogo)

| Metadato | Valor |
|---|---|
| Documento | Requisitos funcionales — sección de catálogo |
| Estado | **En revisión** |
| Versión | 0.1.0 (alcance: solo catálogo; pedidos/pagos/inventario avanzado/notificaciones/panel se añaden just-in-time en fases posteriores) |
| Última actualización | 2026-07-03 |
| Responsable | PM |
| Depende de | `01-01` (alcance v1), `03-03` §5.2 (esquema de `productos` ya implementado) |
| Es dependencia de | `02-03` (historias de aceptación), `06-01` (pruebas más allá de aislamiento) |

---

## 1. Alcance de esta versión

Tercer documento just-in-time de Fase 3 (`00-INDEX` §9, `PLAN-DE-ACCION-claude-code.md` §9). Cubre **únicamente** los requisitos funcionales del módulo Catálogo, implementado en T3.1. El resto de RF (pedidos, pagos, inventario avanzado, notificaciones, panel general) se redactan cuando se codifiquen sus fases correspondientes.

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

Un producto marcado `disponible = false` sigue existiendo en el catálogo (no se pierde su historial ni su configuración) pero no debe ofrecerse al cliente final. La conexión real de este campo con el flujo de pedidos (`cliente → catálogo → pedido`) es responsabilidad del módulo Pedidos (Fase 4) y del canal de WhatsApp (Fase 6) — este documento solo define el campo y su intención; no define todavía cómo cada canal lo consume.

## 4. No-objetivos de esta versión

- Sin categorías de producto ni categorías anidadas (`01-01` §6.2).
- Sin variantes (tamaños, extras, modificadores) — alcance v1 explícitamente estrecho.
- Sin descuentos, promociones ni precios variables por canal.
- Sin optimización/procesamiento de imágenes (pipeline `sharp` u otro) — se sube la imagen tal cual; una optimización futura no bloquea este gate (guardrail de T3.1).
- No define RF de pedidos, pagos, inventario avanzado (reservas, decremento atómico bajo concurrencia — eso es `ADR-006`/Fase 4), notificaciones ni panel general.

## 5. Decisiones y documentos relacionados

- `03-03` §5.2 — esquema real de `productos` y policies de Storage que implementan estos RF.
- `03-02` §7 — mecanismo de autorización por rol (`is_tenant_admin()`) que hace cumplir RF-CAT-01 a 05.
- `01-01` §6.2 — no-objetivos de v1 que acotan el alcance de este documento.

---

*Documento en revisión. Pendiente: lectura y aprobación del owner antes de pasar a Vigente.*

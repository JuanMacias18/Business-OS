# 06-01 · Estrategia de Pruebas (sección de aislamiento)

| Metadato | Valor |
|---|---|
| Documento | Estrategia de pruebas — sección de aislamiento multi-tenant |
| Estado | **Vigente** |
| Versión | 1.0.0 (alcance: solo aislamiento; la pirámide completa se redacta cuando exista código de negocio que probar más allá de tenancy) |
| Última actualización | 2026-07-02 |
| Responsable | QA |
| Depende de | `03-02` (mecanismo de RLS), `03-03` (entidades del núcleo) |
| Es dependencia de | T2.1 del plan de entrega; toda tabla de negocio futura |

---

## 1. Alcance de esta versión

Cuarto y último documento del orden DMV (`00-INDEX` §1.1). Cubre **únicamente** la categoría de pruebas de aislamiento multi-tenant — la que desbloquea T2.1. El resto de la pirámide de pruebas (contract tests de webhooks, idempotencia/concurrencia de stock, sandbox de pasarelas y Meta) se redacta cuando exista el código correspondiente (Fases 2, 4 y 5), no antes, siguiendo el mismo principio que evita documentar sobre decisiones que aún no son código (`00-INDEX` §1.1).

## 2. Principio: aislamiento como categoría de primera clase

Las pruebas de aislamiento no son una fase de QA posterior ni un checklist manual — son **fitness functions** (FF-1, FF-2) que viven en CI desde el primer commit que crea una tabla de negocio y bloquean cualquier regresión para siempre (`PLAN-DE-ACCION-claude-code.md` §0.2). Ningún PR que agregue una tabla se mergea sin estas pruebas (`CLAUDE.md` regla #3, DoD).

## 3. Qué se prueba (obligatorio, sin excepción, por cada tabla de negocio nueva)

Los mismos 4 casos definidos en `03-02` §8, aquí elevados a norma general del proyecto:

1. Un usuario del tenant A no lee filas del tenant B (`select`).
2. Un usuario del tenant A no escribe en el tenant B (`insert`/`update`/`delete`).
3. Un usuario sin `membership` en ningún tenant no lee nada.
4. Un rol `staff` no puede hacer lo que un rol `admin` sí puede (cuando la tabla distingue por rol).

Si una tabla nueva no tiene los 4 casos cubiertos (los que apliquen — no toda tabla distingue por rol), el PR que la crea no cumple la Definición de Hecho.

## 4. Cómo se prueba: TDD-RLS con pgTAP

Patrón (ya usado en T2.1 del plan de entrega):

1. **Escribir primero los tests que deben fallar en rojo** (la tabla/policy todavía no existe o está incompleta).
2. Cada test simula un JWT distinto con `set local request.jwt.claims`, para ejercitar `current_tenant_id()` (`03-02` §3.3) como lo haría PostgREST en producción:

```sql
begin;
select plan(1);

-- Simula un usuario del tenant A
set local request.jwt.claims = '{"app_metadata": {"tenant_id": "<uuid-tenant-A>"}}';

select is(
  (select count(*) from public.tenants where id = '<uuid-tenant-B>'),
  0::bigint,
  'tenant A no puede leer al tenant B'
);

select * from finish();
rollback;
```

3. Implementar la migración + policy.
4. `supabase db reset && supabase test db` — rojo → corregir → repetir hasta verde.

## 5. Dónde viven y cómo se nombran

- Carpeta: `supabase/tests/` (ya existe desde T0.3).
- Nombre: `NNNN_descripcion.sql`, numeración secuencial ascendente para que el orden de ejecución sea legible (a diferencia de `supabase/migrations/`, los tests **no** exigen el patrón `<timestamp>_nombre.sql` — verificado en T0.4 con `0000_placeholder.sql`).
- Un archivo por tabla o por conjunto de policies relacionado, no un archivo monolítico para todo el esquema.

## 6. Cuándo corren

- **Local**: `supabase test db` (documentado en `CLAUDE.md`), tras `supabase start`.
- **CI**: job `supabase-db-test` de `.github/workflows/ci.yml` (activo desde T0.3), en cada push/PR a `dev` y `main`. Corre en un runner limpio vía Docker — no depende de que el desarrollador haya corrido nada en local antes de subir el PR.

## 7. Definición de "hecho" para aislamiento (FF-1, FF-2)

- **FF-1**: la suite completa de `supabase/tests/` está verde en CI.
- **FF-2**: un script en CI falla si detecta una tabla con RLS deshabilitado o una policy `using (true)` fuera de la lista blanca de tablas de referencia justificadas (`03-02` §4). Este script se implementa en T2.1, junto con la primera migración de negocio.

Ambas quedan activas de forma permanente a partir de T2.1; ningún desarrollo posterior de features se hace con alguna de las dos en rojo por más de un día (regla de re-planificación, `PLAN-DE-ACCION-claude-code.md` §8.4).

## 8. No-objetivos de esta versión

- No define la pirámide completa de pruebas (unitarias, integración, e2e) más allá de aislamiento.
- No define contract tests de webhooks ni pruebas de idempotencia/concurrencia (llegan con el código de pagos e inventario, Fases 4-5).
- No define la estrategia de pruebas contra sandbox de pasarelas o de Meta (Fase 5-6).
- No define Definición de Hecho general de release (eso es `06-02`).

## 9. Decisiones y documentos relacionados

- `03-02` §8 — origen de los 4 casos obligatorios y del patrón `set local request.jwt.claims`.
- `03-03` — entidades del núcleo sobre las que se ejercitan estos tests primero.
- `PLAN-DE-ACCION-claude-code.md` T2.1 — tarea que consume este documento directamente.

---

*Documento vigente para su alcance de aislamiento. Aprobado por el owner el 2026-07-02. Con este documento se completa la Documentación Mínima Viable (`00-INDEX` §1.1) — el resto del catálogo se redacta just-in-time por fase.*

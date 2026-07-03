-- Corrige un hueco de T2.1: 20260703133739_core_tenancy.sql ya esta
-- en main (inmutable, CLAUDE.md regla #6), asi que el GRANT que le
-- faltaba a service_role se agrega aqui en vez de editar esa
-- migracion. Hallazgo de T2.2: service_role bypassa RLS pero no el
-- GRANT de tabla base (03-02 §4) -- el handler del webhook-echo lo
-- necesita para escribir en event_log.
grant select, insert, update, delete on public.tenants     to service_role;
grant select, insert, update, delete on public.memberships to service_role;
grant select, insert, update, delete on public.profiles    to service_role;
grant select, insert, update, delete on public.event_log   to service_role;

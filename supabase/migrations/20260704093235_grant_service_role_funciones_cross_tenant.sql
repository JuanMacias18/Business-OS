-- Corrige un hueco en dos funciones ya mergeadas a main (T2.2, T4.1):
-- al revocar EXECUTE de public/anon/authenticated, tambien se perdio
-- el EXECUTE implicito para service_role (verificado: service_role
-- NO es superusuario, rolsuper=false -- solo tiene rolbypassrls=true,
-- que es un permiso distinto de EXECUTE sobre funciones). Sin este
-- grant explicito, ninguna Edge Function (que corre como service_role)
-- podria invocar estas funciones de proceso/barrido cross-tenant.
-- Hallazgo de T5.1, al conectar la primera Edge Function real que las
-- necesita de verdad.
grant execute on function public.process_pending_jobs() to service_role;
grant execute on function public.expirar_reservas_vencidas() to service_role;

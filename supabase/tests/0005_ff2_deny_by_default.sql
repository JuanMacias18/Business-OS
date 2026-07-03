-- FF-2: ninguna tabla de public sin RLS, ninguna policy using(true)
-- fuera de una lista blanca explicita (03-02 §4; 06-01 §7).
begin;
select plan(2);

select is(
  (
    select count(*)::int
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and c.relrowsecurity = false
  ),
  0,
  'FF-2: ninguna tabla de public tiene RLS deshabilitado'
);

with whitelist as (
  select unnest(array[]::text[]) as tablename
)
select is(
  (
    select count(*)::int
    from pg_policies p
    where p.schemaname = 'public'
      and p.qual = 'true'
      and p.tablename not in (select tablename from whitelist)
  ),
  0,
  'FF-2: ninguna policy using(true) fuera de la lista blanca de tablas de referencia'
);

select * from finish();
rollback;

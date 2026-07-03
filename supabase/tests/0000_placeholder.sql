-- Placeholder pgTAP: no hay tablas todavía (llegan en T2.1, núcleo de tenancy).
-- Existe para que `supabase test db` tenga un test real que correr en CI (FF-1 se activa recién en T2.1).
begin;
select plan(1);
select pass('placeholder: pipeline de supabase test db funcionando');
select * from finish();
rollback;

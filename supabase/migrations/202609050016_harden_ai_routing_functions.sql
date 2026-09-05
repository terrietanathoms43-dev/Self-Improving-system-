begin;

-- Internal CareBridge functions should never inherit PostgreSQL's default
-- EXECUTE privilege for PUBLIC/anon. Public wrappers grant only the roles
-- that are intended to call their corresponding private workers.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname like 'cbg_%'
  loop
    execute format('revoke execute on function %s from public, anon', fn.signature);
  end loop;
end $$;

-- This legacy entry point predates explicit mandatory/routine/QA routing.
-- Leaving it callable can create an assessment without the review request
-- required by the current review transaction.
revoke execute on function public.cbg_run_assessment_atomic(
  uuid, uuid, smallint, text, numeric, jsonb, jsonb, jsonb, jsonb,
  text, text, jsonb
) from authenticated;
revoke execute on function private.cbg_run_assessment_atomic(
  uuid, uuid, smallint, text, numeric, jsonb, jsonb, jsonb, jsonb,
  text, text, jsonb
) from authenticated;

commit;

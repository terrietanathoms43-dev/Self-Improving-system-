begin;

create or replace function private.cbg_protect_active_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' then
    if not exists (
      select 1
      from public.cbg_deployment_approvals d
      join public.cbg_model_evaluations e
        on e.id = d.evaluation_id
       and e.model_version_id = d.model_version_id
      where d.model_version_id = new.id
        and d.decision = 'approve'
        and d.conflict_of_interest = false
        and e.status = 'passed'
        and coalesce((e.summary ->> 'criteria_met')::boolean, false)
        and coalesce((e.summary ->> 'case_count')::integer, 0) >= 20
        and coalesce((e.summary ->> 'accuracy')::numeric, 0) >= 0.80
        and coalesce((e.summary ->> 'regressions')::integer, 1) = 0
        and coalesce((e.summary ->> 'critical_regressions')::integer, 1) = 0
        and coalesce((e.summary ->> 'subgroup_accuracy_gap')::numeric, 1) <= 0.15
        and (
          new.model_type = 'rules'
          or (
            coalesce((e.summary ->> 'advisory_case_count')::integer, 0) >= 20
            and coalesce((e.summary ->> 'advisory_failures')::integer, 1) = 0
            and coalesce((e.summary ->> 'advisory_pass_rate')::numeric, 0) = 1
            and coalesce((e.summary -> 'gates' ->> 'advisory_validation')::boolean, false)
          )
        )
    ) then
      raise exception 'Exact passed evaluation meeting every production gate is required';
    end if;

    if new.trained_model_id is not null and not exists (
      select 1
      from public.cbg_trained_models m
      where m.id = new.trained_model_id
        and m.status = 'eligible'
        and m.evaluation_id is not null
    ) then
      raise exception 'Linked trained model has not passed governed advisory evaluation';
    end if;

    new.activated_by = (select auth.uid());
    new.activated_at = now();
  end if;
  return new;
end
$$;

commit;

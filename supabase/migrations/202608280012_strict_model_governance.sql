begin;

alter table public.cbg_evaluation_cases add column if not exists subgroup jsonb not null default '{}';

create table public.cbg_trained_models(
  id uuid primary key default gen_random_uuid(),
  training_run_id uuid unique not null references public.cbg_training_runs(id) on delete restrict,
  provider text not null default 'openai' check(provider='openai'),
  provider_model_id text unique not null,
  status text not null default 'registered' check(status in('registered','draft_linked','evaluated','eligible','retired')),
  registered_by uuid not null references public.cbg_users(id),
  registered_at timestamptz not null default now(),
  evaluation_id uuid references public.cbg_model_evaluations(id),
  metadata jsonb not null default '{}'
);
alter table public.cbg_trained_models enable row level security;
create policy cbg_trained_models_read on public.cbg_trained_models for select to authenticated using(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin'));
create policy cbg_trained_models_update on public.cbg_trained_models for update to authenticated using(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) with check(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin'));
grant select,update on public.cbg_trained_models to authenticated;

alter table public.cbg_model_versions
  add column if not exists source_proposal_id uuid unique references public.cbg_policy_proposals(id) on delete restrict,
  add column if not exists trained_model_id uuid unique references public.cbg_trained_models(id) on delete restrict,
  add column if not exists model_type text not null default 'rules' check(model_type in('rules','rules_with_advisory'));

create or replace function private.cbg_protect_active_version() returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='active' then
    if not exists(
      select 1 from public.cbg_deployment_approvals d
      join public.cbg_model_evaluations e on e.id=d.evaluation_id and e.model_version_id=d.model_version_id
      where d.model_version_id=new.id and d.decision='approve' and d.conflict_of_interest=false
        and e.status='passed' and coalesce((e.summary->>'criteria_met')::boolean,false)
        and coalesce((e.summary->>'case_count')::integer,0)>=20
        and coalesce((e.summary->>'accuracy')::numeric,0)>=0.80
        and coalesce((e.summary->>'regressions')::integer,1)=0
        and coalesce((e.summary->>'critical_regressions')::integer,1)=0
        and coalesce((e.summary->>'subgroup_accuracy_gap')::numeric,1)<=0.15
    ) then raise exception 'Exact passed evaluation meeting every production gate is required'; end if;
    if new.trained_model_id is not null and not exists(select 1 from public.cbg_trained_models m where m.id=new.trained_model_id and m.status='eligible') then
      raise exception 'Linked trained model has not passed governed evaluation';
    end if;
    new.activated_by=(select auth.uid()); new.activated_at=now();
  end if;
  return new;
end$$;

create or replace function public.cbg_create_draft_version(p_proposal_id uuid,p_version text,p_rules jsonb,p_change_summary text,p_trained_model_id uuid default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare new_id uuid; active_id uuid; c numeric; h numeric; m numeric;
begin
  if not (private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) then raise exception 'Governance authorization required'; end if;
  if not exists(select 1 from public.cbg_policy_proposals where id=p_proposal_id and status='approved' and committee_decision_by is not null) then raise exception 'An approved proposal is required'; end if;
  if exists(select 1 from public.cbg_model_versions where source_proposal_id=p_proposal_id) then raise exception 'This proposal already has a draft version'; end if;
  if length(p_version)<2 or length(p_change_summary)<20 then raise exception 'Version and change summary are required'; end if;
  c:=coalesce((p_rules->>'critical')::numeric,80); h:=coalesce((p_rules->>'high')::numeric,60); m:=coalesce((p_rules->>'moderate')::numeric,40);
  if c>100 or c<=h or h<=m or m<0 then raise exception 'Thresholds must satisfy 100 >= critical > high > moderate >= 0'; end if;
  if p_trained_model_id is not null and not exists(select 1 from public.cbg_trained_models where id=p_trained_model_id and status='registered') then raise exception 'Only a registered trained model may be linked'; end if;
  select id into active_id from public.cbg_model_versions where status='active';
  insert into public.cbg_model_versions(version,status,rules,change_summary,previous_version_id,source_proposal_id,trained_model_id,model_type,created_by)
  values(p_version,'draft',p_rules,p_change_summary,active_id,p_proposal_id,p_trained_model_id,case when p_trained_model_id is null then 'rules' else 'rules_with_advisory' end,(select auth.uid())) returning id into new_id;
  update public.cbg_policy_proposals set status='implemented',updated_at=now() where id=p_proposal_id;
  if p_trained_model_id is not null then update public.cbg_trained_models set status='draft_linked' where id=p_trained_model_id; end if;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata) values((select auth.uid()),case when private.cbg_has_role('admin') then 'admin'::public.cbg_app_role else 'human_oversight_committee'::public.cbg_app_role end,'draft_version_created','model_version',new_id::text,jsonb_build_object('proposal_id',p_proposal_id,'trained_model_id',p_trained_model_id));
  return new_id;
end$$;

create or replace function public.cbg_activate_version(p_version_id uuid,p_evaluation_id uuid,p_reason text,p_evidence text,p_conflict boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare role_name public.cbg_app_role;
begin
  if not private.cbg_has_role('human_oversight_committee') then raise exception 'Committee authorization required'; end if;
  if p_conflict then raise exception 'A conflicted member cannot approve activation'; end if;
  if length(p_reason)<20 or length(p_evidence)<20 then raise exception 'Reason and evidence are required'; end if;
  if not exists(select 1 from public.cbg_model_evaluations e where e.id=p_evaluation_id and e.model_version_id=p_version_id and e.status='passed' and coalesce((e.summary->>'criteria_met')::boolean,false)) then raise exception 'The selected evaluation does not qualify this exact version'; end if;
  if not exists(select 1 from public.cbg_model_versions v where v.id=p_version_id and v.status='approved') then raise exception 'Only an evaluated and approved version may be activated'; end if;
  role_name := 'human_oversight_committee';
  insert into public.cbg_deployment_approvals(model_version_id,evaluation_id,decision,reason,evidence_considered,conflict_of_interest,approver_id) values(p_version_id,p_evaluation_id,'approve',p_reason,p_evidence,false,(select auth.uid()));
  update public.cbg_model_versions set status='retired',updated_at=now() where status='active' and id<>p_version_id;
  update public.cbg_model_versions set status='active',updated_at=now() where id=p_version_id;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata) values((select auth.uid()),role_name,'rules_version_activated','model_version',p_version_id::text,jsonb_build_object('evaluation_id',p_evaluation_id,'reason',p_reason));
end$$;

revoke all on function public.cbg_create_draft_version(uuid,text,jsonb,text,uuid) from public,anon;
grant execute on function public.cbg_create_draft_version(uuid,text,jsonb,text,uuid) to authenticated;

-- Split broad FOR ALL policies so SELECT has one permissive path per role set.
drop policy if exists versions_manage on public.cbg_model_versions;
create policy versions_insert on public.cbg_model_versions for insert to authenticated with check((private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) and created_by=(select auth.uid()));
create policy versions_update on public.cbg_model_versions for update to authenticated using(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) with check(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin'));
drop policy if exists cbg_evaluation_cases_manage on public.cbg_evaluation_cases;
create policy cbg_evaluation_cases_read on public.cbg_evaluation_cases for select to authenticated using(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin'));
create policy cbg_evaluation_cases_insert on public.cbg_evaluation_cases for insert to authenticated with check((private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) and authorized_by=(select auth.uid()));
create policy cbg_evaluation_cases_update on public.cbg_evaluation_cases for update to authenticated using(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) with check((private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) and authorized_by=(select auth.uid()));

drop policy if exists intake_manage_applications on public.cbg_applications;
create policy intake_insert_applications on public.cbg_applications for insert to authenticated with check(private.cbg_has_role('intake_officer') or private.cbg_has_role('admin'));
create policy intake_update_applications on public.cbg_applications for update to authenticated using(private.cbg_has_role('intake_officer') or private.cbg_has_role('admin')) with check(private.cbg_has_role('intake_officer') or private.cbg_has_role('admin'));
drop policy if exists intake_manage_profiles on public.cbg_applicant_profiles;
create policy intake_insert_profiles on public.cbg_applicant_profiles for insert to authenticated with check(private.cbg_has_role('intake_officer') or private.cbg_has_role('admin'));
create policy intake_update_profiles on public.cbg_applicant_profiles for update to authenticated using(private.cbg_has_role('intake_officer') or private.cbg_has_role('admin')) with check(private.cbg_has_role('intake_officer') or private.cbg_has_role('admin'));
drop policy if exists medical_write on public.cbg_medical_verifications;
create policy medical_insert on public.cbg_medical_verifications for insert to authenticated with check(private.cbg_has_role('medical_verification_officer') or private.cbg_has_role('admin'));
create policy medical_update on public.cbg_medical_verifications for update to authenticated using(private.cbg_has_role('medical_verification_officer') or private.cbg_has_role('admin')) with check(private.cbg_has_role('medical_verification_officer') or private.cbg_has_role('admin'));
drop policy if exists social_write on public.cbg_social_assessments;
create policy social_insert on public.cbg_social_assessments for insert to authenticated with check(private.cbg_has_role('social_financial_assessment_officer') or private.cbg_has_role('admin'));
create policy social_update on public.cbg_social_assessments for update to authenticated using(private.cbg_has_role('social_financial_assessment_officer') or private.cbg_has_role('admin')) with check(private.cbg_has_role('social_financial_assessment_officer') or private.cbg_has_role('admin'));
drop policy if exists appeals_manage on public.cbg_appeals;
create policy appeals_insert on public.cbg_appeals for insert to authenticated with check(private.cbg_has_role('appeals_reviewer') or private.cbg_has_role('admin'));
create policy appeals_update on public.cbg_appeals for update to authenticated using(private.cbg_has_role('appeals_reviewer') or private.cbg_has_role('admin')) with check(private.cbg_has_role('appeals_reviewer') or private.cbg_has_role('admin'));
drop policy if exists alerts_manage on public.cbg_fairness_alerts;
create policy alerts_insert on public.cbg_fairness_alerts for insert to authenticated with check(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin'));
create policy alerts_update on public.cbg_fairness_alerts for update to authenticated using(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) with check(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin'));
drop policy if exists cbg_admin_manage_users on public.cbg_users;
create policy cbg_admin_insert_users on public.cbg_users for insert to authenticated with check(private.cbg_has_role('admin'));
create policy cbg_admin_update_users on public.cbg_users for update to authenticated using(private.cbg_has_role('admin')) with check(private.cbg_has_role('admin'));
drop policy if exists cbg_admin_manage_user_roles on public.cbg_user_roles;
create policy cbg_admin_insert_user_roles on public.cbg_user_roles for insert to authenticated with check(private.cbg_has_role('admin'));
create policy cbg_admin_update_user_roles on public.cbg_user_roles for update to authenticated using(private.cbg_has_role('admin')) with check(private.cbg_has_role('admin'));

commit;

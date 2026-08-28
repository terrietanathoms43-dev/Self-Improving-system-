begin;

create table public.cbg_export_logs(
  id uuid primary key default gen_random_uuid(),
  export_type text not null check(export_type in('fairness_aggregate','audit_summary','performance_aggregate')),
  filters jsonb not null default '{}',
  row_count integer not null default 0 check(row_count >= 0),
  requested_by uuid not null references public.cbg_users(id),
  requested_at timestamptz not null default now()
);

create table public.cbg_retention_reviews(
  id uuid primary key default gen_random_uuid(),
  application_id uuid unique not null references public.cbg_applications(id) on delete restrict,
  retention_until date not null,
  legal_hold boolean not null,
  status text not null default 'pending' check(status in('pending','extended','approved_for_disposition','retained')),
  decision_reason text,
  reviewed_by uuid references public.cbg_users(id),
  reviewed_at timestamptz,
  extended_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cbg_export_logs_requester_idx on public.cbg_export_logs(requested_by,requested_at desc);
create index cbg_retention_reviews_status_idx on public.cbg_retention_reviews(status,retention_until);
alter table public.cbg_export_logs enable row level security;
alter table public.cbg_retention_reviews enable row level security;
create policy cbg_exports_admin_read on public.cbg_export_logs for select to authenticated using(private.cbg_has_role('admin'));
create policy cbg_exports_create on public.cbg_export_logs for insert to authenticated with check(requested_by=(select auth.uid()) and (private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')));
create policy cbg_retention_admin_manage on public.cbg_retention_reviews for all to authenticated using(private.cbg_has_role('admin')) with check(private.cbg_has_role('admin'));
grant select,insert on public.cbg_export_logs to authenticated;
grant select,insert,update on public.cbg_retention_reviews to authenticated;
revoke delete on public.cbg_export_logs,public.cbg_retention_reviews from authenticated;

create function public.cbg_create_application_atomic(
  p_reference text,p_parish text,p_rural boolean,p_consent_version text,p_retention_until date,
  p_full_name text,p_date_of_birth date,p_phone text,p_address text,p_gender text,
  p_disability boolean,p_insurance text,p_employment text,p_caregiving boolean,p_welfare boolean
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_actor uuid := (select auth.uid()); v_role public.cbg_app_role;
begin
  if not (private.cbg_has_role('intake_officer') or private.cbg_has_role('admin')) then raise exception 'Not authorized'; end if;
  if length(p_full_name)<2 or p_consent_version is null then raise exception 'Required fields are missing'; end if;
  v_role := case when private.cbg_has_role('admin') then 'admin'::public.cbg_app_role else 'intake_officer'::public.cbg_app_role end;
  insert into public.cbg_applications(reference_number,parish,rural,consent_status,consent_recorded_at,consent_version,status,created_by,updated_by,retention_until)
  values(p_reference,p_parish,p_rural,'granted',now(),p_consent_version,'medical_verification',v_actor,v_actor,p_retention_until) returning id into v_id;
  insert into public.cbg_applicant_profiles(application_id,full_name,date_of_birth,phone,address,gender,disability_status,insurance_status,employment_status,caregiving_responsibilities,existing_welfare_support,created_by,updated_by)
  values(v_id,p_full_name,p_date_of_birth,nullif(p_phone,''),nullif(p_address,''),nullif(p_gender,''),p_disability,nullif(p_insurance,''),nullif(p_employment,''),p_caregiving,p_welfare,v_actor,v_actor);
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata) values(v_actor,v_role,'application_created','application',v_id::text,jsonb_build_object('reference',p_reference,'consent_version',p_consent_version));
  return v_id;
end$$;

create function public.cbg_submit_appeal_atomic(p_application_id uuid,p_reason text,p_evidence text) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_actor uuid := (select auth.uid()); v_role public.cbg_app_role;
begin
  if not (private.cbg_has_role('appeals_reviewer') or private.cbg_has_role('case_review_committee') or private.cbg_has_role('admin')) then raise exception 'Not authorized'; end if;
  v_role := case when private.cbg_has_role('admin') then 'admin'::public.cbg_app_role when private.cbg_has_role('appeals_reviewer') then 'appeals_reviewer'::public.cbg_app_role else 'case_review_committee'::public.cbg_app_role end;
  insert into public.cbg_appeals(application_id,reason,evidence,created_by) values(p_application_id,p_reason,case when nullif(p_evidence,'') is null then '[]'::jsonb else jsonb_build_array(p_evidence) end,v_actor) returning id into v_id;
  update public.cbg_applications set status='appealed',updated_by=v_actor,updated_at=now() where id=p_application_id;
  if not found then raise exception 'Application not found'; end if;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata) values(v_actor,v_role,'appeal_submitted','appeal',v_id::text,jsonb_build_object('application_id',p_application_id));
  return v_id;
end$$;

create function public.cbg_refresh_retention_reviews() returns integer language plpgsql security invoker set search_path='' as $$
declare v_count integer;
begin
  if not private.cbg_has_role('admin') then raise exception 'Administrator authorization required'; end if;
  insert into public.cbg_retention_reviews(application_id,retention_until,legal_hold)
  select a.id,a.retention_until,a.legal_hold from public.cbg_applications a
  where a.retention_until is not null and a.retention_until<=current_date+interval '90 days'
  on conflict(application_id) do update set retention_until=excluded.retention_until,legal_hold=excluded.legal_hold,updated_at=now()
  where public.cbg_retention_reviews.status='pending';
  get diagnostics v_count = row_count;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,metadata) values((select auth.uid()),'admin','retention_queue_refreshed','retention_review',jsonb_build_object('affected',v_count));
  return v_count;
end$$;

revoke all on function public.cbg_create_application_atomic(text,text,boolean,text,date,text,date,text,text,text,boolean,text,text,boolean,boolean) from public,anon;
revoke all on function public.cbg_submit_appeal_atomic(uuid,text,text) from public,anon;
revoke all on function public.cbg_refresh_retention_reviews() from public,anon;
grant execute on function public.cbg_create_application_atomic(text,text,boolean,text,date,text,date,text,text,text,boolean,text,text,boolean,boolean) to authenticated;
grant execute on function public.cbg_submit_appeal_atomic(uuid,text,text) to authenticated;
grant execute on function public.cbg_refresh_retention_reviews() to authenticated;
commit;

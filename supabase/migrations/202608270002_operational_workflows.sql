begin;

alter table public.cbg_applications
  add column if not exists due_at timestamptz,
  add column if not exists delay_reason text;

create table if not exists public.cbg_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.cbg_applications(id) on delete cascade,
  storage_path text unique not null,
  original_name text not null,
  document_type text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text not null,
  uploaded_by uuid not null references public.cbg_users(id),
  retention_until date,
  created_at timestamptz not null default now()
);

create table if not exists public.cbg_evaluation_cases (
  id uuid primary key default gen_random_uuid(),
  dataset_name text not null,
  dataset_version text not null,
  case_reference_hash text not null,
  input_snapshot jsonb not null,
  expected_category text not null,
  authorized_by uuid not null references public.cbg_users(id),
  created_at timestamptz not null default now(),
  unique(dataset_name,dataset_version,case_reference_hash)
);

create table if not exists public.cbg_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.cbg_users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cbg_rate_limits (
  key_hash text not null,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check(request_count > 0),
  primary key(key_hash,action,window_start)
);

create table if not exists public.cbg_error_events (
  id bigint generated always as identity primary key,
  event_id uuid unique not null default gen_random_uuid(),
  actor_id uuid references public.cbg_users(id),
  route text not null,
  operation text not null,
  error_code text not null,
  safe_message text not null,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create index if not exists cbg_documents_application_idx on public.cbg_documents(application_id,created_at desc);
create index if not exists cbg_notifications_user_idx on public.cbg_notifications(user_id,read_at,created_at desc);
create index if not exists cbg_error_events_time_idx on public.cbg_error_events(occurred_at desc);

alter table public.cbg_documents enable row level security;
alter table public.cbg_evaluation_cases enable row level security;
alter table public.cbg_notifications enable row level security;
alter table public.cbg_rate_limits enable row level security;
alter table public.cbg_error_events enable row level security;

-- The rate-limit ledger is server-maintained. This explicit deny policy keeps
-- it invisible through the Data API while satisfying the RLS policy contract.
create policy cbg_rate_limits_no_direct_access on public.cbg_rate_limits for all to authenticated using(false) with check(false);

create policy cbg_documents_read on public.cbg_documents for select to authenticated using(private.cbg_is_case_worker());
create policy cbg_documents_create on public.cbg_documents for insert to authenticated with check(uploaded_by=(select auth.uid()) and (private.cbg_has_role('intake_officer') or private.cbg_has_role('medical_verification_officer') or private.cbg_has_role('social_financial_assessment_officer') or private.cbg_has_role('admin')));
create policy cbg_evaluation_cases_manage on public.cbg_evaluation_cases for all to authenticated using(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) with check((private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) and authorized_by=(select auth.uid()));
create policy cbg_notifications_own on public.cbg_notifications for select to authenticated using(user_id=(select auth.uid()));
create policy cbg_notifications_update_own on public.cbg_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy cbg_errors_admin_read on public.cbg_error_events for select to authenticated using(private.cbg_has_role('admin'));
create policy cbg_errors_insert on public.cbg_error_events for insert to authenticated with check(actor_id=(select auth.uid()));

create function public.cbg_take_rate_limit(p_key_hash text,p_action text,p_limit integer,p_window_seconds integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare bucket timestamptz; current_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then raise exception 'Invalid rate limit'; end if;
  bucket := to_timestamp(floor(extract(epoch from now())/p_window_seconds)*p_window_seconds);
  insert into public.cbg_rate_limits(key_hash,action,window_start,request_count)
  values(p_key_hash,p_action,bucket,1)
  on conflict(key_hash,action,window_start) do update set request_count=public.cbg_rate_limits.request_count+1
  returning request_count into current_count;
  return current_count <= p_limit;
end $$;

create function public.cbg_refresh_correction_patterns() returns integer
language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
  if not (private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) then raise exception 'Not authorized'; end if;
  insert into public.cbg_correction_patterns(correction_category,occurrence_count,first_seen_at,last_seen_at,status,analysis)
  select category,count(*)::integer,min(created_at),max(created_at),'observed',jsonb_build_object('generated',true,'threshold',3)
  from public.cbg_human_corrections where category <> 'ai_correct' group by category having count(*) >= 3
  on conflict do nothing;
  get diagnostics changed = row_count;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,metadata)
  values((select auth.uid()),case when private.cbg_has_role('admin') then 'admin'::public.cbg_app_role else 'human_oversight_committee'::public.cbg_app_role end,'correction_patterns_refreshed','correction_pattern',jsonb_build_object('created',changed));
  return changed;
end $$;

create function public.cbg_activate_version(p_version_id uuid,p_evaluation_id uuid,p_reason text,p_evidence text,p_conflict boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare role_name public.cbg_app_role;
begin
  if not private.cbg_has_role('human_oversight_committee') then raise exception 'Committee authorization required'; end if;
  if p_conflict then raise exception 'A conflicted member cannot approve activation'; end if;
  if length(p_reason)<20 or length(p_evidence)<20 then raise exception 'Reason and evidence are required'; end if;
  role_name := 'human_oversight_committee';
  insert into public.cbg_deployment_approvals(model_version_id,evaluation_id,decision,reason,evidence_considered,conflict_of_interest,approver_id)
  values(p_version_id,p_evaluation_id,'approve',p_reason,p_evidence,false,(select auth.uid()));
  update public.cbg_model_versions set status='retired',updated_at=now() where status='active' and id<>p_version_id;
  update public.cbg_model_versions set status='active',updated_at=now() where id=p_version_id;
  if not found then raise exception 'Version not found'; end if;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata)
  values((select auth.uid()),role_name,'rules_version_activated','model_version',p_version_id::text,jsonb_build_object('evaluation_id',p_evaluation_id,'reason',p_reason));
end $$;

create function public.cbg_rollback_version(p_current_id uuid,p_target_id uuid,p_reason text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if not private.cbg_has_role('human_oversight_committee') then raise exception 'Committee authorization required'; end if;
  if length(p_reason)<20 then raise exception 'A rollback reason is required'; end if;
  update public.cbg_model_versions set status='rolled_back',updated_at=now() where id=p_current_id and status='active';
  update public.cbg_model_versions set status='active',rollback_of=p_current_id,updated_at=now() where id=p_target_id and status in('retired','approved');
  if not found then raise exception 'Rollback target is not eligible'; end if;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata)
  values((select auth.uid()),'human_oversight_committee','rules_version_rolled_back','model_version',p_target_id::text,jsonb_build_object('from',p_current_id,'reason',p_reason));
end $$;

create function private.cbg_document_path_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if new.storage_path not like new.application_id::text || '/%' then raise exception 'Document path must be scoped to its application'; end if;
  return new;
end $$;
create trigger cbg_document_path_guard before insert or update on public.cbg_documents for each row execute function private.cbg_document_path_guard();

grant select,insert on public.cbg_documents,public.cbg_evaluation_cases,public.cbg_error_events to authenticated;
grant select,update on public.cbg_notifications to authenticated;
grant select,insert,update on public.cbg_rate_limits to authenticated;
grant usage,select on sequence public.cbg_error_events_id_seq to authenticated;
revoke all on function public.cbg_take_rate_limit(text,text,integer,integer),public.cbg_refresh_correction_patterns(),public.cbg_activate_version(uuid,uuid,text,text,boolean),public.cbg_rollback_version(uuid,uuid,text) from public,anon;
grant execute on function public.cbg_take_rate_limit(text,text,integer,integer),public.cbg_refresh_correction_patterns(),public.cbg_activate_version(uuid,uuid,text,text,boolean),public.cbg_rollback_version(uuid,uuid,text) to authenticated;

commit;

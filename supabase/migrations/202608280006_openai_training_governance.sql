-- Controlled, de-identified OpenAI training lifecycle. Existing schemas are untouched.
create table public.cbg_training_datasets(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  status text not null default 'draft' check(status in('draft','ready','approved','rejected','submitted','archived')),
  example_count integer not null check(example_count >= 0),
  content_hash text not null,
  storage_path text unique not null,
  deidentification_version text not null default 'v1',
  filters jsonb not null default '{}',
  created_by uuid not null references public.cbg_users(id),
  approved_by uuid references public.cbg_users(id),
  approved_at timestamptz,
  approval_reason text,
  conflict_of_interest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(name,version)
);

create table public.cbg_training_runs(
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.cbg_training_datasets(id) on delete restrict,
  provider text not null default 'openai' check(provider='openai'),
  base_model text not null,
  provider_file_id text,
  provider_job_id text unique,
  output_model text,
  status text not null default 'approved' check(status in('approved','uploading','queued','running','succeeded','failed','cancelled','unavailable')),
  safe_error text,
  requested_by uuid not null references public.cbg_users(id),
  approved_by uuid not null references public.cbg_users(id),
  approval_reason text not null,
  conflicts_declared text not null,
  approved_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  evaluation_id uuid references public.cbg_model_evaluations(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cbg_training_events(
  id bigint generated always as identity primary key,
  training_run_id uuid not null references public.cbg_training_runs(id) on delete cascade,
  provider_event_id text,
  level text not null default 'info' check(level in('info','warning','error')),
  message text not null,
  occurred_at timestamptz not null default now()
);

create index cbg_training_datasets_status_idx on public.cbg_training_datasets(status,created_at desc);
create index cbg_training_runs_status_idx on public.cbg_training_runs(status,created_at desc);
create index cbg_training_runs_dataset_idx on public.cbg_training_runs(dataset_id);
create index cbg_training_runs_approver_idx on public.cbg_training_runs(approved_by);
create index cbg_training_runs_requester_idx on public.cbg_training_runs(requested_by);
create index cbg_training_runs_evaluation_idx on public.cbg_training_runs(evaluation_id);
create index cbg_training_events_run_idx on public.cbg_training_events(training_run_id,occurred_at desc);

alter table public.cbg_training_datasets enable row level security;
alter table public.cbg_training_runs enable row level security;
alter table public.cbg_training_events enable row level security;

create policy cbg_training_datasets_governance on public.cbg_training_datasets for all to authenticated
  using(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin'))
  with check((private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) and created_by=(select auth.uid()));
create policy cbg_training_runs_read on public.cbg_training_runs for select to authenticated
  using(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin'));
create policy cbg_training_runs_create on public.cbg_training_runs for insert to authenticated
  with check(private.cbg_has_role('human_oversight_committee') and requested_by=(select auth.uid()) and approved_by=(select auth.uid()));
create policy cbg_training_runs_update on public.cbg_training_runs for update to authenticated
  using(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin'))
  with check(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin'));
create policy cbg_training_events_read on public.cbg_training_events for select to authenticated
  using(private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cbg-training-datasets','cbg-training-datasets',false,5242880,array['application/json','application/jsonl','text/plain'])
on conflict(id) do nothing;
create policy cbg_training_objects_read on storage.objects for select to authenticated
  using(bucket_id='cbg-training-datasets' and (private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')));

grant select,insert,update on public.cbg_training_datasets,public.cbg_training_runs to authenticated;
grant select on public.cbg_training_events to authenticated;
grant usage,select on sequence public.cbg_training_events_id_seq to authenticated;
revoke delete on public.cbg_training_datasets,public.cbg_training_runs,public.cbg_training_events from authenticated;

create function private.cbg_validate_training_governance() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.cbg_training_datasets d where d.id=new.dataset_id and d.status='approved' and d.approved_by is not null and d.conflict_of_interest=false) then
    raise exception 'An approved, conflict-free training dataset is required';
  end if;
  if length(new.approval_reason)<20 or length(new.conflicts_declared)<3 then raise exception 'Training approval evidence is incomplete'; end if;
  return new;
end$$;
create trigger cbg_enforce_training_governance before insert on public.cbg_training_runs for each row execute function private.cbg_validate_training_governance();

create function private.cbg_block_training_auto_activation() returns trigger language plpgsql set search_path='' as $$
begin
  if new.output_model is distinct from old.output_model and new.status <> 'succeeded' then raise exception 'Only a completed provider job may register an output model'; end if;
  if new.evaluation_id is not null and new.status <> 'succeeded' then raise exception 'Only completed training may be linked to evaluation'; end if;
  return new;
end$$;
create trigger cbg_block_training_auto_activation before update on public.cbg_training_runs for each row execute function private.cbg_block_training_auto_activation();

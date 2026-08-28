begin;

create table public.cbg_user_preferences(
  user_id uuid primary key references public.cbg_users(id) on delete cascade,
  onboarding_version integer not null default 0 check(onboarding_version >= 0),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cbg_user_preferences enable row level security;
create policy cbg_preferences_own_read on public.cbg_user_preferences for select to authenticated
using(user_id=(select auth.uid()));
create policy cbg_preferences_own_insert on public.cbg_user_preferences for insert to authenticated
with check(user_id=(select auth.uid()));
create policy cbg_preferences_own_update on public.cbg_user_preferences for update to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update on public.cbg_user_preferences to authenticated;
revoke delete on public.cbg_user_preferences from authenticated;

commit;

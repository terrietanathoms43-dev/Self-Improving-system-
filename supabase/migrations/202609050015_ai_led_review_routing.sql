begin;

alter table public.cbg_ai_assessments drop constraint if exists cbg_ai_assessments_requires_human_review_check;

create table public.cbg_review_requests(
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.cbg_applications(id) on delete restrict,
  ai_assessment_id uuid not null references public.cbg_ai_assessments(id) on delete restrict,
  review_type text not null check(review_type in('mandatory','discretionary','quality_assurance')),
  status text not null default 'queued' check(status in('queued','in_review','completed','cancelled')),
  rationale text not null check(length(trim(rationale))>=10),
  requested_by uuid references public.cbg_users(id),
  assigned_to uuid references public.cbg_users(id),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'
);
create unique index cbg_one_open_review_request on public.cbg_review_requests(ai_assessment_id) where status in('queued','in_review');
create index cbg_review_requests_queue_idx on public.cbg_review_requests(status,review_type,requested_at);
alter table public.cbg_review_requests enable row level security;
create policy cbg_review_requests_read on public.cbg_review_requests for select to authenticated using(private.cbg_is_case_worker());
create policy cbg_review_requests_insert on public.cbg_review_requests for insert to authenticated with check((private.cbg_has_role('case_review_committee') or private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) and (requested_by=(select auth.uid()) or requested_by is null));
create policy cbg_review_requests_update on public.cbg_review_requests for update to authenticated using(private.cbg_has_role('case_review_committee') or private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin')) with check(private.cbg_has_role('case_review_committee') or private.cbg_has_role('human_oversight_committee') or private.cbg_has_role('admin'));
grant select,insert,update on public.cbg_review_requests to authenticated;

insert into public.cbg_review_requests(application_id,ai_assessment_id,review_type,rationale,requested_by,metadata)
select a.id,x.id,'mandatory','Existing case was already awaiting human review when AI-led routing was introduced.',null,jsonb_build_object('migration_backfill',true)
from public.cbg_applications a join lateral(select aa.id from public.cbg_ai_assessments aa where aa.application_id=a.id order by aa.created_at desc,aa.id desc limit 1)x on true
where a.status='human_review' and not exists(select 1 from public.cbg_final_decisions d where d.application_id=a.id)
and not exists(select 1 from public.cbg_review_requests r where r.ai_assessment_id=x.id and r.status in('queued','in_review'));

create function public.cbg_run_assessment_routed(p_application_id uuid,p_model_version_id uuid,p_score smallint,p_category text,p_confidence numeric,p_reasons jsonb,p_risk_factors jsonb,p_missing_information jsonb,p_fairness_warnings jsonb,p_recommended_action text,p_review_pathway text,p_input_snapshot jsonb,p_review_type text,p_review_rationale text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_role public.cbg_app_role;v_id uuid;v_required boolean:=p_review_type in('mandatory','quality_assurance');
begin
  if private.cbg_has_role('case_review_committee') then v_role:='case_review_committee';elsif private.cbg_has_role('human_oversight_committee') then v_role:='human_oversight_committee';elsif private.cbg_has_role('admin') then v_role:='admin';else raise exception 'Assessment authorization required';end if;
  if p_review_type not in('mandatory','quality_assurance','routine') then raise exception 'Invalid review route';end if;
  if p_score not between 0 and 100 or p_confidence not between 0 and 100 then raise exception 'Invalid assessment output';end if;
  if not exists(select 1 from public.cbg_model_versions where id=p_model_version_id and status='active') then raise exception 'Active model version required';end if;
  if not exists(select 1 from public.cbg_applications where id=p_application_id and status in('assessment_ready','human_review','decision_pending')) then raise exception 'Case is not ready for assessment';end if;
  insert into public.cbg_ai_assessments(application_id,model_version_id,score,category,confidence,reasons,risk_factors,missing_information,fairness_warnings,recommended_action,review_pathway,requires_human_review,input_snapshot,created_by)
  values(p_application_id,p_model_version_id,p_score,p_category,p_confidence,p_reasons,p_risk_factors,p_missing_information,p_fairness_warnings,p_recommended_action,p_review_pathway,v_required,p_input_snapshot,v_actor) returning id into v_id;
  if v_required then insert into public.cbg_review_requests(application_id,ai_assessment_id,review_type,rationale,requested_by,metadata) values(p_application_id,v_id,p_review_type,p_review_rationale,null,jsonb_build_object('system_routed',true));end if;
  update public.cbg_applications set status=case when v_required then 'human_review'::public.cbg_application_status else 'decision_pending'::public.cbg_application_status end,updated_by=v_actor,updated_at=now() where id=p_application_id;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata) values(v_actor,v_role,'ai_assessment_routed','application',p_application_id::text,jsonb_build_object('assessment_id',v_id,'review_type',p_review_type,'requires_human_review',v_required));return v_id;
end$$;

create function public.cbg_request_discretionary_review(p_application_id uuid,p_assessment_id uuid,p_rationale text) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_role public.cbg_app_role;v_id uuid;
begin
 if private.cbg_has_role('case_review_committee') then v_role:='case_review_committee';elsif private.cbg_has_role('human_oversight_committee') then v_role:='human_oversight_committee';elsif private.cbg_has_role('admin') then v_role:='admin';else raise exception 'Review authorization required';end if;
 if length(trim(p_rationale))<10 then raise exception 'A review rationale is required';end if;
 if not exists(select 1 from public.cbg_ai_assessments where id=p_assessment_id and application_id=p_application_id) or exists(select 1 from public.cbg_final_decisions where application_id=p_application_id) then raise exception 'Case is not eligible for discretionary review';end if;
 insert into public.cbg_review_requests(application_id,ai_assessment_id,review_type,rationale,requested_by) values(p_application_id,p_assessment_id,'discretionary',trim(p_rationale),v_actor) returning id into v_id;
 update public.cbg_applications set status='human_review',updated_by=v_actor,updated_at=now() where id=p_application_id;
 insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata) values(v_actor,v_role,'discretionary_review_requested','application',p_application_id::text,jsonb_build_object('assessment_id',p_assessment_id,'review_request_id',v_id,'rationale',trim(p_rationale)));return v_id;
end$$;

create function private.cbg_require_review_request() returns trigger language plpgsql set search_path='' as $$begin if not exists(select 1 from public.cbg_review_requests where ai_assessment_id=new.ai_assessment_id and application_id=new.application_id and status in('queued','in_review')) then raise exception 'An active review request is required';end if;return new;end$$;
create trigger cbg_require_review_request before insert on public.cbg_human_reviews for each row execute function private.cbg_require_review_request();
create function private.cbg_complete_review_request() returns trigger language plpgsql set search_path='' as $$begin update public.cbg_review_requests set status='completed',completed_at=now(),assigned_to=new.reviewer_id where ai_assessment_id=new.ai_assessment_id and status in('queued','in_review');return new;end$$;
create trigger cbg_complete_review_request after insert on public.cbg_human_reviews for each row execute function private.cbg_complete_review_request();

revoke all on function public.cbg_run_assessment_routed(uuid,uuid,smallint,text,numeric,jsonb,jsonb,jsonb,jsonb,text,text,jsonb,text,text),public.cbg_request_discretionary_review(uuid,uuid,text) from public,anon;
grant execute on function public.cbg_run_assessment_routed(uuid,uuid,smallint,text,numeric,jsonb,jsonb,jsonb,jsonb,text,text,jsonb,text,text),public.cbg_request_discretionary_review(uuid,uuid,text) to authenticated;
commit;

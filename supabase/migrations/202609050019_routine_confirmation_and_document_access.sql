begin;

create or replace function private.cbg_require_review_request()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if exists(
    select 1
    from public.cbg_review_requests
    where ai_assessment_id=new.ai_assessment_id
      and application_id=new.application_id
      and status in('queued','in_review')
  ) then
    return new;
  end if;

  if new.disposition='agree'
    and exists(
      select 1
      from public.cbg_ai_assessments a
      join public.cbg_applications p on p.id=a.application_id
      where a.id=new.ai_assessment_id
        and a.application_id=new.application_id
        and a.requires_human_review=false
        and p.status='decision_pending'
    ) then
    return new;
  end if;

  raise exception 'An active review request is required';
end
$$;

create function private.cbg_confirm_routine_decision(
  p_application_id uuid,
  p_assessment_id uuid,
  p_decision public.cbg_decision_kind,
  p_note text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.cbg_app_role;
  v_review_id uuid;
  v_assessment public.cbg_ai_assessments%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if private.cbg_has_role('case_review_committee') then
    v_role := 'case_review_committee';
  elsif private.cbg_has_role('admin') then
    v_role := 'admin';
  else
    raise exception 'Routine confirmation authorization required';
  end if;

  if p_decision not in ('approve','refer') then
    raise exception 'Modification or rejection requires full human reassessment';
  end if;
  if length(trim(p_note)) < 20 then
    raise exception 'A meaningful safety confirmation note is required';
  end if;
  if exists(select 1 from public.cbg_final_decisions where application_id=p_application_id) then
    raise exception 'A final decision already exists';
  end if;

  select * into v_assessment
  from public.cbg_ai_assessments
  where id=p_assessment_id and application_id=p_application_id;
  if not found or v_assessment.requires_human_review then
    raise exception 'This assessment requires full human reassessment';
  end if;
  if p_assessment_id <> (
    select id from public.cbg_ai_assessments
    where application_id=p_application_id
    order by created_at desc,id desc limit 1
  ) then
    raise exception 'Only the latest assessment may be confirmed';
  end if;
  if not exists(
    select 1 from public.cbg_applications
    where id=p_application_id and status='decision_pending'
  ) then
    raise exception 'Case is not awaiting routine confirmation';
  end if;

  insert into public.cbg_human_reviews(
    application_id,ai_assessment_id,reviewer_id,reviewer_role,disposition,
    proposed_decision,final_score,final_category,evidence_considered,explanation
  ) values(
    p_application_id,p_assessment_id,v_actor,v_role,'agree',p_decision,
    v_assessment.score,v_assessment.category,
    'Routine safety confirmation of the verified assessment record.',trim(p_note)
  ) returning id into v_review_id;

  insert into public.cbg_final_decisions(
    application_id,human_review_id,decision,explanation,decided_by
  ) values(p_application_id,v_review_id,p_decision,trim(p_note),v_actor);
  insert into public.cbg_human_corrections(
    application_id,human_review_id,category,override_reason,created_by
  ) values(p_application_id,v_review_id,'ai_correct',trim(p_note),v_actor);
  update public.cbg_applications
  set status='decided',updated_by=v_actor,updated_at=now()
  where id=p_application_id;
  insert into public.cbg_audit_logs(
    actor_id,actor_role,action,entity_type,entity_id,metadata
  ) values(
    v_actor,v_role,'routine_decision_confirmed','application',p_application_id::text,
    jsonb_build_object('assessment_id',p_assessment_id,'review_id',v_review_id,'decision',p_decision)
  );
  return v_review_id;
end
$$;

create function public.cbg_confirm_routine_decision(
  p_application_id uuid,
  p_assessment_id uuid,
  p_decision public.cbg_decision_kind,
  p_note text
) returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.cbg_confirm_routine_decision(
    p_application_id,p_assessment_id,p_decision,p_note
  )
$$;

revoke all on function private.cbg_confirm_routine_decision(uuid,uuid,public.cbg_decision_kind,text) from public,anon;
revoke all on function public.cbg_confirm_routine_decision(uuid,uuid,public.cbg_decision_kind,text) from public,anon;
grant execute on function private.cbg_confirm_routine_decision(uuid,uuid,public.cbg_decision_kind,text) to authenticated;
grant execute on function public.cbg_confirm_routine_decision(uuid,uuid,public.cbg_decision_kind,text) to authenticated;

create function private.cbg_can_read_case_document(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select (select auth.uid()) is not null and (
    private.cbg_has_role('admin')
    or exists(
      select 1 from public.cbg_applications a
      where a.id=p_application_id and (
        a.assigned_to=(select auth.uid())
        or (
          private.cbg_has_role('intake_officer')
          and a.created_by=(select auth.uid())
        )
        or (
          private.cbg_has_role('medical_verification_officer')
          and exists(
            select 1 from public.cbg_medical_verifications m
            where m.application_id=a.id and m.verified_by=(select auth.uid())
          )
        )
        or (
          private.cbg_has_role('social_financial_assessment_officer')
          and exists(
            select 1 from public.cbg_social_assessments s
            where s.application_id=a.id and s.assessed_by=(select auth.uid())
          )
        )
        or (
          private.cbg_has_role('case_review_committee')
          and exists(
            select 1 from public.cbg_review_requests r
            where r.application_id=a.id and r.status in('queued','in_review')
          )
        )
        or (
          private.cbg_has_role('appeals_reviewer')
          and exists(
            select 1 from public.cbg_appeals p
            where p.application_id=a.id
              and p.status in('open','under_review')
              and (p.assigned_to=(select auth.uid()) or p.assigned_to is null)
          )
        )
      )
    )
  )
$$;

revoke all on function private.cbg_can_read_case_document(uuid) from public,anon;
grant execute on function private.cbg_can_read_case_document(uuid) to authenticated;

drop policy if exists cbg_documents_read on public.cbg_documents;
create policy cbg_documents_read on public.cbg_documents
for select to authenticated
using(private.cbg_can_read_case_document(application_id));

drop policy if exists cbg_case_document_read on storage.objects;
create policy cbg_case_document_read on storage.objects
for select to authenticated
using(
  bucket_id='cbg-case-documents'
  and exists(
    select 1 from public.cbg_documents d
    where d.storage_path=storage.objects.name
      and private.cbg_can_read_case_document(d.application_id)
  )
);

commit;

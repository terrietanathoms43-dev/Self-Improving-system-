begin;

create or replace function public.cbg_run_assessment_atomic(p_application_id uuid,p_model_version_id uuid,p_score smallint,p_category text,p_confidence numeric,p_reasons jsonb,p_risk_factors jsonb,p_missing_information jsonb,p_fairness_warnings jsonb,p_recommended_action text,p_review_pathway text,p_input_snapshot jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_role public.cbg_app_role; v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if private.cbg_has_role('case_review_committee') then v_role := 'case_review_committee'; elsif private.cbg_has_role('human_oversight_committee') then v_role := 'human_oversight_committee'; elsif private.cbg_has_role('admin') then v_role := 'admin'; else raise exception 'Not authorized to run assessments'; end if;
  if p_score not between 0 and 100 or p_confidence not between 0 and 100 or p_category not in ('critical','high','moderate','standard') then raise exception 'Invalid assessment result'; end if;
  if not exists(select 1 from public.cbg_model_versions where id=p_model_version_id and status='active') then raise exception 'An active rules version is required'; end if;
  if not exists(select 1 from public.cbg_applications where id=p_application_id and status in ('assessment_ready','human_review')) then raise exception 'Case is not ready for assessment'; end if;
  insert into public.cbg_ai_assessments(application_id,model_version_id,score,category,confidence,reasons,risk_factors,missing_information,fairness_warnings,recommended_action,review_pathway,requires_human_review,input_snapshot,created_by)
  values(p_application_id,p_model_version_id,p_score,p_category,p_confidence,coalesce(p_reasons,'[]'::jsonb),coalesce(p_risk_factors,'[]'::jsonb),coalesce(p_missing_information,'[]'::jsonb),coalesce(p_fairness_warnings,'[]'::jsonb),p_recommended_action,p_review_pathway,true,coalesce(p_input_snapshot,'{}'::jsonb),v_actor) returning id into v_id;
  update public.cbg_applications set status='human_review',updated_by=v_actor,updated_at=now() where id=p_application_id;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata) values(v_actor,v_role,'ai_assessment_created','application',p_application_id::text,jsonb_build_object('assessment_id',v_id,'model_version_id',p_model_version_id));
  return v_id;
end$$;
revoke all on function public.cbg_run_assessment_atomic(uuid,uuid,smallint,text,numeric,jsonb,jsonb,jsonb,jsonb,text,text,jsonb) from public,anon;
grant execute on function public.cbg_run_assessment_atomic(uuid,uuid,smallint,text,numeric,jsonb,jsonb,jsonb,jsonb,text,text,jsonb) to authenticated;

create or replace function public.cbg_submit_human_review(p_application_id uuid,p_assessment_id uuid,p_disposition text,p_decision public.cbg_decision_kind,p_final_score smallint,p_final_category text,p_evidence text,p_explanation text,p_correction_category text,p_reviewer_role public.cbg_app_role) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_role public.cbg_app_role; v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if private.cbg_has_role('case_review_committee') then v_role := 'case_review_committee'; elsif private.cbg_has_role('appeals_reviewer') then v_role := 'appeals_reviewer'; elsif private.cbg_has_role('admin') then v_role := 'admin'; else raise exception 'Not authorized to make case decisions'; end if;
  if p_disposition not in ('agree','modify','override') or p_final_score not between 0 and 100 or p_final_category not in ('critical','high','moderate','standard') then raise exception 'Invalid review decision'; end if;
  if length(trim(p_evidence))<20 or length(trim(p_explanation))<20 then raise exception 'Evidence and explanation are required'; end if;
  if (p_disposition='agree' and p_correction_category<>'ai_correct') or (p_disposition in ('modify','override') and p_correction_category='ai_correct') then raise exception 'Correction category does not match the review result'; end if;
  if not exists(select 1 from public.cbg_ai_assessments where id=p_assessment_id and application_id=p_application_id) then raise exception 'Assessment does not belong to this application'; end if;
  if exists(select 1 from public.cbg_final_decisions where application_id=p_application_id) then raise exception 'A final decision already exists'; end if;
  insert into public.cbg_human_reviews(application_id,ai_assessment_id,reviewer_id,reviewer_role,disposition,proposed_decision,final_score,final_category,evidence_considered,explanation) values(p_application_id,p_assessment_id,v_actor,v_role,p_disposition,p_decision,p_final_score,p_final_category,trim(p_evidence),trim(p_explanation)) returning id into v_id;
  insert into public.cbg_final_decisions(application_id,human_review_id,decision,explanation,decided_by) values(p_application_id,v_id,p_decision,trim(p_explanation),v_actor);
  insert into public.cbg_human_corrections(application_id,human_review_id,category,override_reason,created_by) values(p_application_id,v_id,p_correction_category,trim(p_explanation),v_actor);
  update public.cbg_applications set status='decided',updated_by=v_actor,updated_at=now() where id=p_application_id;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata) values(v_actor,v_role,'human_review_completed','application',p_application_id::text,jsonb_build_object('review_id',v_id,'disposition',p_disposition,'decision',p_decision));
  return v_id;
end$$;

create or replace function public.cbg_decide_appeal_atomic(p_appeal_id uuid,p_outcome text,p_explanation text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_role public.cbg_app_role; v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if private.cbg_has_role('appeals_reviewer') then v_role := 'appeals_reviewer'; elsif private.cbg_has_role('admin') then v_role := 'admin'; else raise exception 'Not authorized to decide appeals'; end if;
  if p_outcome not in ('upheld','modified','overturned','more_information') or length(trim(p_explanation))<20 then raise exception 'A valid outcome and explanation are required'; end if;
  if not exists(select 1 from public.cbg_appeals where id=p_appeal_id and status in ('open','under_review')) then raise exception 'Appeal is not open for decision'; end if;
  insert into public.cbg_appeal_decisions(appeal_id,outcome,explanation,decided_by) values(p_appeal_id,p_outcome,trim(p_explanation),v_actor) returning id into v_id;
  update public.cbg_appeals set status='decided',updated_at=now() where id=p_appeal_id;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata) values(v_actor,v_role,'appeal_decided','appeal',p_appeal_id::text,jsonb_build_object('decision_id',v_id,'outcome',p_outcome));
  return v_id;
end$$;
revoke all on function public.cbg_decide_appeal_atomic(uuid,text,text) from public,anon;
grant execute on function public.cbg_decide_appeal_atomic(uuid,text,text) to authenticated;

commit;

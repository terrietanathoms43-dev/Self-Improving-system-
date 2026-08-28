begin;

alter function public.cbg_run_assessment_atomic(uuid,uuid,smallint,text,numeric,jsonb,jsonb,jsonb,jsonb,text,text,jsonb) set schema private;
alter function public.cbg_submit_human_review(uuid,uuid,text,public.cbg_decision_kind,smallint,text,text,text,text,public.cbg_app_role) set schema private;
alter function public.cbg_decide_appeal_atomic(uuid,text,text) set schema private;

create function public.cbg_run_assessment_atomic(p_application_id uuid,p_model_version_id uuid,p_score smallint,p_category text,p_confidence numeric,p_reasons jsonb,p_risk_factors jsonb,p_missing_information jsonb,p_fairness_warnings jsonb,p_recommended_action text,p_review_pathway text,p_input_snapshot jsonb) returns uuid
language sql security invoker set search_path='' as $$
  select private.cbg_run_assessment_atomic(p_application_id,p_model_version_id,p_score,p_category,p_confidence,p_reasons,p_risk_factors,p_missing_information,p_fairness_warnings,p_recommended_action,p_review_pathway,p_input_snapshot)
$$;

create function public.cbg_submit_human_review(p_application_id uuid,p_assessment_id uuid,p_disposition text,p_decision public.cbg_decision_kind,p_final_score smallint,p_final_category text,p_evidence text,p_explanation text,p_correction_category text,p_reviewer_role public.cbg_app_role) returns uuid
language sql security invoker set search_path='' as $$
  select private.cbg_submit_human_review(p_application_id,p_assessment_id,p_disposition,p_decision,p_final_score,p_final_category,p_evidence,p_explanation,p_correction_category,p_reviewer_role)
$$;

create function public.cbg_decide_appeal_atomic(p_appeal_id uuid,p_outcome text,p_explanation text) returns uuid
language sql security invoker set search_path='' as $$
  select private.cbg_decide_appeal_atomic(p_appeal_id,p_outcome,p_explanation)
$$;

revoke all on function public.cbg_run_assessment_atomic(uuid,uuid,smallint,text,numeric,jsonb,jsonb,jsonb,jsonb,text,text,jsonb) from public,anon;
revoke all on function public.cbg_submit_human_review(uuid,uuid,text,public.cbg_decision_kind,smallint,text,text,text,text,public.cbg_app_role) from public,anon;
revoke all on function public.cbg_decide_appeal_atomic(uuid,text,text) from public,anon;
grant execute on function public.cbg_run_assessment_atomic(uuid,uuid,smallint,text,numeric,jsonb,jsonb,jsonb,jsonb,text,text,jsonb) to authenticated;
grant execute on function public.cbg_submit_human_review(uuid,uuid,text,public.cbg_decision_kind,smallint,text,text,text,text,public.cbg_app_role) to authenticated;
grant execute on function public.cbg_decide_appeal_atomic(uuid,text,text) to authenticated;
grant execute on function private.cbg_run_assessment_atomic(uuid,uuid,smallint,text,numeric,jsonb,jsonb,jsonb,jsonb,text,text,jsonb) to authenticated;
grant execute on function private.cbg_submit_human_review(uuid,uuid,text,public.cbg_decision_kind,smallint,text,text,text,text,public.cbg_app_role) to authenticated;
grant execute on function private.cbg_decide_appeal_atomic(uuid,text,text) to authenticated;

commit;

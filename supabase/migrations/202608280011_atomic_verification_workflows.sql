begin;

create function private.cbg_complete_medical_verification(p_application_id uuid,p_urgency_score smallint,p_summary text,p_documents_complete boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_role public.cbg_app_role; v_status public.cbg_application_status; v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if private.cbg_has_role('medical_verification_officer') then v_role:='medical_verification_officer'; elsif private.cbg_has_role('admin') then v_role:='admin'; else raise exception 'Not authorized for medical verification'; end if;
  if p_urgency_score not between 0 and 30 or length(trim(p_summary))<20 then raise exception 'Medical verification is incomplete'; end if;
  select status into v_status from public.cbg_applications where id=p_application_id for update;
  if v_status is null then raise exception 'Application not found'; end if;
  if v_status<>'medical_verification' then raise exception 'Application is no longer awaiting medical verification'; end if;
  insert into public.cbg_medical_verifications(application_id,urgency_score,summary,documents_complete,verified_by,verified_at)
  values(p_application_id,p_urgency_score,trim(p_summary),p_documents_complete,v_actor,now()) returning id into v_id;
  update public.cbg_applications set status='social_assessment',updated_by=v_actor,updated_at=now() where id=p_application_id;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata)
  values(v_actor,v_role,'medical_verification_completed','application',p_application_id::text,jsonb_build_object('verification_id',v_id,'documents_complete',p_documents_complete));
  return v_id;
end$$;

create function public.cbg_complete_medical_verification(p_application_id uuid,p_urgency_score smallint,p_summary text,p_documents_complete boolean) returns uuid
language sql security invoker set search_path='' as $$ select private.cbg_complete_medical_verification(p_application_id,p_urgency_score,p_summary,p_documents_complete) $$;
revoke all on function public.cbg_complete_medical_verification(uuid,smallint,text,boolean) from public,anon;
grant execute on function public.cbg_complete_medical_verification(uuid,smallint,text,boolean) to authenticated;
grant execute on function private.cbg_complete_medical_verification(uuid,smallint,text,boolean) to authenticated;

create function private.cbg_complete_social_assessment(p_application_id uuid,p_financial smallint,p_access smallint,p_unmet smallint,p_vulnerability smallint,p_support smallint,p_summary text,p_missed boolean,p_transport boolean,p_family boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_role public.cbg_app_role; v_status public.cbg_application_status; v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if private.cbg_has_role('social_financial_assessment_officer') then v_role:='social_financial_assessment_officer'; elsif private.cbg_has_role('admin') then v_role:='admin'; else raise exception 'Not authorized for social assessment'; end if;
  if p_financial not between 0 and 20 or p_access not between 0 and 20 or p_unmet not between 0 and 15 or p_vulnerability not between 0 and 10 or p_support not between 0 and 5 or length(trim(p_summary))<20 then raise exception 'Social assessment is incomplete'; end if;
  select status into v_status from public.cbg_applications where id=p_application_id for update;
  if v_status is null then raise exception 'Application not found'; end if;
  if v_status<>'social_assessment' then raise exception 'Application is no longer awaiting social assessment'; end if;
  insert into public.cbg_social_assessments(application_id,financial_hardship_score,access_barrier_score,unmet_need_score,vulnerability_score,support_gap_score,missed_appointments,transport_difficulty,family_support_available,summary,assessed_by,assessed_at)
  values(p_application_id,p_financial,p_access,p_unmet,p_vulnerability,p_support,p_missed,p_transport,p_family,trim(p_summary),v_actor,now()) returning id into v_id;
  update public.cbg_applications set status='assessment_ready',updated_by=v_actor,updated_at=now() where id=p_application_id;
  insert into public.cbg_audit_logs(actor_id,actor_role,action,entity_type,entity_id,metadata)
  values(v_actor,v_role,'social_assessment_completed','application',p_application_id::text,jsonb_build_object('assessment_id',v_id));
  return v_id;
end$$;

create function public.cbg_complete_social_assessment(p_application_id uuid,p_financial smallint,p_access smallint,p_unmet smallint,p_vulnerability smallint,p_support smallint,p_summary text,p_missed boolean,p_transport boolean,p_family boolean) returns uuid
language sql security invoker set search_path='' as $$ select private.cbg_complete_social_assessment(p_application_id,p_financial,p_access,p_unmet,p_vulnerability,p_support,p_summary,p_missed,p_transport,p_family) $$;
revoke all on function public.cbg_complete_social_assessment(uuid,smallint,smallint,smallint,smallint,smallint,text,boolean,boolean,boolean) from public,anon;
grant execute on function public.cbg_complete_social_assessment(uuid,smallint,smallint,smallint,smallint,smallint,text,boolean,boolean,boolean) to authenticated;
grant execute on function private.cbg_complete_social_assessment(uuid,smallint,smallint,smallint,smallint,smallint,text,boolean,boolean,boolean) to authenticated;

commit;

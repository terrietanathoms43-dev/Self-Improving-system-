begin;
create or replace function public.cbg_compute_fairness_metrics(p_period_start date,p_period_end date) returns integer
language plpgsql security invoker set search_path='' as $$
declare inserted_count integer;
begin
  delete from public.cbg_fairness_metrics where period_start=p_period_start and period_end=p_period_end and dimension in('parish','rural_location');
  with latest_ai as (select distinct on(application_id) application_id,model_version_id,confidence,created_at from public.cbg_ai_assessments where created_at::date between p_period_start and p_period_end order by application_id,created_at desc),latest_review as (select distinct on(application_id) application_id,disposition,reviewed_at from public.cbg_human_reviews order by application_id,reviewed_at desc),base as (select a.parish,a.rural,ai.model_version_id,ai.confidence,ai.created_at,r.disposition,r.reviewed_at from public.cbg_applications a join latest_ai ai on ai.application_id=a.id left join latest_review r on r.application_id=a.id)
  insert into public.cbg_fairness_metrics(period_start,period_end,dimension,dimension_value,model_version_id,case_count,agreement_rate,override_rate,average_confidence,unresolved_reviews,average_decision_hours)
  select p_period_start,p_period_end,dimension,dimension_value,model_version_id,count(*)::integer,round(100.0*count(*) filter(where disposition='agree')/nullif(count(*) filter(where disposition is not null),0),2),round(100.0*count(*) filter(where disposition in('modify','override'))/nullif(count(*) filter(where disposition is not null),0),2),round(avg(confidence),2),count(*) filter(where disposition is null)::integer,round(avg(extract(epoch from(reviewed_at-created_at))/3600)::numeric,2)
  from (select 'parish'::text dimension,parish dimension_value,base.* from base union all select 'rural_location',case when rural then 'rural' else 'non_rural' end,base.* from base) grouped group by dimension,dimension_value,model_version_id;
  get diagnostics inserted_count=row_count;
  insert into public.cbg_fairness_alerts(severity,title,investigation_question,status)
  select 'medium','Elevated override rate for '||m.dimension_value,'What verified operational, access, data-quality, or policy factors may explain this difference?','open' from public.cbg_fairness_metrics m where m.period_start=p_period_start and m.period_end=p_period_end and m.case_count>=10 and m.override_rate>=30 and not exists(select 1 from public.cbg_fairness_alerts a where a.title='Elevated override rate for '||m.dimension_value and a.status in('open','investigating'));
  return inserted_count;
end $$;
revoke all on function public.cbg_compute_fairness_metrics(date,date) from public,anon,authenticated;
grant execute on function public.cbg_compute_fairness_metrics(date,date) to service_role;
create index if not exists cbg_fairness_period_idx on public.cbg_fairness_metrics(period_start,period_end,dimension);
commit;

begin;
create policy cbg_admin_manage_users on public.cbg_users for all to authenticated using(private.cbg_has_role('admin')) with check(private.cbg_has_role('admin'));
create policy cbg_admin_manage_user_roles on public.cbg_user_roles for all to authenticated using(private.cbg_has_role('admin')) with check(private.cbg_has_role('admin'));
create unique index if not exists cbg_pattern_category_unique on public.cbg_correction_patterns(correction_category) where affected_group is null;
create index if not exists cbg_eval_cases_dataset_idx on public.cbg_evaluation_cases(dataset_name,dataset_version);
commit;

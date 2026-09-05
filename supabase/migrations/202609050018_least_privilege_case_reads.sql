begin;

drop policy if exists case_workers_read_profiles on public.cbg_applicant_profiles;
create policy case_roles_read_profiles on public.cbg_applicant_profiles
for select to authenticated
using (
  private.cbg_has_role('intake_officer')
  or private.cbg_has_role('case_review_committee')
  or private.cbg_has_role('appeals_reviewer')
  or private.cbg_has_role('admin')
);

drop policy if exists medical_read on public.cbg_medical_verifications;
create policy authorized_roles_read_medical on public.cbg_medical_verifications
for select to authenticated
using (
  private.cbg_has_role('medical_verification_officer')
  or private.cbg_has_role('case_review_committee')
  or private.cbg_has_role('human_oversight_committee')
  or private.cbg_has_role('appeals_reviewer')
  or private.cbg_has_role('admin')
);

drop policy if exists social_read on public.cbg_social_assessments;
create policy authorized_roles_read_social on public.cbg_social_assessments
for select to authenticated
using (
  private.cbg_has_role('social_financial_assessment_officer')
  or private.cbg_has_role('case_review_committee')
  or private.cbg_has_role('human_oversight_committee')
  or private.cbg_has_role('appeals_reviewer')
  or private.cbg_has_role('admin')
);

drop policy if exists assessment_read on public.cbg_ai_assessments;
create policy review_roles_read_assessments on public.cbg_ai_assessments
for select to authenticated
using (
  private.cbg_has_role('case_review_committee')
  or private.cbg_has_role('human_oversight_committee')
  or private.cbg_has_role('appeals_reviewer')
  or private.cbg_has_role('admin')
);

drop policy if exists reviews_read on public.cbg_human_reviews;
create policy review_roles_read_reviews on public.cbg_human_reviews
for select to authenticated
using (
  private.cbg_has_role('case_review_committee')
  or private.cbg_has_role('human_oversight_committee')
  or private.cbg_has_role('appeals_reviewer')
  or private.cbg_has_role('admin')
);

drop policy if exists decisions_read on public.cbg_final_decisions;
create policy review_roles_read_decisions on public.cbg_final_decisions
for select to authenticated
using (
  private.cbg_has_role('case_review_committee')
  or private.cbg_has_role('human_oversight_committee')
  or private.cbg_has_role('appeals_reviewer')
  or private.cbg_has_role('admin')
);

drop policy if exists corrections_read on public.cbg_human_corrections;
create policy review_roles_read_corrections on public.cbg_human_corrections
for select to authenticated
using (
  private.cbg_has_role('case_review_committee')
  or private.cbg_has_role('human_oversight_committee')
  or private.cbg_has_role('appeals_reviewer')
  or private.cbg_has_role('admin')
);

drop policy if exists appeals_read on public.cbg_appeals;
create policy appeal_roles_read_appeals on public.cbg_appeals
for select to authenticated
using (
  private.cbg_has_role('case_review_committee')
  or private.cbg_has_role('appeals_reviewer')
  or private.cbg_has_role('admin')
);

drop policy if exists cbg_review_requests_read on public.cbg_review_requests;
create policy review_roles_read_requests on public.cbg_review_requests
for select to authenticated
using (
  private.cbg_has_role('case_review_committee')
  or private.cbg_has_role('human_oversight_committee')
  or private.cbg_has_role('appeals_reviewer')
  or private.cbg_has_role('admin')
);

commit;

# CareBridge Jamaica production runbook

## Daily checks

- Confirm the latest Vercel production deployment is `READY` and inspect error/fatal runtime logs.
- Review `/dashboard/system` for missing configuration, recent errors, fairness calculation freshness, open fairness investigations, and retention reviews.
- Review unresolved human-review cases and overdue notifications.

## Incident response

1. Protect applicants first: suspend affected staff accounts, stop exports, and pause case processing if confidentiality or decision integrity may be affected.
2. Preserve evidence: record timestamps, deployment ID, model/rules version, affected record identifiers, and audit-log references. Never copy medical narratives into incident chat or tickets.
3. Contain: rotate affected Vercel/Supabase/OpenAI secrets, revoke sessions, and roll back the Vercel deployment or model/rules version when justified.
4. Assess: authorized privacy, clinical, security, and governance personnel determine scope and notification obligations.
5. Recover: restore a verified deployment/database state, run regression and authorization tests, then obtain approval before reopening affected workflows.
6. Review: record root cause, corrective action, evidence, owner, deadline, and confirmation that the fix was tested.

## Backup and restoration exercise

- Enable the Supabase backup/PITR option appropriate to the production plan and verify its retention window in the Supabase dashboard.
- At least quarterly, restore to an isolated Supabase branch or separate recovery project. Never overwrite production for a drill.
- Validate row counts, foreign keys, RLS policies, storage references, active model version, append-only audit history, and a sample of de-identified evaluation results.
- Point a preview Vercel deployment at the isolated recovery database, run automated checks, then destroy the isolated copy according to policy.
- Record the recovery point objective, recovery time, participants, outcome, and gaps.

## Deployment rollback

- Use the Vercel deployment inspector to identify the last verified production deployment and promote/roll back to that immutable artifact.
- Database migrations are forward-only. Correct a migration with a new reviewed migration; do not edit or delete an applied migration.
- Model/rules rollback must use the audited governance workspace and cannot bypass passed evaluation and committee controls.

## Secret rotation

- Rotate `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, `RATE_LIMIT_SALT`, and `CRON_SECRET` immediately after suspected exposure and on the organization's scheduled cadence.
- Update Vercel variables, redeploy, verify login/maintenance/OpenAI connectivity, then revoke the old secret.
- Secret values must never appear in source control, audit metadata, screenshots, support tickets, or applicant records.

## Retention and disposition

- The system queues records approaching retention expiry but never deletes them automatically.
- An administrator records an evidence-based extension, retention decision, or approval for controlled disposition.
- Legal-hold records cannot be approved for disposition.
- Actual disposition requires the organization's approved privacy procedure, verification, and a separately documented execution step.

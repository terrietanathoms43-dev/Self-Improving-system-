# CareBridge Jamaica: AI Review and Continuous Improvement System

Production-oriented Next.js application for human-governed medical-assistance assessment review, appeals monitoring, fairness investigation, policy proposals, controlled rules evaluation, activation, and rollback.

## Safety properties

- The assessment is transparent and deterministic: six bounded components total exactly 100 points.
- Every assessment is routed to qualified human review.
- AI-only final decisions are blocked in application code and by a PostgreSQL trigger.
- Missing documents initiate follow-up instead of rejection.
- Missed appointments, rural access, disability, caregiving, and transport barriers receive contextual safeguards.
- Production version activation requires a passed evaluation and a conflict-free Human Oversight Committee approval.
- Assessments, reviews, decisions, approvals, and audit records remain separate and versioned.
- Analytics tables contain aggregated records rather than applicant identity or clinical detail.

## Local setup

1. Install Node.js 22 and run `npm ci`.
2. Copy `.env.example` to `.env.local` and supply the Supabase URL and publishable key.
3. Link a dedicated Supabase project with the Supabase CLI.
4. Apply `supabase/migrations/202608270001_initial_schema.sql` using `supabase db push`.
5. Create staff accounts in Supabase Authentication, insert matching `cbg_users` records, and assign roles through `cbg_user_roles` using an authorized administrative process.
6. Insert an initial `cbg_model_versions` draft, evaluate and approve it, then activate it through the governance workflow.
7. Run `npm run dev`.

Never expose `SUPABASE_SECRET_KEY` or `OPENAI_API_KEY` to browser code. Only variables prefixed with `NEXT_PUBLIC_` are client-visible. OpenAI is a required server-side dependency for the governed training workflow. It is never used to diagnose, issue final sensitive decisions, or silently modify or activate production rules.

### Controlled OpenAI training

The OpenAI training workspace creates immutable JSONL datasets from completed human reviews. It uses an explicit allow-list of numeric assessment factors, safeguard flags, and verified outcomes; names, contact details, application identifiers, uploaded documents, medical narratives, and reviewer evidence are excluded. The workflow requires:

1. dataset preparation from at least 10 verified reviews;
2. conflict-free Human Oversight Committee dataset approval;
3. a separately explained training authorization;
4. provider job-status synchronization;
5. regression and fairness evaluation; and
6. a separate manual committee decision before any model or rules version can be activated.

Set both `OPENAI_API_KEY` and `OPENAI_TRAINING_BASE_MODEL`. The base model must be one that your OpenAI project is currently permitted to fine-tune. Provider refusal or account ineligibility is recorded as an unavailable run and never weakens the governance controls.

## Vercel deployment

1. Import the GitHub repository into Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, `OPENAI_TRAINING_BASE_MODEL`, `RATE_LIMIT_SALT`, `CRON_SECRET`, and `NEXT_PUBLIC_APP_URL` in Project Settings → Environment Variables.
3. Set `NEXT_PUBLIC_APP_URL` to the production Vercel domain and add that domain to Supabase Auth URL Configuration.
4. Deploy. Vercel runs `next build`; GitHub Actions separately runs lint, TypeScript, unit tests, build, and dependency audit.

### First administrator

Because Supabase Authentication is shared with other applications, CareBridge never treats an arbitrary Supabase user as staff. Set `CAREBRIDGE_BOOTSTRAP_ADMIN_EMAIL` to the exact email of the intended first administrator, create that person in Supabase Authentication, then sign in through CareBridge. The app redirects the allow-listed account to `/setup` for one-time initialization. After the first administrator exists, remove `CAREBRIDGE_BOOTSTRAP_ADMIN_EMAIL` from Vercel and redeploy. All later staff accounts must be invited from Staff administration.

For scheduled overdue-case notifications, call `GET /api/maintenance` with `Authorization: Bearer <CRON_SECRET>` from a trusted scheduler. The route returns counts only and never applicant data.
The included `vercel.json` runs this maintenance job daily at 05:15 UTC. Vercel supplies the configured `CRON_SECRET` as a bearer token.

## Verification

Run `npm run check`. End-to-end checks are available with `npx playwright install chromium && npm run test:e2e`.
Set `E2E_STAFF_EMAIL` and `E2E_STAFF_PASSWORD` only in the protected CI/staging environment to enable the authenticated dashboard check. Never use a production staff account for automated tests.

## Operational warning

This software supports, but does not replace, qualified medical, social-work, legal, privacy, or ethics review. Conduct a Jamaican data-protection and clinical-governance review, penetration test, disaster-recovery exercise, accessibility audit, and staff training before processing live sensitive records.

Operational preparation is documented in [the production runbook](docs/PRODUCTION_RUNBOOK.md) and [go-live checklist](docs/GO_LIVE_CHECKLIST.md).

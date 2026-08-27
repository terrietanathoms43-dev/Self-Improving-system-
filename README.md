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

Never expose `SUPABASE_SECRET_KEY` or `OPENAI_API_KEY` to browser code. Only variables prefixed with `NEXT_PUBLIC_` are client-visible. The optional OpenAI key may support administrative drafting or summarization in future, but it is not used to make final decisions or silently modify rules.

## Vercel deployment

1. Import the GitHub repository into Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `RATE_LIMIT_SALT`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, and optionally `OPENAI_API_KEY` in Project Settings → Environment Variables.
3. Set `NEXT_PUBLIC_APP_URL` to the production Vercel domain and add that domain to Supabase Auth URL Configuration.
4. Deploy. Vercel runs `next build`; GitHub Actions separately runs lint, TypeScript, unit tests, build, and dependency audit.

For scheduled overdue-case notifications, call `GET /api/maintenance` with `Authorization: Bearer <CRON_SECRET>` from a trusted scheduler. The route returns counts only and never applicant data.

## Verification

Run `npm run check`. End-to-end checks are available with `npx playwright install chromium && npm run test:e2e`.

## Operational warning

This software supports, but does not replace, qualified medical, social-work, legal, privacy, or ethics review. Conduct a Jamaican data-protection and clinical-governance review, penetration test, disaster-recovery exercise, accessibility audit, and staff training before processing live sensitive records.

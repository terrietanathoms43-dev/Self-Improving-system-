import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  confirmRoutineDecision,
  requestDiscretionaryReview,
  runAssessment,
  submitHumanReview,
} from "../actions";
const scores = [
  ["medicalUrgency", "Medical urgency", 30],
  ["financialHardship", "Financial hardship", 20],
  ["accessBarriers", "Access barriers", 20],
  ["unmetNeed", "Unmet need", 15],
  ["vulnerability", "Vulnerability", 10],
  ["supportGap", "Existing support gap", 5],
] as const;
const flags = [
  ["missingDocuments", "Missing documents"],
  ["missedAppointments", "Missed appointments"],
  ["rural", "Rural location"],
  ["transportDifficulty", "Transport difficulty"],
  ["disability", "Disability-related"],
  ["caregiving", "Caregiving responsibilities"],
  ["urgent", "Urgent"],
  ["sensitive", "Sensitive"],
  ["appealed", "Appealed"],
  ["conflicting", "Conflicting evidence"],
  ["unusual", "Unusual case"],
  ["lowConfidence", "Low confidence"],
  ["child", "Child"],
  ["elderly", "Elderly"],
  ["pregnant", "Pregnancy-related"],
] as const;
export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const actor = await requireActor([
    "case_review_committee",
    "human_oversight_committee",
    "appeals_reviewer",
    "admin",
  ]);
  const { id } = await params;
  const { success } = await searchParams;
  const s = await createClient();
  const [{ data: c }, { data: latest }, { data: finalDecision }] =
    await Promise.all([
      s
        .from("cbg_applications")
        .select(
          "id,reference_number,status,parish,rural,cbg_medical_verifications(*),cbg_social_assessments(*)",
        )
        .eq("id", id)
        .single(),
      s
        .from("cbg_ai_assessments")
        .select("*,cbg_model_versions(version)")
        .eq("application_id", id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
      s
        .from("cbg_final_decisions")
        .select("id,decision,decided_at")
        .eq("application_id", id)
        .maybeSingle(),
    ]);
  if (!c) notFound();
  const { error: readAuditError } = await s.from("cbg_audit_logs").insert({
    actor_id: actor.id,
    actor_role: actor.roles[0],
    action: "sensitive_case_workspace_read",
    entity_type: "application",
    entity_id: id,
    metadata: {
      fields: ["application", "medical_verification", "social_assessment"],
    },
  });
  if (readAuditError)
    throw new Error("The sensitive read could not be recorded safely");
  const { data: reviewRequest } = latest
    ? await s
        .from("cbg_review_requests")
        .select("id,review_type,status,rationale,requested_at")
        .eq("ai_assessment_id", latest.id)
        .in("status", ["queued", "in_review"])
        .maybeSingle()
    : { data: null };
  const canCompleteReview = actor.roles.some((role) =>
    ["case_review_committee", "appeals_reviewer", "admin"].includes(role),
  );
  const canRequestReview = actor.roles.some((role) =>
    ["case_review_committee", "human_oversight_committee", "admin"].includes(
      role,
    ),
  );
  const canConfirmRoutine = actor.roles.some((role) =>
    ["case_review_committee", "admin"].includes(role),
  );
  const medical = Array.isArray(c.cbg_medical_verifications)
    ? c.cbg_medical_verifications[0]
    : c.cbg_medical_verifications;
  const social = Array.isArray(c.cbg_social_assessments)
    ? c.cbg_social_assessments[0]
    : c.cbg_social_assessments;
  const scoreDefaults: Record<(typeof scores)[number][0], number> = {
    medicalUrgency: medical?.urgency_score ?? 0,
    financialHardship: social?.financial_hardship_score ?? 0,
    accessBarriers: social?.access_barrier_score ?? 0,
    unmetNeed: social?.unmet_need_score ?? 0,
    vulnerability: social?.vulnerability_score ?? 0,
    supportGap: social?.support_gap_score ?? 0,
  };
  const finalized =
    Boolean(finalDecision) ||
    ["decided", "appealed", "closed"].includes(c.status);
  const readyForAssessment = [
    "verified",
    "assessment_ready",
    "human_review",
    "decision_pending",
  ].includes(c.status);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Case {c.reference_number}</h1>
        <Badge>{c.status.replaceAll("_", " ")}</Badge>
      </div>
      <p className="mt-2 text-slate-600">
        Authorized case workspace · {c.parish}
      </p>
      {success ? (
        <p
          role="status"
          className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {success}
        </p>
      ) : null}
      {latest ? (
        <div className="mt-6 space-y-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">
                  Latest transparent assessment
                </p>
                <p className="mt-2 text-4xl font-bold">
                  {latest.score}
                  <span className="text-lg text-slate-400">/100</span>
                </p>
              </div>
              <div className="text-right">
                <Badge
                  tone={latest.category === "critical" ? "danger" : "warning"}
                >
                  {latest.category}
                </Badge>
                <p className="mt-2 text-sm">Confidence {latest.confidence}%</p>
              </div>
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <h2 className="font-semibold">Recommended action</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {latest.recommended_action}
                </p>
              </div>
              <div>
                <h2 className="font-semibold">Required pathway</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {latest.review_pathway}
                </p>
              </div>
            </div>
            <div
              role="status"
              className={`mt-5 rounded-lg p-4 text-sm ${reviewRequest ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}
            >
              {reviewRequest
                ? `${String(reviewRequest.review_type).replaceAll("_", " ")} full human reassessment required: ${reviewRequest.rationale}`
                : "No mandatory-review flags were detected. This case is on the AI-led routine pathway. A concise human safety confirmation is required before the final decision, and an authorized reviewer may request a full reassessment at any time."}
            </div>
          </Card>
          {finalized ? (
            <Card>
              <h2 className="text-lg font-semibold">Review finalized</h2>
              <p className="mt-2 text-sm text-slate-600">
                A final human decision has already been recorded
                {finalDecision?.decided_at
                  ? ` on ${new Date(finalDecision.decided_at).toLocaleString("en-JM")}`
                  : ""}
                . Review controls are locked to prevent duplicate decisions.
              </p>
              {finalDecision?.decision ? (
                <p className="mt-3">
                  <Badge tone="success">{finalDecision.decision}</Badge>
                </p>
              ) : null}
            </Card>
          ) : reviewRequest && canCompleteReview ? (
            <Card>
              <h2 className="text-lg font-semibold">
                Record qualified human review
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Overrides require evidence and a meaningful explanation. The AI
                record remains unchanged.
              </p>
              <form
                action={submitHumanReview}
                className="mt-5 grid gap-4 sm:grid-cols-2"
              >
                <input type="hidden" name="applicationId" value={c.id} />
                <input type="hidden" name="assessmentId" value={latest.id} />
                <label className="text-sm font-medium">
                  Review result
                  <select
                    name="disposition"
                    className="mt-1 h-10 w-full rounded-lg border px-3"
                    required
                  >
                    <option value="agree">Agree</option>
                    <option value="modify">Modify</option>
                    <option value="override">Override</option>
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Proposed final decision
                  <select
                    name="proposedDecision"
                    className="mt-1 h-10 w-full rounded-lg border px-3"
                    required
                  >
                    <option value="approve">Approve</option>
                    <option value="modify">Approve with modification</option>
                    <option value="refer">Refer for other support</option>
                    <option value="reject">Reject after human review</option>
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Final score
                  <Input
                    className="mt-1"
                    name="finalScore"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={latest.score}
                    required
                  />
                </label>
                <label className="text-sm font-medium">
                  Final category
                  <Input
                    className="mt-1"
                    name="finalCategory"
                    defaultValue={latest.category}
                    required
                  />
                </label>
                <label className="text-sm font-medium sm:col-span-2">
                  Correction category
                  <select
                    name="correctionCategory"
                    className="mt-1 h-10 w-full rounded-lg border px-3"
                    required
                  >
                    {[
                      "ai_correct",
                      "medical_urgency_underestimated",
                      "rural_transport_misunderstood",
                      "missed_appointments_unfair",
                      "disability_overlooked",
                      "caregiving_overlooked",
                      "medication_costs_underestimated",
                      "family_support_overlooked",
                      "support_gap_misunderstood",
                      "referral_too_quick",
                      "human_reviewer_error",
                      "policy_unclear",
                      "insufficient_information",
                    ].map((x) => (
                      <option key={x} value={x}>
                        {x.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium sm:col-span-2">
                  Evidence considered
                  <textarea
                    name="evidence"
                    minLength={20}
                    required
                    className="mt-1 min-h-24 w-full rounded-lg border p-3"
                  />
                </label>
                <label className="text-sm font-medium sm:col-span-2">
                  Reviewer explanation
                  <textarea
                    name="explanation"
                    minLength={20}
                    required
                    className="mt-1 min-h-24 w-full rounded-lg border p-3"
                  />
                </label>
                <SubmitButton
                  className="sm:col-span-2"
                  pendingLabel="Saving review…"
                >
                  Save human review and final decision
                </SubmitButton>
              </form>
            </Card>
          ) : reviewRequest ? (
            <Card>
              <h2 className="text-lg font-semibold">
                Qualified review pending
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                This case is queued for a full reassessment by a Case Review
                Committee member, Appeals Reviewer, or Admin. Your current role
                may view the pathway but cannot record the review.
              </p>
            </Card>
          ) : canRequestReview || canConfirmRoutine ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {canConfirmRoutine ? (
                <Card>
                  <h2 className="text-lg font-semibold">
                    Confirm routine recommendation
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Check the verified record for obvious errors. Any change,
                    rejection, uncertainty, or new safeguard requires full
                    reassessment instead.
                  </p>
                  <form
                    action={confirmRoutineDecision}
                    className="mt-4 grid gap-3"
                  >
                    <input type="hidden" name="applicationId" value={c.id} />
                    <input
                      type="hidden"
                      name="assessmentId"
                      value={latest.id}
                    />
                    <label className="text-sm font-medium">
                      Final routine action
                      <select
                        name="decision"
                        className="mt-1 h-10 w-full rounded-lg border px-3"
                        required
                      >
                        <option value="approve">Approve</option>
                        <option value="refer">Refer for other support</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Safety confirmation note
                      <textarea
                        name="note"
                        minLength={20}
                        maxLength={5000}
                        required
                        placeholder="Confirm what was checked and why no full reassessment is required"
                        className="mt-1 min-h-24 w-full rounded-lg border p-3"
                      />
                    </label>
                    <SubmitButton pendingLabel="Saving confirmation…">
                      Confirm routine decision
                    </SubmitButton>
                  </form>
                </Card>
              ) : null}
              {canRequestReview ? (
                <Card>
                  <h2 className="text-lg font-semibold">
                    Request discretionary review
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Authorized reviewers may pull any routine case for a
                    complete human reassessment. The request and rationale are
                    recorded in the audit history.
                  </p>
                  <form
                    action={requestDiscretionaryReview}
                    className="mt-4 grid gap-3"
                  >
                    <input type="hidden" name="applicationId" value={c.id} />
                    <input
                      type="hidden"
                      name="assessmentId"
                      value={latest.id}
                    />
                    <textarea
                      name="rationale"
                      minLength={10}
                      maxLength={2000}
                      required
                      placeholder="Reason for selecting this case for full reassessment"
                      className="min-h-24 rounded-lg border p-3"
                    />
                    <SubmitButton pendingLabel="Requesting review…">
                      Request full human reassessment
                    </SubmitButton>
                  </form>
                </Card>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : readyForAssessment ? (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">Run rules-based assessment</h2>
          <p className="mt-1 text-sm text-slate-600">
            Verify the prefilled values against the signed medical and social
            assessments.
          </p>
          <form action={runAssessment} className="mt-5 space-y-6">
            <input type="hidden" name="applicationId" value={c.id} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {scores.map(([name, label, max]) => (
                <label key={name} className="text-sm font-medium">
                  {label} (0–{max})
                  <Input
                    className="mt-1"
                    type="number"
                    name={name}
                    min={0}
                    max={max}
                    required
                    defaultValue={scoreDefaults[name]}
                  />
                </label>
              ))}
            </div>
            <fieldset>
              <legend className="font-semibold">
                Safeguards and mandatory-review flags
              </legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {flags.map(([name, label]) => (
                  <label key={name} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name={name}
                      defaultChecked={
                        name === "rural"
                          ? c.rural
                          : name === "missingDocuments"
                            ? !medical?.documents_complete
                            : name === "missedAppointments"
                              ? social?.missed_appointments
                              : name === "transportDifficulty"
                                ? social?.transport_difficulty
                                : false
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <SubmitButton pendingLabel="Running assessment…">
              Run AI assessment and determine pathway
            </SubmitButton>
          </form>
        </Card>
      ) : (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">
            Verification is not complete
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            This case cannot be assessed until both verification stages have
            completed. Assessment controls are locked.
          </p>
        </Card>
      )}
    </>
  );
}

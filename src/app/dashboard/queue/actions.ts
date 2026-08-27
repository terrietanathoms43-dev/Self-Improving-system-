"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { assessApplication, assessmentInputSchema } from "@/lib/assessment";
const formSchema = assessmentInputSchema.extend({ applicationId: z.uuid() });
export async function runAssessment(formData: FormData) {
  const actor = await requireActor([
    "case_review_committee",
    "human_oversight_committee",
    "admin",
  ]);
  const obj: Record<string, unknown> = Object.fromEntries(formData);
  const booleans = [
    "missingDocuments",
    "missedAppointments",
    "rural",
    "transportDifficulty",
    "disability",
    "caregiving",
    "urgent",
    "sensitive",
    "appealed",
    "conflicting",
    "unusual",
    "lowConfidence",
    "child",
    "elderly",
    "pregnant",
  ];
  for (const k of booleans) obj[k] = obj[k] === "on";
  for (const k of [
    "medicalUrgency",
    "financialHardship",
    "accessBarriers",
    "unmetNeed",
    "vulnerability",
    "supportGap",
  ])
    obj[k] = Number(obj[k]);
  const parsed = formSchema.safeParse(obj);
  if (!parsed.success) throw new Error("Invalid assessment data");
  const { applicationId, ...input } = parsed.data;
  const s = await createClient();
  const { data: version } = await s
    .from("cbg_model_versions")
    .select("id,version")
    .eq("status", "active")
    .single();
  if (!version) throw new Error("No active rules version");
  const result = assessApplication(input, version.version);
  const { error } = await s.from("cbg_ai_assessments").insert({
    application_id: applicationId,
    model_version_id: version.id,
    score: result.score,
    category: result.category,
    confidence: result.confidence,
    reasons: result.reasons,
    risk_factors: result.riskFactors,
    missing_information: result.missingInformation,
    fairness_warnings: result.fairnessWarnings,
    recommended_action: result.recommendedAction,
    review_pathway: result.reviewPathway,
    requires_human_review: true,
    input_snapshot: input,
    created_by: actor.id,
  });
  if (error) throw error;
  await s
    .from("cbg_applications")
    .update({ status: "human_review", updated_by: actor.id })
    .eq("id", applicationId);
  revalidatePath("/dashboard/queue");
}

const reviewSchema = z.object({
  applicationId: z.uuid(),
  assessmentId: z.uuid(),
  disposition: z.enum(["agree", "modify", "override"]),
  proposedDecision: z.enum(["approve", "modify", "refer", "reject"]),
  finalScore: z.coerce.number().int().min(0).max(100),
  finalCategory: z.string().min(2).max(40),
  evidence: z.string().min(20).max(5000),
  explanation: z.string().min(20).max(5000),
  correctionCategory: z.enum([
    "medical_urgency_underestimated",
    "rural_transport_misunderstood",
    "missed_appointments_unfair",
    "disability_overlooked",
    "caregiving_overlooked",
    "medication_costs_underestimated",
    "family_support_overlooked",
    "support_gap_misunderstood",
    "referral_too_quick",
    "ai_correct",
    "human_reviewer_error",
    "policy_unclear",
    "insufficient_information",
  ]),
});

export async function submitHumanReview(formData: FormData) {
  const actor = await requireActor([
    "case_review_committee",
    "human_oversight_committee",
    "appeals_reviewer",
  ]);
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Review is incomplete or invalid");
  const s = await createClient();
  const { error } = await s.rpc("cbg_submit_human_review", {
    p_application_id: parsed.data.applicationId,
    p_assessment_id: parsed.data.assessmentId,
    p_disposition: parsed.data.disposition,
    p_decision: parsed.data.proposedDecision,
    p_final_score: parsed.data.finalScore,
    p_final_category: parsed.data.finalCategory,
    p_evidence: parsed.data.evidence,
    p_explanation: parsed.data.explanation,
    p_correction_category: parsed.data.correctionCategory,
    p_reviewer_role: actor.roles.find((role) =>
      [
        "case_review_committee",
        "human_oversight_committee",
        "appeals_reviewer",
      ].includes(role),
    ),
  });
  if (error) throw error;
  revalidatePath(`/dashboard/queue/${parsed.data.applicationId}`);
  revalidatePath("/dashboard/reviews");
}

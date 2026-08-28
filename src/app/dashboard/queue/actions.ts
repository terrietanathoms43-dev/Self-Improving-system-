"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { assessApplication, assessmentInputSchema } from "@/lib/assessment";
import { createOpenAIAdvisory } from "@/lib/openai/server";
import { createAdminClient } from "@/lib/supabase/server";
const formSchema = assessmentInputSchema.extend({ applicationId: z.uuid() });
export async function runAssessment(formData: FormData) {
  await requireActor([
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
    .select("id,version,model_type,trained_model_id,cbg_trained_models(provider_model_id,status)")
    .eq("status", "active")
    .single();
  if (!version) throw new Error("No active rules version");
  const deterministic = assessApplication(input, version.version);
  let result=deterministic;
  let advisoryMetadata:Record<string,unknown>={used:false};
  const trained=version.cbg_trained_models as unknown as {provider_model_id:string;status:string}|null;
  if(version.model_type==="rules_with_advisory"&&trained?.status==="eligible"){
    try{const advisory=await createOpenAIAdvisory(trained.provider_model_id,input,deterministic);result={...deterministic,...advisory,score:deterministic.score,category:deterministic.category,requiresHumanReview:true,rulesVersion:deterministic.rulesVersion};advisoryMetadata={used:true,trainedModelId:version.trained_model_id};}
    catch{const eventId=crypto.randomUUID();console.error(JSON.stringify({level:"error",eventId,operation:"openai_assessment_advisory",code:"ADVISORY_FALLBACK"}));await createAdminClient().from("cbg_error_events").insert({event_id:eventId,route:"/dashboard/queue/[id]",operation:"openai_assessment_advisory",error_code:"ADVISORY_FALLBACK",safe_message:"The governed advisory model was unavailable; deterministic rules were used.",metadata:{model_version_id:version.id}});advisoryMetadata={used:false,fallback:true,eventId};}
  }
  const { error } = await s.rpc("cbg_run_assessment_atomic", {
    p_application_id: applicationId,
    p_model_version_id: version.id,
    p_score: result.score,
    p_category: result.category,
    p_confidence: result.confidence,
    p_reasons: result.reasons,
    p_risk_factors: result.riskFactors,
    p_missing_information: result.missingInformation,
    p_fairness_warnings: result.fairnessWarnings,
    p_recommended_action: result.recommendedAction,
    p_review_pathway: result.reviewPathway,
    p_input_snapshot: { ...input, advisory: advisoryMetadata },
  });
  if (error) throw error;
  revalidatePath("/dashboard/queue");
  redirect(`/dashboard/queue/${applicationId}?success=Assessment+created+and+routed+to+human+review`);
}

const reviewSchema = z.object({
  applicationId: z.uuid(),
  assessmentId: z.uuid(),
  disposition: z.enum(["agree", "modify", "override"]),
  proposedDecision: z.enum(["approve", "modify", "refer", "reject"]),
  finalScore: z.coerce.number().int().min(0).max(100),
  finalCategory: z.enum(["critical", "high", "moderate", "standard"]),
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
    "appeals_reviewer",
    "admin",
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
        "appeals_reviewer",
        "admin",
      ].includes(role),
    ),
  });
  if (error) throw error;
  revalidatePath(`/dashboard/queue/${parsed.data.applicationId}`);
  revalidatePath("/dashboard/reviews");
  redirect(`/dashboard/queue/${parsed.data.applicationId}?success=Human+review+and+final+decision+saved`);
}

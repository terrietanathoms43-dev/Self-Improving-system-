import { z } from "zod";
import type { AssessmentInput, AssessmentResult } from "@/types/database";
export const assessmentInputSchema = z.object({
  medicalUrgency: z.number().int().min(0).max(30),
  financialHardship: z.number().int().min(0).max(20),
  accessBarriers: z.number().int().min(0).max(20),
  unmetNeed: z.number().int().min(0).max(15),
  vulnerability: z.number().int().min(0).max(10),
  supportGap: z.number().int().min(0).max(5),
  missingDocuments: z.boolean(),
  missedAppointments: z.boolean(),
  rural: z.boolean(),
  transportDifficulty: z.boolean(),
  disability: z.boolean(),
  caregiving: z.boolean(),
  urgent: z.boolean(),
  sensitive: z.boolean(),
  appealed: z.boolean(),
  conflicting: z.boolean(),
  unusual: z.boolean(),
  lowConfidence: z.boolean(),
  child: z.boolean(),
  elderly: z.boolean(),
  pregnant: z.boolean(),
});
export const assessmentRulesSchema = z
  .object({
    critical: z.number().min(1).max(100).default(80),
    high: z.number().min(1).max(99).default(60),
    moderate: z.number().min(0).max(98).default(40),
  })
  .refine(
    (rules) => rules.critical > rules.high && rules.high > rules.moderate,
    { message: "Assessment thresholds must be ordered" },
  );
export type AssessmentRules = z.infer<typeof assessmentRulesSchema>;
export function assessApplication(
  raw: AssessmentInput,
  rulesVersion = "rules-1.0.0",
  rawRules: unknown = {},
): AssessmentResult {
  const i = assessmentInputSchema.parse(raw);
  const rules = assessmentRulesSchema.parse(rawRules);
  const score =
    i.medicalUrgency +
    i.financialHardship +
    i.accessBarriers +
    i.unmetNeed +
    i.vulnerability +
    i.supportGap;
  const category =
    score >= rules.critical
      ? "critical"
      : score >= rules.high
        ? "high"
        : score >= rules.moderate
          ? "moderate"
          : "standard";
  const reasons = [
    `Medical urgency contributed ${i.medicalUrgency}/30.`,
    `Financial hardship contributed ${i.financialHardship}/20.`,
    `Access barriers contributed ${i.accessBarriers}/20.`,
    `Unmet need contributed ${i.unmetNeed}/15.`,
    `Vulnerability contributed ${i.vulnerability}/10.`,
    `Existing support gap contributed ${i.supportGap}/5.`,
  ];
  const missingInformation = i.missingDocuments
    ? [
        "Required documents are incomplete; request follow-up without rejecting the application.",
      ]
    : [];
  const fairnessWarnings = [
    i.rural || i.transportDifficulty
      ? "Rural access or transport difficulty requires contextual review."
      : "",
    i.missedAppointments
      ? "Missed appointments require access-barrier analysis and must not be treated as misconduct."
      : "",
    i.disability
      ? "Disability-related support needs require qualified human consideration."
      : "",
    i.caregiving
      ? "Caregiving responsibilities may affect access and financial capacity."
      : "",
  ].filter(Boolean);
  const mandatory = [
    i.urgent,
    i.sensitive,
    i.appealed,
    i.conflicting,
    i.unusual,
    i.lowConfidence,
    i.child,
    i.elderly,
    i.pregnant,
    i.disability,
    i.missingDocuments,
  ].some(Boolean);
  const confidence = Math.max(
    35,
    100 -
      (i.missingDocuments ? 25 : 0) -
      (i.conflicting ? 20 : 0) -
      (i.unusual ? 15 : 0),
  );
  return {
    score,
    category,
    confidence,
    reasons,
    riskFactors: [
      i.lowConfidence ? "Low confidence" : "",
      i.conflicting ? "Conflicting verification evidence" : "",
      i.sensitive ? "Sensitive case" : "",
    ].filter(Boolean),
    missingInformation,
    fairnessWarnings,
    recommendedAction: i.missingDocuments
      ? "Request missing information and retain in human-review queue"
      : mandatory
        ? "Route for qualified human reassessment"
        : score >= rules.high
          ? "Advance through the priority decision pathway"
          : "Advance through the routine decision pathway",
    reviewPathway: mandatory
      ? "Mandatory qualified human review"
      : "AI-led routine pathway; discretionary review remains available",
    requiresHumanReview: mandatory,
    rulesVersion,
  };
}
export type ReviewRoute = {
  type: "mandatory" | "quality_assurance" | "routine";
  rationale: string;
  requiresHumanReview: boolean;
};
export function determineReviewRoute(
  result: AssessmentResult,
  applicationId: string,
  qaPercent = 10,
): ReviewRoute {
  if (result.requiresHumanReview)
    return {
      type: "mandatory",
      rationale:
        result.riskFactors[0] ??
        result.missingInformation[0] ??
        result.fairnessWarnings[0] ??
        "Assessment safeguards require qualified human reassessment.",
      requiresHumanReview: true,
    };
  const bucket =
    [...applicationId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100;
  if (bucket < qaPercent)
    return {
      type: "quality_assurance",
      rationale: "Selected by the documented quality-assurance sampling rule.",
      requiresHumanReview: true,
    };
  return {
    type: "routine",
    rationale:
      "High-confidence routine assessment with no mandatory-review safeguard flags.",
    requiresHumanReview: false,
  };
}
export function canCreateFinalDecision(
  source: "human" | "ai",
  decision: "approve" | "modify" | "refer" | "reject",
) {
  return (
    source === "human" &&
    ["approve", "modify", "refer", "reject"].includes(decision)
  );
}

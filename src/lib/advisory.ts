import { z } from "zod";

const prohibitedDecisionLanguage =
  /\b(diagnos(?:e|ed|es|ing|is)|approve(?:d|s)?|reject(?:ed|s|ion)?|deny|denied|decline(?:d|s)?)\b/i;

export const advisorySchema = z
  .object({
    confidence: z.number().min(0).max(100),
    reasons: z.array(z.string().min(1).max(300)).min(1).max(12),
    riskFactors: z.array(z.string().min(1).max(300)).max(12),
    missingInformation: z.array(z.string().min(1).max(300)).max(12),
    fairnessWarnings: z.array(z.string().min(1).max(300)).max(12),
    recommendedAction: z.string().min(1).max(1000),
    reviewPathway: z.string().min(1).max(1000),
  })
  .superRefine((value, context) => {
    if (prohibitedDecisionLanguage.test(value.recommendedAction)) {
      context.addIssue({
        code: "custom",
        path: ["recommendedAction"],
        message: "Advisory output may not diagnose or state a final decision",
      });
    }
  });

export function validateAdvisory(value: unknown, requiresHumanReview: boolean) {
  const advisory = advisorySchema.parse(value);
  if (
    requiresHumanReview &&
    !/\b(human|review|committee|reviewer|oversight)\b/i.test(
      advisory.reviewPathway,
    )
  ) {
    throw new Error("Advisory omitted the required human-review pathway");
  }
  return advisory;
}

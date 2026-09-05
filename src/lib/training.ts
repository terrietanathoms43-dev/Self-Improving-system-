import { createHash } from "node:crypto";
import type { AssessmentInput } from "@/types/database";

export type TrainingSource = {
  assessment: { score: number; category: string; confidence: number; input_snapshot: unknown; requires_human_review: boolean };
  review: { disposition: string; proposed_decision: string; final_score: number | null; final_category: string | null };
  correction: { category: string; bias_concern: boolean; policy_gap: boolean } | null;
};

const allowedInputKeys = ["medicalUrgency","financialHardship","accessBarriers","unmetNeed","vulnerability","supportGap","missingDocuments","missedAppointments","rural","transportDifficulty","disability","caregiving","urgent","sensitive","appealed","conflicting","unusual","lowConfidence","child","elderly","pregnant"] as const;

export function deidentifiedExample(source: TrainingSource) {
  const raw = (source.assessment.input_snapshot ?? {}) as Partial<AssessmentInput>;
  const factors = Object.fromEntries(allowedInputKeys.map((key) => [key, raw[key] ?? null]));
  return {
    messages: [
      { role: "system", content: "You are a decision-support quality model. Do not diagnose, reject, or make final sensitive decisions. Identify a recommendation and the appropriate review pathway from de-identified structured factors." },
      { role: "user", content: JSON.stringify({ factors, priorAssessment: { score: source.assessment.score, category: source.assessment.category, confidence: source.assessment.confidence, requiresHumanReview: source.assessment.requires_human_review } }) },
      { role: "assistant", content: JSON.stringify({ humanCategory: source.review.final_category, humanDecision: source.review.proposed_decision, disposition: source.review.disposition, correctionCategory: source.correction?.category ?? "ai_correct", biasConcern: source.correction?.bias_concern ?? false, policyGap: source.correction?.policy_gap ?? false, requiresHumanReview: source.assessment.requires_human_review }) },
    ],
  };
}

export function buildTrainingJsonl(sources: TrainingSource[]) {
  const content = sources.map(deidentifiedExample).map((row) => JSON.stringify(row)).join("\n") + "\n";
  return { content, hash: createHash("sha256").update(content).digest("hex"), count: sources.length };
}

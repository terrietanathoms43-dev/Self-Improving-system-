import { describe, expect, it } from "vitest";
import { buildTrainingJsonl, deidentifiedExample, type TrainingSource } from "./training";

const source: TrainingSource = {
  assessment: { score: 71, category: "high", confidence: 82, requires_human_review: true, input_snapshot: { medicalUrgency: 24, rural: true, applicantName: "Must Not Leak", medicalNarrative: "private" } },
  review: { disposition: "override", proposed_decision: "approve", final_score: 84, final_category: "critical" },
  correction: { category: "rural_transport_misunderstood", bias_concern: true, policy_gap: false },
};
describe("training dataset privacy", () => {
  it("keeps only allow-listed structured factors", () => {
    const serialized = JSON.stringify(deidentifiedExample(source));
    expect(serialized).not.toContain("Must Not Leak");
    expect(serialized).not.toContain("medicalNarrative");
    expect(serialized).toContain("medicalUrgency");
  });
  it("creates deterministic JSONL and hash", () => {
    const a = buildTrainingJsonl([source]); const b = buildTrainingJsonl([source]);
    expect(a).toEqual(b); expect(a.count).toBe(1); expect(a.content.endsWith("\n")).toBe(true);
  });
  it("preserves the actual review route instead of labelling every case mandatory",()=>{const routine={...source,assessment:{...source.assessment,requires_human_review:false,input_snapshot:null},correction:null};const example=deidentifiedExample(routine);const userMessage=JSON.parse(example.messages[1].content);const assistantMessage=JSON.parse(example.messages[2].content);expect(userMessage.priorAssessment.requiresHumanReview).toBe(false);expect(assistantMessage.requiresHumanReview).toBe(false);expect(assistantMessage.correctionCategory).toBe("ai_correct")});
});

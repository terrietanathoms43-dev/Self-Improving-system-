import { describe, expect, it } from "vitest";
import { assessApplication, canCreateFinalDecision, determineReviewRoute } from "./assessment";
import type { AssessmentInput } from "@/types/database";
const base: AssessmentInput = {
  medicalUrgency: 20,
  financialHardship: 15,
  accessBarriers: 10,
  unmetNeed: 10,
  vulnerability: 5,
  supportGap: 3,
  missingDocuments: false,
  missedAppointments: false,
  rural: false,
  transportDifficulty: false,
  disability: false,
  caregiving: false,
  urgent: false,
  sensitive: false,
  appealed: false,
  conflicting: false,
  unusual: false,
  lowConfidence: false,
  child: false,
  elderly: false,
  pregnant: false,
};
describe("transparent assessment", () => {
  it("sums the six bounded components", () => {
    const result = assessApplication(base);
    expect(result.score).toBe(63);
    expect(result.category).toBe("high");
    expect(result.requiresHumanReview).toBe(false);
  });
  it("routes missing documents for follow-up without rejection", () => {
    const result = assessApplication({ ...base, missingDocuments: true });
    expect(result.missingInformation[0]).toContain("follow-up");
    expect(result.recommendedAction).not.toContain("reject");
    expect(result.confidence).toBeLessThan(100);
  });
  it("treats transport and missed appointments as fairness context", () => {
    const result = assessApplication({
      ...base,
      rural: true,
      missedAppointments: true,
    });
    expect(result.fairnessWarnings).toHaveLength(2);
    expect(result.fairnessWarnings.join(" ")).toContain(
      "must not be treated as misconduct",
    );
  });
  it("blocks every AI-created final decision", () => {
    expect(canCreateFinalDecision("ai", "approve")).toBe(false);
    expect(canCreateFinalDecision("ai", "reject")).toBe(false);
    expect(canCreateFinalDecision("human", "reject")).toBe(true);
  });
  it("rejects out-of-range component scores", () => {
    expect(() => assessApplication({ ...base, medicalUrgency: 31 })).toThrow();
  });
  it("keeps routine high-confidence cases on the AI-led pathway",()=>{const result=assessApplication(base);expect(determineReviewRoute(result,"routine-case",0).type).toBe("routine")});
  it("mandates full reassessment when a safeguard is present",()=>{const result=assessApplication({...base,missingDocuments:true});expect(determineReviewRoute(result,"case-1").type).toBe("mandatory")});
  it("supports deterministic quality-assurance sampling",()=>{const result=assessApplication(base);expect(determineReviewRoute(result,"case-2",100).type).toBe("quality_assurance")});
  it("classifies the full score range",()=>{
    expect(assessApplication({...base,medicalUrgency:0,financialHardship:0,accessBarriers:0,unmetNeed:0,vulnerability:0,supportGap:0}).category).toBe("standard");
    expect(assessApplication({...base,medicalUrgency:10,financialHardship:10,accessBarriers:10,unmetNeed:10,vulnerability:5,supportGap:0}).category).toBe("moderate");
    expect(assessApplication({...base,medicalUrgency:30,financialHardship:20,accessBarriers:20,unmetNeed:15,vulnerability:10,supportGap:5}).category).toBe("critical");
  });
  it("records accessibility, caregiving, and evidence risks",()=>{const result=assessApplication({...base,disability:true,caregiving:true,conflicting:true,unusual:true,lowConfidence:true,sensitive:true});expect(result.fairnessWarnings).toHaveLength(2);expect(result.riskFactors).toHaveLength(3);expect(result.confidence).toBe(65);expect(result.reviewPathway).toContain("Mandatory")});
});

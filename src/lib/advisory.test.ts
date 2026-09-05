import { describe, expect, it } from "vitest";
import { validateAdvisory } from "./advisory";

const valid = {
  confidence: 80,
  reasons: ["Verified hardship and access factors support prioritization."],
  riskFactors: [],
  missingInformation: [],
  fairnessWarnings: [],
  recommendedAction: "Prioritize for qualified committee consideration.",
  reviewPathway: "Qualified human review is required.",
};

describe("governed advisory validation", () => {
  it("accepts constrained advisory output", () => {
    expect(validateAdvisory(valid, true)).toEqual(valid);
  });

  it.each([
    "Approve this application",
    "Reject this request",
    "Diagnose the applicant",
  ])(
    "rejects prohibited final or diagnostic language: %s",
    (recommendedAction) => {
      expect(() =>
        validateAdvisory({ ...valid, recommendedAction }, true),
      ).toThrow();
    },
  );

  it("rejects a missing mandatory human-review pathway", () => {
    expect(() =>
      validateAdvisory(
        { ...valid, reviewPathway: "Continue processing." },
        true,
      ),
    ).toThrow(/human-review pathway/);
  });
});

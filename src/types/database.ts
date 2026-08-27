export const ROLES = [
  "intake_officer",
  "medical_verification_officer",
  "social_financial_assessment_officer",
  "case_review_committee",
  "human_oversight_committee",
  "appeals_reviewer",
  "admin",
] as const;
export type Role = (typeof ROLES)[number];
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export interface AssessmentInput {
  medicalUrgency: number;
  financialHardship: number;
  accessBarriers: number;
  unmetNeed: number;
  vulnerability: number;
  supportGap: number;
  missingDocuments: boolean;
  missedAppointments: boolean;
  rural: boolean;
  transportDifficulty: boolean;
  disability: boolean;
  caregiving: boolean;
  urgent: boolean;
  sensitive: boolean;
  appealed: boolean;
  conflicting: boolean;
  unusual: boolean;
  lowConfidence: boolean;
  child: boolean;
  elderly: boolean;
  pregnant: boolean;
}
export interface AssessmentResult {
  score: number;
  category: "critical" | "high" | "moderate" | "standard";
  confidence: number;
  reasons: string[];
  riskFactors: string[];
  missingInformation: string[];
  fairnessWarnings: string[];
  recommendedAction: string;
  reviewPathway: string;
  requiresHumanReview: true;
  rulesVersion: string;
}

import { assessmentInputSchema, assessApplication } from "@/lib/assessment";
import { z } from "zod";
export const evaluationDatasetSchema=z.object({name:z.string().min(2).max(100),version:z.string().min(1).max(40),cases:z.array(z.object({reference:z.string().min(1).max(100),input:assessmentInputSchema,expectedCategory:z.enum(["critical","high","moderate","standard"])})).min(1).max(1000)});
export type EvaluationRules={critical?:number;high?:number;moderate?:number};
export function categoryForScore(score:number,rules:EvaluationRules){if(score>=(rules.critical??80))return "critical";if(score>=(rules.high??60))return "high";if(score>=(rules.moderate??40))return "moderate";return "standard"}
export function evaluateCase(input:z.infer<typeof assessmentInputSchema>,expected:string,beforeRules:EvaluationRules,afterRules:EvaluationRules){const base=assessApplication(input);const before=categoryForScore(base.score,beforeRules);const after=categoryForScore(base.score,afterRules);return {score:base.score,before,after,expected,regression:after!==expected&&before===expected,improved:after===expected&&before!==expected}}

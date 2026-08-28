import { assessmentInputSchema, assessApplication } from "@/lib/assessment";
import { z } from "zod";
export const evaluationDatasetSchema=z.object({name:z.string().min(2).max(100),version:z.string().min(1).max(40),cases:z.array(z.object({reference:z.string().min(1).max(100),input:assessmentInputSchema,expectedCategory:z.enum(["critical","high","moderate","standard"]),subgroup:z.record(z.string(),z.union([z.string().max(80),z.boolean()])).default({})})).min(20).max(1000)});
export type EvaluationRules={critical?:number;high?:number;moderate?:number};
export const EVALUATION_GATES={minimumCases:20,minimumAccuracy:0.8,maximumRegressions:0,maximumCriticalRegressions:0,minimumSubgroupSize:5,maximumSubgroupAccuracyGap:0.15} as const;
export function categoryForScore(score:number,rules:EvaluationRules){if(score>=(rules.critical??80))return "critical";if(score>=(rules.high??60))return "high";if(score>=(rules.moderate??40))return "moderate";return "standard"}
export function evaluateCase(input:z.infer<typeof assessmentInputSchema>,expected:string,beforeRules:EvaluationRules,afterRules:EvaluationRules){const base=assessApplication(input);const before=categoryForScore(base.score,beforeRules);const after=categoryForScore(base.score,afterRules);return {score:base.score,before,after,expected,regression:after!==expected&&before===expected,improved:after===expected&&before!==expected}}

export type EvaluationOutcome={expected:string;before:string;after:string;subgroup?:Record<string,string|boolean>};
export function summarizeEvaluation(results:EvaluationOutcome[]){
  const caseCount=results.length;
  const regressions=results.filter(r=>r.after!==r.expected&&r.before===r.expected).length;
  const criticalRegressions=results.filter(r=>r.expected==="critical"&&r.after!=="critical"&&r.before==="critical").length;
  const accuracy=caseCount?results.filter(r=>r.after===r.expected).length/caseCount:0;
  const buckets=new Map<string,{correct:number;total:number}>();
  for(const result of results)for(const [dimension,value] of Object.entries(result.subgroup??{})){
    const key=`${dimension}:${String(value)}`;const bucket=buckets.get(key)??{correct:0,total:0};bucket.total++;if(result.after===result.expected)bucket.correct++;buckets.set(key,bucket);
  }
  const subgroupRates=[...buckets.entries()].filter(([,v])=>v.total>=EVALUATION_GATES.minimumSubgroupSize).map(([group,v])=>({group,count:v.total,accuracy:v.correct/v.total}));
  const subgroupAccuracyGap=subgroupRates.length>=2?Math.max(...subgroupRates.map(v=>v.accuracy))-Math.min(...subgroupRates.map(v=>v.accuracy)):null;
  const gates={minimumDataset:caseCount>=EVALUATION_GATES.minimumCases,minimumAccuracy:accuracy>=EVALUATION_GATES.minimumAccuracy,zeroRegressions:regressions<=EVALUATION_GATES.maximumRegressions,zeroCriticalRegressions:criticalRegressions<=EVALUATION_GATES.maximumCriticalRegressions,subgroupFairness:subgroupAccuracyGap!==null&&subgroupAccuracyGap<=EVALUATION_GATES.maximumSubgroupAccuracyGap};
  return {case_count:caseCount,accuracy,regressions,critical_regressions:criticalRegressions,subgroup_accuracy_gap:subgroupAccuracyGap,subgroups:subgroupRates,gates,criteria_met:Object.values(gates).every(Boolean),thresholds:EVALUATION_GATES};
}

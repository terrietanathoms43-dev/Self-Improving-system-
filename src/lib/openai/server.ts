import "server-only";
import { z } from "zod";
import type { AssessmentInput, AssessmentResult } from "@/types/database";

const endpoint = "https://api.openai.com/v1";
function config() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseModel = process.env.OPENAI_TRAINING_BASE_MODEL;
  if (!apiKey || !baseModel) throw new Error("OpenAI training is not configured");
  return { apiKey, baseModel };
}
async function openAI(path: string, init: RequestInit) {
  const { apiKey } = config();
  const response = await fetch(`${endpoint}${path}`, { ...init, headers: { Authorization: `Bearer ${apiKey}`, ...init.headers }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error?.message === "string" ? data.error.message.slice(0, 300) : "OpenAI request failed");
  return data;
}
export async function createOpenAITrainingJob(content: string, filename: string) {
  const { baseModel } = config();
  const form = new FormData();
  form.set("purpose", "fine-tune");
  form.set("file", new File([content], filename, { type: "application/jsonl" }));
  const file = await openAI("/files", { method: "POST", body: form }) as { id: string };
  const job = await openAI("/fine_tuning/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ training_file: file.id, model: baseModel }) }) as { id: string; status: string };
  return { fileId: file.id, jobId: job.id, status: job.status, baseModel };
}
export async function getOpenAITrainingJob(jobId: string) {
  return openAI(`/fine_tuning/jobs/${encodeURIComponent(jobId)}`, { method: "GET" }) as Promise<{ id: string; status: string; fine_tuned_model?: string | null; finished_at?: number | null; error?: { message?: string } | null }>;
}
export function isOpenAIConfigured() { return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_TRAINING_BASE_MODEL); }

const advisorySchema=z.object({confidence:z.number().min(0).max(100),reasons:z.array(z.string().min(1).max(300)).max(12),riskFactors:z.array(z.string().min(1).max(300)).max(12),missingInformation:z.array(z.string().min(1).max(300)).max(12),fairnessWarnings:z.array(z.string().min(1).max(300)).max(12),recommendedAction:z.string().min(1).max(1000),reviewPathway:z.string().min(1).max(1000)});
export async function createOpenAIAdvisory(model:string,input:AssessmentInput,authoritative:AssessmentResult){
  const response=await openAI("/chat/completions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model,temperature:0,messages:[{role:"system",content:"You are a constrained advisory assistant for a Jamaican medical-assistance fund. Do not diagnose. Do not make a final decision. The deterministic score and category are immutable. Explain safeguards and human-review needs using only the supplied de-identified fields. Return JSON only."},{role:"user",content:JSON.stringify({deidentifiedInput:input,lockedScore:authoritative.score,lockedCategory:authoritative.category,lockedSafeguards:{requiresHumanReview:true,noAiOnlyRejection:true}})}],response_format:{type:"json_object"}})}) as {choices?:Array<{message?:{content?:string}}>;usage?:{prompt_tokens?:number;completion_tokens?:number;total_tokens?:number}};
  const content=response.choices?.[0]?.message?.content;if(!content)throw new Error("OpenAI advisory returned no content");
  return {advisory:advisorySchema.parse(JSON.parse(content)),usage:response.usage};
}

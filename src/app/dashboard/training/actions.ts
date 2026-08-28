"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { buildTrainingJsonl, type TrainingSource } from "@/lib/training";
import { createOpenAITrainingJob, getOpenAITrainingJob } from "@/lib/openai/server";

const datasetSchema = z.object({ name: z.string().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/), version: z.string().min(1).max(40).regex(/^[a-zA-Z0-9._-]+$/) });
export async function prepareTrainingDataset(fd: FormData) {
  const actor = await requireActor(["human_oversight_committee", "admin"]);
  const input = datasetSchema.parse(Object.fromEntries(fd));
  const admin = createAdminClient();
  const { data: reviews, error } = await admin.from("cbg_human_reviews").select("disposition,proposed_decision,final_score,final_category,cbg_ai_assessments(score,category,confidence,input_snapshot,requires_human_review),cbg_human_corrections(category,bias_concern,policy_gap)").order("reviewed_at", { ascending: false }).limit(5000);
  if (error) throw error;
  const sources = (reviews ?? []).flatMap((row) => {
    const assessment = row.cbg_ai_assessments as unknown as TrainingSource["assessment"] | null;
    const correctionValue = row.cbg_human_corrections as unknown as TrainingSource["correction"] | TrainingSource["correction"][];
    const correction = Array.isArray(correctionValue) ? correctionValue[0] ?? null : correctionValue;
    if (!assessment || !row.final_category) return [];
    return [{ assessment, review: { disposition: row.disposition, proposed_decision: row.proposed_decision, final_score: row.final_score, final_category: row.final_category }, correction } satisfies TrainingSource];
  });
  if (sources.length < 10) throw new Error("At least 10 completed, verified human reviews are required");
  const jsonl = buildTrainingJsonl(sources);
  const storagePath = `${actor.id}/${input.name}-${input.version}-${jsonl.hash.slice(0, 12)}.jsonl`;
  const { error: uploadError } = await admin.storage.from("cbg-training-datasets").upload(storagePath, jsonl.content, { contentType: "application/jsonl", upsert: false });
  if (uploadError) throw uploadError;
  const { data: dataset, error: insertError } = await admin.from("cbg_training_datasets").insert({ ...input, status: "ready", example_count: jsonl.count, content_hash: jsonl.hash, storage_path: storagePath, created_by: actor.id, filters: { source: "verified_human_reviews", maximum_examples: 5000 } }).select("id").single();
  if (insertError) { await admin.storage.from("cbg-training-datasets").remove([storagePath]); throw insertError; }
  await admin.from("cbg_audit_logs").insert({ actor_id: actor.id, actor_role: actor.roles[0], action: "training_dataset_prepared", entity_type: "training_dataset", entity_id: dataset.id, metadata: { example_count: jsonl.count, content_hash: jsonl.hash } });
  revalidatePath("/dashboard/training");
}

const approvalSchema = z.object({ datasetId: z.uuid(), reason: z.string().min(20).max(3000), conflict: z.string().optional() });
export async function approveTrainingDataset(fd: FormData) {
  const actor = await requireActor(["human_oversight_committee"]);
  const input = approvalSchema.parse(Object.fromEntries(fd));
  if (input.conflict === "on") throw new Error("A member with a conflict cannot approve a training dataset");
  const admin = createAdminClient();
  const { error } = await admin.from("cbg_training_datasets").update({ status: "approved", approved_by: actor.id, approved_at: new Date().toISOString(), approval_reason: input.reason, conflict_of_interest: false }).eq("id", input.datasetId).eq("status", "ready");
  if (error) throw error;
  await admin.from("cbg_audit_logs").insert({ actor_id: actor.id, actor_role: "human_oversight_committee", action: "training_dataset_approved", entity_type: "training_dataset", entity_id: input.datasetId, metadata: { reason: input.reason } });
  revalidatePath("/dashboard/training");
}

const runSchema = z.object({ datasetId: z.uuid(), reason: z.string().min(20).max(3000), conflicts: z.string().min(3).max(1000) });
export async function startTraining(fd: FormData) {
  const actor = await requireActor(["human_oversight_committee"]);
  const input = runSchema.parse(Object.fromEntries(fd));
  const admin = createAdminClient();
  const { data: dataset } = await admin.from("cbg_training_datasets").select("*").eq("id", input.datasetId).eq("status", "approved").single();
  if (!dataset) throw new Error("Approved dataset not found");
  const baseModel = process.env.OPENAI_TRAINING_BASE_MODEL;
  if (!baseModel || !process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY and OPENAI_TRAINING_BASE_MODEL are required");
  const { data: run, error } = await admin.from("cbg_training_runs").insert({ dataset_id: dataset.id, base_model: baseModel, status: "uploading", requested_by: actor.id, approved_by: actor.id, approval_reason: input.reason, conflicts_declared: input.conflicts }).select("id").single();
  if (error || !run) throw error ?? new Error("Training run could not be created");
  try {
    const { data: blob, error: downloadError } = await admin.storage.from("cbg-training-datasets").download(dataset.storage_path);
    if (downloadError) throw downloadError;
    const provider = await createOpenAITrainingJob(await blob.text(), dataset.storage_path.split("/").at(-1) ?? "training.jsonl");
    await admin.from("cbg_training_runs").update({ provider_file_id: provider.fileId, provider_job_id: provider.jobId, status: ["running","validating_files"].includes(provider.status) ? "running" : "queued", started_at: new Date().toISOString() }).eq("id", run.id);
    await admin.from("cbg_training_datasets").update({ status: "submitted" }).eq("id", dataset.id);
  } catch (cause) {
    const safeError = cause instanceof Error ? cause.message.slice(0, 300) : "OpenAI training request failed";
    await admin.from("cbg_training_runs").update({ status: "unavailable", safe_error: safeError, completed_at: new Date().toISOString() }).eq("id", run.id);
    throw new Error(`Training was recorded but OpenAI did not accept the job: ${safeError}`);
  } finally { revalidatePath("/dashboard/training"); }
}

const syncSchema = z.object({ runId: z.uuid() });
export async function syncTrainingRun(fd: FormData) {
  const actor = await requireActor(["human_oversight_committee", "admin"]);
  const { runId } = syncSchema.parse(Object.fromEntries(fd));
  const admin = createAdminClient();
  const { data: run } = await admin.from("cbg_training_runs").select("provider_job_id").eq("id", runId).single();
  if (!run?.provider_job_id) throw new Error("This run has no OpenAI job identifier");
  const job = await getOpenAITrainingJob(run.provider_job_id);
  const mapped = job.status === "succeeded" ? "succeeded" : job.status === "failed" ? "failed" : job.status === "cancelled" ? "cancelled" : "running";
  await admin.from("cbg_training_runs").update({ status: mapped, output_model: mapped === "succeeded" ? job.fine_tuned_model ?? null : null, safe_error: job.error?.message?.slice(0, 300) ?? null, completed_at: ["succeeded","failed","cancelled"].includes(mapped) ? new Date().toISOString() : null }).eq("id", runId);
  const s = await createClient();
  await s.from("cbg_audit_logs").insert({ actor_id: actor.id, actor_role: actor.roles[0], action: "training_status_synchronized", entity_type: "training_run", entity_id: runId, metadata: { status: mapped } });
  revalidatePath("/dashboard/training");
}

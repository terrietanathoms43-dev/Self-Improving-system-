import "server-only";

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

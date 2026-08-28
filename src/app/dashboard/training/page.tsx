import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured } from "@/lib/openai/server";
import { Badge, Card, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { approveTrainingDataset, prepareTrainingDataset, startTraining, syncTrainingRun } from "./actions";

export default async function TrainingPage() {
  await requireActor(["human_oversight_committee", "admin"]);
  const s = await createClient();
  const [{ data: datasets }, { data: runs }] = await Promise.all([
    s.from("cbg_training_datasets").select("*").order("created_at", { ascending: false }),
    s.from("cbg_training_runs").select("*,cbg_training_datasets(name,version)").order("created_at", { ascending: false }),
  ]);
  const configured = isOpenAIConfigured();
  return <>
    <h1 className="text-3xl font-bold">OpenAI training governance</h1>
    <p className="mt-2 text-slate-600">Prepare de-identified examples from verified corrections, approve the dataset, submit a provider job, then evaluate separately. Training never activates a model.</p>
    <div className="mt-4"><Badge tone={configured ? "success" : "danger"}>{configured ? "OpenAI configured" : "OpenAI configuration required"}</Badge></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <Card><h2 className="font-semibold">1. Prepare de-identified dataset</h2><p className="mt-2 text-sm text-slate-600">Uses only allow-listed scores, safeguard flags, and verified human outcomes. A minimum of 10 completed reviews is required.</p><form action={prepareTrainingDataset} className="mt-4 grid gap-3"><Input name="name" placeholder="Dataset name" required/><Input name="version" placeholder="Version, e.g. 2026.08" required/><SubmitButton>Prepare immutable JSONL dataset</SubmitButton></form></Card>
      <Card><h2 className="font-semibold">2. Committee dataset approval</h2><form action={approveTrainingDataset} className="mt-4 grid gap-3"><Select name="datasetId" required><option value="">Ready dataset</option>{(datasets??[]).filter(d=>d.status==="ready").map(d=><option key={d.id} value={d.id}>{d.name} · {d.version} · {d.example_count} examples</option>)}</Select><Textarea name="reason" minLength={20} placeholder="Approval reason and evidence considered" required/><label className="flex gap-2 text-sm"><input type="checkbox" name="conflict"/>I have a conflict of interest</label><SubmitButton>Approve dataset manually</SubmitButton></form></Card>
      <Card><h2 className="font-semibold">3. Submit approved OpenAI training</h2><form action={startTraining} className="mt-4 grid gap-3"><Select name="datasetId" required><option value="">Approved dataset</option>{(datasets??[]).filter(d=>d.status==="approved").map(d=><option key={d.id} value={d.id}>{d.name} · {d.version}</option>)}</Select><Textarea name="reason" minLength={20} placeholder="Why this training run is authorized" required/><Textarea name="conflicts" minLength={3} placeholder="Conflicts declared, or write None" required/><SubmitButton disabled={!configured}>Submit training job</SubmitButton></form></Card>
      <Card><h2 className="font-semibold">Dataset register</h2><div className="mt-4 space-y-3">{(datasets??[]).map(d=><div className="rounded-lg border p-3" key={d.id}><div className="flex justify-between gap-2"><strong>{d.name} · {d.version}</strong><Badge>{d.status}</Badge></div><p className="mt-1 text-sm text-slate-500">{d.example_count} examples · de-identification {d.deidentification_version}</p><p className="mt-1 truncate font-mono text-xs text-slate-400" title={d.content_hash}>{d.content_hash}</p></div>)}</div></Card>
    </div>
    <Card className="mt-6"><h2 className="font-semibold">Training run register</h2><div className="mt-4 space-y-3">{(runs??[]).map(r=><div key={r.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_auto]"><div><Badge tone={r.status==="succeeded"?"success":r.status==="failed"||r.status==="unavailable"?"danger":"default"}>{r.status}</Badge><p className="mt-2 font-semibold">{r.base_model}</p><p className="text-sm text-slate-500">Provider job: {r.provider_job_id??"not accepted"}</p>{r.output_model?<p className="text-sm">Output model: <span className="font-mono">{r.output_model}</span> — evaluation still required</p>:null}{r.safe_error?<p className="mt-1 text-sm text-red-700">{r.safe_error}</p>:null}</div>{r.provider_job_id&&!['succeeded','failed','cancelled'].includes(r.status)?<form action={syncTrainingRun}><input type="hidden" name="runId" value={r.id}/><SubmitButton>Sync OpenAI status</SubmitButton></form>:null}</div>)}</div></Card>
  </>;
}

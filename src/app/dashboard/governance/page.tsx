import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { activateVersion, createDraftVersion, createProposal, decideProposal, refreshPatterns, rollbackVersion, runEvaluation, uploadEvaluationDataset } from "./actions";
export default async function Governance() {
  await requireActor(["human_oversight_committee", "admin"]);
  const s = await createClient();
  const [{ data: proposals }, { data: versions }, { data: evaluations }, {data: patterns}, {data:trainedModels}] =
    await Promise.all([
      s
        .from("cbg_policy_proposals")
        .select("*")
        .order("created_at", { ascending: false }),
      s
        .from("cbg_model_versions")
        .select("*")
        .order("created_at", { ascending: false }),
      s
        .from("cbg_model_evaluations")
        .select("*,cbg_model_versions(version)")
        .order("created_at", { ascending: false }),
      s.from("cbg_correction_patterns").select("*").order("last_seen_at",{ascending:false}),
      s.from("cbg_trained_models").select("id,provider_model_id,status").in("status",["registered","draft_linked","evaluated","eligible"]).order("registered_at",{ascending:false}),
    ]);
  return (
    <>
      <h1 className="text-3xl font-bold">Rules and model governance</h1>
      <p className="mt-2 text-slate-600">
        Draft → evaluate → committee approval → manual activation. Automatic
        retraining and deployment are disabled.
      </p>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Policy-improvement queue</h2>
          <div className="mt-4 space-y-3">
            {(proposals ?? []).map((p) => (
              <div key={p.id} className="rounded-lg border p-4">
                <Badge>{p.status}</Badge>
                <h3 className="mt-2 font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {p.problem_statement}
                </p>
              </div>
            ))}
            {!proposals?.length ? (
              <p className="text-sm text-slate-500">
                No proposals awaiting review.
              </p>
            ) : null}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Version history and rollback</h2>
          <div className="mt-4 space-y-3">
            {(versions ?? []).map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-mono font-semibold">{v.version}</p>
                  <p className="text-sm text-slate-500">{v.change_summary}</p>
                </div>
                <Badge tone={v.status === "active" ? "success" : "default"}>
                  {v.status}
                </Badge>
              </div>
            ))}
            {!versions?.length ? (
              <p className="text-sm text-slate-500">
                No version has been configured.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Correction-pattern detection</h2><form action={refreshPatterns}><SubmitButton>Refresh verified patterns</SubmitButton></form></div><div className="mt-4 space-y-2">{(patterns??[]).map(p=><p key={p.id} className="rounded-lg bg-slate-50 p-3 text-sm"><strong>{p.correction_category.replaceAll("_"," ")}</strong> · {p.occurrence_count} cases</p>)}</div></Card>
        <Card><h2 className="font-semibold">Create policy proposal</h2><form action={createProposal} className="mt-4 grid gap-3"><Select name="patternId"><option value="">No linked pattern</option>{(patterns??[]).map(p=><option key={p.id} value={p.id}>{p.correction_category}</option>)}</Select><Input name="title" placeholder="Proposal title" required/><Textarea name="problem" placeholder="Problem statement" minLength={20} required/><Textarea name="change" placeholder="Proposed rules change" minLength={20} required/><Textarea name="evidence" placeholder="Evidence considered" minLength={20} required/><SubmitButton>Submit for committee review</SubmitButton></form></Card>
      </div>
      <Card className="mt-6"><h2 className="font-semibold">Manual committee decisions</h2><div className="mt-4 space-y-4">{(proposals??[]).filter(p=>p.status==="committee_review").map(p=><form key={p.id} action={decideProposal} className="rounded-lg border p-4"><input type="hidden" name="proposalId" value={p.id}/><p className="font-semibold">{p.title}</p><div className="mt-3 grid gap-3 md:grid-cols-2"><Select name="decision"><option value="approved">Approve proposal</option><option value="rejected">Reject proposal</option></Select><label className="flex items-center gap-2 text-sm"><input name="conflict" type="checkbox"/>I have a conflict of interest</label><Textarea name="reason" className="md:col-span-2" placeholder="Committee reason" minLength={20} required/><SubmitButton className="md:col-span-2">Record committee decision</SubmitButton></div></form>)}</div></Card>
      <Card className="mt-6"><h2 className="font-semibold">Create traceable draft version</h2><p className="mt-2 text-sm text-slate-600">Only approved proposals can become drafts. A trained OpenAI model may be linked for governed advisory use; it cannot change the rules score or issue a final decision.</p><form action={createDraftVersion} className="mt-4 grid gap-3 md:grid-cols-2"><Select name="proposalId" required><option value="">Approved proposal</option>{(proposals??[]).filter(p=>p.status==="approved").map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</Select><Input name="version" placeholder="Version, e.g. 2026.09-draft" required/><Input name="critical" type="number" min={1} max={100} defaultValue={80} required/><Input name="high" type="number" min={1} max={99} defaultValue={60} required/><Input name="moderate" type="number" min={0} max={98} defaultValue={40} required/><Select name="trainedModelId"><option value="">Rules only</option>{(trainedModels??[]).filter(m=>m.status==="registered").map(m=><option key={m.id} value={m.id}>{m.provider_model_id}</option>)}</Select><Textarea name="summary" className="md:col-span-2" placeholder="Version changes and evidence trace" minLength={20} required/><SubmitButton className="md:col-span-2">Create draft from approved proposal</SubmitButton></form></Card>
      <Card className="mt-6">
        <h2 className="font-semibold">Evaluation and regression results</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(evaluations ?? []).map((e) => (
            <div key={e.id} className="rounded-lg bg-slate-50 p-4">
              <Badge
                tone={
                  e.status === "passed"
                    ? "success"
                    : e.status === "failed"
                      ? "danger"
                      : "default"
                }
              >
                {e.status}
              </Badge>
              <p className="mt-2 font-semibold">
                {
                  (e.cbg_model_versions as unknown as { version: string })
                    ?.version
                }
              </p>
              <p className="text-sm text-slate-500">
                {e.dataset_name} · {e.dataset_version}
              </p>
              <EvaluationSummary summary={e.summary as Record<string,unknown>}/>
            </div>
          ))}
        </div>
      </Card>
      <div className="mt-6 grid gap-6 xl:grid-cols-2"><Card><h2 className="font-semibold">Authorized evaluation dataset</h2><p className="mt-2 text-sm text-slate-600">JSON only. Case references are hashed before storage.</p><form action={uploadEvaluationDataset} className="mt-4 grid gap-3"><Input name="dataset" type="file" accept="application/json" required/><SubmitButton>Upload evaluation dataset</SubmitButton></form></Card><Card><h2 className="font-semibold">Run regression evaluation</h2><form action={runEvaluation} className="mt-4 grid gap-3"><Select name="versionId" required><option value="">Draft version</option>{(versions??[]).filter(v=>v.status!=="active").map(v=><option key={v.id} value={v.id}>{v.version}</option>)}</Select><Select name="baselineId" required><option value="">Baseline version</option>{(versions??[]).map(v=><option key={v.id} value={v.id}>{v.version}</option>)}</Select><Input name="datasetName" placeholder="Dataset name" required/><Input name="datasetVersion" placeholder="Dataset version" required/><SubmitButton>Run before-and-after evaluation</SubmitButton></form></Card></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2"><Card><h2 className="font-semibold">Activate evaluated version</h2><form action={activateVersion} className="mt-4 grid gap-3"><Select name="versionEvaluation" required><option value="">Exact passed evaluation and version</option>{(evaluations??[]).filter(e=>e.status==="passed"&&(e.summary as {criteria_met?:boolean})?.criteria_met).map(e=><option key={e.id} value={`${e.model_version_id}:${e.id}`}>{(e.cbg_model_versions as unknown as {version:string})?.version} · {e.dataset_name} {e.dataset_version}</option>)}</Select><Textarea name="reason" placeholder="Approval reason" minLength={20} required/><Textarea name="evidence" placeholder="Evidence considered" minLength={20} required/><label className="flex gap-2 text-sm"><input name="conflict" type="checkbox"/>I have a conflict of interest</label><SubmitButton>Approve and activate manually</SubmitButton></form></Card><Card><h2 className="font-semibold">Controlled rollback</h2><form action={rollbackVersion} className="mt-4 grid gap-3"><Select name="currentId" required><option value="">Current active version</option>{(versions??[]).filter(v=>v.status==="active").map(v=><option key={v.id} value={v.id}>{v.version}</option>)}</Select><Select name="targetId" required><option value="">Previous eligible version</option>{(versions??[]).filter(v=>["retired","approved"].includes(v.status)).map(v=><option key={v.id} value={v.id}>{v.version}</option>)}</Select><Textarea name="reason" placeholder="Rollback reason and evidence" minLength={20} required/><SubmitButton>Perform audited rollback</SubmitButton></form></Card></div>
    </>
  );
}

function EvaluationSummary({summary}:{summary:Record<string,unknown>}){const accuracy=Math.max(0,Math.min(100,Number(summary.accuracy??0)*100));const gap=summary.subgroup_accuracy_gap==null?null:Math.max(0,Math.min(100,Number(summary.subgroup_accuracy_gap)*100));return <div className="mt-3 space-y-3 text-xs"><div><div className="flex justify-between"><span>Accuracy</span><strong>{accuracy.toFixed(1)}%</strong></div><div className="mt-1 h-2 overflow-hidden rounded bg-slate-200"><div className="h-full bg-teal-600" style={{width:`${accuracy}%`}}/></div></div><div className="grid grid-cols-2 gap-2"><div className="rounded bg-white p-2"><span className="text-slate-500">Regressions</span><p className="text-lg font-bold">{String(summary.regressions??"—")}</p></div><div className="rounded bg-white p-2"><span className="text-slate-500">Fairness gap</span><p className="text-lg font-bold">{gap==null?"Not measured":`${gap.toFixed(1)}%`}</p></div></div><p className={summary.criteria_met?"text-emerald-700":"text-red-700"}>{summary.criteria_met?"All activation gates met":"Not eligible for activation"}</p></div>}

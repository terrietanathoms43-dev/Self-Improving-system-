import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { decideAppeal, submitAppeal } from "../operations/actions";

export default async function AppealsPage({searchParams}:{searchParams:Promise<{success?:string}>}) {
  const {success}=await searchParams;
  const actor=await requireActor(["appeals_reviewer","case_review_committee","admin"]);
  const s=await createClient();
  const [{data:decided},{data:appeals}]=await Promise.all([
    s.from("cbg_applications").select("id,reference_number").eq("status","decided"),
    s.from("cbg_appeals").select("id,reason,status,submitted_at,cbg_applications(reference_number)").order("submitted_at",{ascending:false}),
  ]);
  const canDecide=actor.roles.some((role)=>["appeals_reviewer","admin"].includes(role));
  return <>
    <h1 className="text-3xl font-bold">Appeals monitoring</h1>
    <p className="mt-2 text-slate-600">Appeals remain separate from the original decision and require an independent, explained review.</p>
    {success?<p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>:null}
    <Card className="mt-6">
      <h2 className="font-semibold">Record a new appeal</h2>
      <form action={submitAppeal} className="mt-4 grid gap-3">
        <Select name="applicationId" required><option value="">Select decided case</option>{(decided??[]).map((a)=><option key={a.id} value={a.id}>{a.reference_number}</option>)}</Select>
        <Textarea name="reason" minLength={20} placeholder="Reason for appeal" required/>
        <Textarea name="evidence" placeholder="Additional evidence received"/>
        <SubmitButton pendingLabel="Submitting appeal…">Submit appeal</SubmitButton>
      </form>
    </Card>
    <div className="mt-6 space-y-4">{(appeals??[]).map((appeal)=><Card key={appeal.id}>
      <Badge>{appeal.status}</Badge>
      <h2 className="mt-2 font-mono font-semibold">{(appeal.cbg_applications as unknown as {reference_number:string})?.reference_number}</h2>
      <p className="mt-2 text-sm">{appeal.reason}</p>
      {canDecide&&appeal.status!=="decided"?<form action={decideAppeal} className="mt-4 grid gap-3">
        <input type="hidden" name="appealId" value={appeal.id}/>
        <Select name="outcome"><option value="upheld">Original decision upheld</option><option value="modified">Modified</option><option value="overturned">Overturned</option><option value="more_information">More information needed</option></Select>
        <Textarea name="explanation" minLength={20} placeholder="Evidence-based explanation" required/>
        <SubmitButton pendingLabel="Recording decision…">Record appeal decision</SubmitButton>
      </form>:null}
    </Card>)}</div>
  </>;
}

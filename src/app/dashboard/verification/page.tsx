import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { submitMedicalVerification, submitSocialAssessment } from "../operations/actions";

export default async function VerificationPage(){
  const actor=await requireActor(["medical_verification_officer","social_financial_assessment_officer","admin"]); const s=await createClient();
  const {data: apps}=await s.from("cbg_applications").select("id,reference_number,status,parish").in("status",["medical_verification","social_assessment"]).order("submitted_at");
  const canMedical=actor.roles.some(r=>["medical_verification_officer","admin"].includes(r)); const canSocial=actor.roles.some(r=>["social_financial_assessment_officer","admin"].includes(r));
  return <><h1 className="text-3xl font-bold">Medical and social verification</h1><p className="mt-2 text-slate-600">Scores follow the published 30/20/20/15/10/5 limits. The system never diagnoses an applicant.</p>
    <div className="mt-6 space-y-4">{(apps??[]).map(a=><Card key={a.id}><p className="font-mono font-semibold">{a.reference_number}</p><p className="text-sm text-slate-500">{a.parish} · {String(a.status).replaceAll("_"," ")}</p>
      {a.status==="medical_verification"&&canMedical?<form action={submitMedicalVerification} className="mt-4 grid gap-3"><input type="hidden" name="applicationId" value={a.id}/><label className="text-sm font-medium">Medical urgency (0–30)<Input name="urgencyScore" type="number" min="0" max="30" required/></label><label className="text-sm font-medium">Verification summary<Textarea name="summary" minLength={20} required/></label><label className="flex gap-2 text-sm"><input type="checkbox" name="documentsComplete"/>Required medical documents verified</label><Button>Complete medical verification</Button></form>:null}
      {a.status==="social_assessment"&&canSocial?<form action={submitSocialAssessment} className="mt-4 grid gap-3"><input type="hidden" name="applicationId" value={a.id}/><div className="grid gap-3 sm:grid-cols-5">{[["financial","Hardship",20],["access","Access",20],["unmet","Unmet need",15],["vulnerability","Vulnerability",10],["support","Support gap",5]].map(([n,l,m])=><label key={String(n)} className="text-xs font-medium">{l}<Input name={String(n)} type="number" min="0" max={Number(m)} required/></label>)}</div><label className="text-sm font-medium">Assessment summary<Textarea name="summary" minLength={20} required/></label><div className="grid gap-2 sm:grid-cols-3"><Check n="missed" l="Missed appointments"/><Check n="transport" l="Transport difficulty"/><Check n="family" l="Family support available"/></div><Button>Complete social assessment</Button></form>:null}
    </Card>)}{!apps?.length?<Card><p className="text-slate-500">No applications are waiting for your verification stage.</p></Card>:null}</div></>;
}
function Check({n,l}:{n:string;l:string}){return <label className="flex gap-2 text-sm"><input type="checkbox" name={n}/>{l}</label>}

import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleHelp, ShieldCheck } from "lucide-react";
import { requireActor } from "@/lib/auth";
import { Card, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { restartOnboarding } from "../onboarding/actions";
import type { Role } from "@/types/database";

const guides: Record<Role,{title:string;steps:string[];href:string}>={
  intake_officer:{title:"Application intake",href:"/dashboard/intake",steps:["Confirm informed consent","Enter only necessary applicant details","Upload evidence securely","Send the case to verification"]},
  medical_verification_officer:{title:"Medical verification",href:"/dashboard/verification",steps:["Open the assigned case","Verify evidence without diagnosing","Record urgency and missing documents","Route onward for social assessment"]},
  social_financial_assessment_officer:{title:"Social and financial assessment",href:"/dashboard/verification",steps:["Review verified case information","Record hardship and access barriers","Consider disability and caregiving support","Route the completed case to assessment"]},
  case_review_committee:{title:"Qualified case review",href:"/dashboard/queue",steps:["Open an assessment-ready case","Review the AI score, reasons, warnings, and evidence","Agree, modify, or override with explanation","Record the human final decision"]},
  human_oversight_committee:{title:"AI governance",href:"/dashboard/governance",steps:["Review correction patterns and fairness alerts","Investigate evidence before drawing conclusions","Approve or reject policy proposals","Evaluate and manually activate approved versions"]},
  appeals_reviewer:{title:"Appeals review",href:"/dashboard/appeals",steps:["Open an independent appeal","Review the original decision and new evidence","Record an explained outcome","Confirm the appeal status is updated"]},
  admin:{title:"Administration and readiness",href:"/dashboard/system",steps:["Check system health and configuration","Manage least-privilege staff access","Review retention and audit records","Coordinate incident and readiness checks"]},
};

export default async function HelpPage(){
  const actor=await requireActor();
  const visible=actor.roles.map((role)=>({role,...guides[role]}));
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold text-teal-700">Staff guide</p><h1 className="text-3xl font-bold">Help and walkthrough</h1><p className="mt-2 max-w-3xl text-slate-600">Learn your responsibilities, follow the case workflow, and review the safeguards before taking action.</p></div>
      <form action={restartOnboarding}><SubmitButton pendingLabel="Restarting…">Replay guided tour</SubmitButton></form>
    </div>
    <Card className="mt-6 border-teal-200 bg-teal-50">
      <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-teal-700"/><div><h2 className="font-semibold">The rule that applies everywhere</h2><p className="mt-1 text-sm leading-6 text-slate-700">AI output is advisory. Missing information triggers follow-up, sensitive decisions require qualified human review, and production rules never change automatically.</p></div></div>
    </Card>
    <div className="mt-6 grid gap-5 xl:grid-cols-2">{visible.map((guide)=><Card key={guide.role}>
      <div className="flex items-start justify-between gap-3"><div><Badge>{guide.role.replaceAll("_"," ")}</Badge><h2 className="mt-3 text-xl font-semibold">{guide.title}</h2></div><CircleHelp className="h-5 w-5 text-teal-600"/></div>
      <ol className="mt-5 space-y-3">{guide.steps.map((step,index)=><li key={step} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 font-semibold text-teal-800">{index+1}</span><span className="pt-0.5 text-slate-700">{step}</span></li>)}</ol>
      <Link href={guide.href} className="mt-5 inline-flex items-center text-sm font-semibold text-teal-700">Open this workspace<ArrowRight className="ml-2 h-4 w-4"/></Link>
    </Card>)}</div>
    <Card className="mt-6"><h2 className="font-semibold">Before submitting any action</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{["Evidence has been checked","Explanation is clear and specific","Only necessary information is included"].map((item)=><div key={item} className="flex gap-2 rounded-lg bg-slate-50 p-3 text-sm"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600"/>{item}</div>)}</div></Card>
  </>;
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ShieldCheck, X } from "lucide-react";
import { completeOnboarding } from "@/app/dashboard/onboarding/actions";
import { Button } from "@/components/ui";
import type { Role } from "@/types/database";

const roleStarts: Partial<Record<Role,{title:string;description:string;href:string}>>={
  intake_officer:{title:"Start with application intake",description:"Record consent, enter the minimum necessary applicant information, and upload supporting documents.",href:"/dashboard/intake"},
  medical_verification_officer:{title:"Start with medical verification",description:"Verify submitted medical evidence and record urgency without diagnosing the applicant.",href:"/dashboard/verification"},
  social_financial_assessment_officer:{title:"Start with social assessment",description:"Document hardship, access barriers, vulnerability, and existing support without treating poverty as irresponsibility.",href:"/dashboard/verification"},
  case_review_committee:{title:"Start with the assessment queue",description:"Review the transparent recommendation, evidence, safeguards, and required human-review pathway.",href:"/dashboard/queue"},
  human_oversight_committee:{title:"Start with governance",description:"Investigate recurring corrections, review policy proposals, and control evaluation and version activation.",href:"/dashboard/governance"},
  appeals_reviewer:{title:"Start with appeals",description:"Review appeals independently and record a supported, explained outcome.",href:"/dashboard/appeals"},
  admin:{title:"Start with system health",description:"Check configuration, staff access, retention reviews, alerts, and operational readiness.",href:"/dashboard/system"},
};

export function OnboardingTour({roles}:{roles:Role[]}){
  const [open,setOpen]=useState(true);
  const [step,setStep]=useState(0);
  const [pending,startTransition]=useTransition();
  const start=roles.map((role)=>roleStarts[role]).find(Boolean)??roleStarts.case_review_committee!;
  const steps=[
    {title:"Welcome to CareBridge Jamaica",description:"This workspace helps authorized staff review AI-supported medical-assistance cases safely, fairly, and consistently."},
    start,
    {title:"AI recommendations are advisory",description:"Always check the reasons, missing information, fairness warnings, confidence, and evidence. The AI cannot diagnose or make an AI-only final rejection."},
    {title:"Explain every important action",description:"Overrides, appeals, approvals, corrections, and policy changes require supporting evidence and a meaningful explanation. Actions are audited."},
    {title:"Protect applicant privacy",description:"Only access information needed for your work. Never copy identifiable medical or financial information into general analytics, messages, or exports."},
  ];
  const current=steps[step];
  function finish(){startTransition(async()=>{await completeOnboarding();setOpen(false)});}
  if(!open)return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="tour-title">
    <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><ShieldCheck aria-hidden="true"/></div>
        <button onClick={finish} disabled={pending} aria-label="Close and complete walkthrough" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X aria-hidden="true" className="h-5 w-5"/></button>
      </div>
      <p className="mt-6 text-sm font-semibold text-teal-700">Step {step+1} of {steps.length}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full bg-teal-600 transition-all" style={{width:`${((step+1)/steps.length)*100}%`}}/></div>
      <h2 id="tour-title" className="mt-5 text-2xl font-bold">{current.title}</h2>
      <p className="mt-3 leading-7 text-slate-600">{current.description}</p>
      {step===1&&"href" in current?<Link href={current.href} className="mt-4 inline-flex text-sm font-semibold text-teal-700 underline" onClick={finish}>Open my starting workspace</Link>:null}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <button onClick={finish} disabled={pending} className="text-sm font-medium text-slate-500 underline">Skip for now</button>
        <div className="flex gap-2">
          {step>0?<Button type="button" onClick={()=>setStep((value)=>value-1)} disabled={pending} className="bg-slate-700 hover:bg-slate-600"><ArrowLeft className="mr-2 h-4 w-4"/>Back</Button>:null}
          {step<steps.length-1?<Button type="button" onClick={()=>setStep((value)=>value+1)}><span>Next</span><ArrowRight className="ml-2 h-4 w-4"/></Button>:<Button type="button" onClick={finish} disabled={pending}><Check className="mr-2 h-4 w-4"/>{pending?"Finishing…":"Finish walkthrough"}</Button>}
        </div>
      </div>
    </div>
  </div>;
}

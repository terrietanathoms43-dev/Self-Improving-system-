"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function DashboardError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{console.error("dashboard_error",{digest:error.digest})},[error.digest]);
  return <Card className="mx-auto max-w-2xl border-red-200">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-700"><AlertTriangle aria-hidden="true"/></div>
    <h1 className="mt-5 text-2xl font-bold">This page could not finish loading</h1>
    <p className="mt-2 text-slate-600">Your information has not been intentionally changed. Try the action again. If the problem continues, note the time and contact an administrator without copying applicant details.</p>
    {error.digest?<p className="mt-3 text-xs text-slate-500">Support reference: {error.digest}</p>:null}
    <div className="mt-6 flex flex-wrap gap-3"><Button type="button" onClick={reset}><RotateCcw className="mr-2 h-4 w-4"/>Try again</Button><Link href="/dashboard/help" className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold">Open help</Link><Link href="/dashboard" className="inline-flex h-10 items-center px-2 text-sm font-semibold text-teal-700">Return to overview</Link></div>
  </Card>;
}

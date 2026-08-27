import { createApplication } from "../operations/actions";
import { requireActor } from "@/lib/auth";
import { Button, Card, Input, Select } from "@/components/ui";

export default async function IntakePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireActor(["intake_officer", "admin"]); const { error } = await searchParams;
  return <><h1 className="text-3xl font-bold">Application intake</h1><p className="mt-2 text-slate-600">Record consent and the minimum applicant information needed to begin verification.</p>
    {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p> : null}
    <Card className="mt-6"><form action={createApplication} className="grid gap-4 md:grid-cols-2">
      <Field label="Full name"><Input name="fullName" required autoComplete="name" /></Field><Field label="Date of birth"><Input name="dateOfBirth" type="date" required /></Field>
      <Field label="Parish"><Select name="parish" required><option value="">Select parish</option>{["Kingston","St. Andrew","St. Catherine","Clarendon","Manchester","St. Elizabeth","Westmoreland","Hanover","St. James","Trelawny","St. Ann","St. Mary","Portland","St. Thomas"].map(x=><option key={x}>{x}</option>)}</Select></Field>
      <Field label="Phone"><Input name="phone" type="tel" /></Field><Field label="Address"><Input name="address" /></Field><Field label="Gender (optional)"><Input name="gender" /></Field>
      <Field label="Insurance status"><Input name="insuranceStatus" /></Field><Field label="Employment status"><Input name="employmentStatus" /></Field><Field label="Consent form version"><Input name="consentVersion" defaultValue="1.0" required /></Field>
      <div className="md:col-span-2 grid gap-2 sm:grid-cols-2"><Check name="rural" label="Rural location"/><Check name="disability" label="Disability support consideration"/><Check name="caregiving" label="Caregiving responsibilities"/><Check name="welfare" label="Existing welfare support"/></div>
      <p className="text-xs text-slate-500 md:col-span-2">Submitting confirms that consent was recorded. Sensitive information is restricted by role and logged.</p><Button className="md:col-span-2">Create application</Button>
    </form></Card></>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="grid gap-1 text-sm font-medium">{label}{children}</label>}
function Check({name,label}:{name:string;label:string}){return <label className="flex items-center gap-2 text-sm"><input name={name} type="checkbox" className="h-4 w-4"/>{label}</label>}

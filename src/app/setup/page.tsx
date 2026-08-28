import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button, Card, Input } from "@/components/ui";
import { initializeCareBridge } from "./actions";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/login?error=Sign+in+before+initializing+CareBridge");
  const allowed = process.env.CAREBRIDGE_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowed || user.email?.toLowerCase() !== allowed) redirect("/unauthorized");
  const { error } = await searchParams;
  return <main id="main" className="grid min-h-screen place-items-center bg-slate-100 p-4"><Card className="w-full max-w-lg"><p className="text-sm font-semibold text-teal-700">One-time protected setup</p><h1 className="mt-2 text-2xl font-bold">Initialize CareBridge administration</h1><p className="mt-2 text-sm text-slate-600">This creates the first CareBridge administrator only. It does not modify Cardora or Twofold roles.</p>{error?<div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>:null}<form action={initializeCareBridge} className="mt-6 space-y-4"><label className="block text-sm font-medium">Administrator name<Input className="mt-1" name="displayName" required/></label><label className="block text-sm font-medium">Type INITIALIZE CAREBRIDGE<Input className="mt-1" name="confirmation" required autoComplete="off"/></label><Button className="w-full">Create first administrator</Button></form></Card></main>;
}

"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security";
export async function login(formData: FormData) {
  try { await enforceRateLimit("staff_login", 8, 900); } catch { redirect("/login?error=Too+many+attempts.+Please+wait+and+try+again"); }
  const parsed = z
    .object({ email: z.email(), password: z.string().min(10).max(128) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=Invalid+credentials");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) redirect("/login?error=Sign-in+failed");
  const admin = createAdminClient();
  const { data: staff } = await admin.from("cbg_users").select("id,active").eq("id", data.user.id).maybeSingle();
  if (!staff) {
    const bootstrapEmail = process.env.CAREBRIDGE_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    if (bootstrapEmail && data.user.email?.toLowerCase() === bootstrapEmail) redirect("/setup");
    await supabase.auth.signOut();
    redirect("/login?error=This+account+is+not+authorized+for+CareBridge");
  }
  if (!staff.active) { await supabase.auth.signOut(); redirect("/login?error=This+CareBridge+account+is+suspended"); }
  await admin.from("cbg_users").update({ last_login_at: new Date().toISOString() }).eq("id", data.user.id);
  redirect("/dashboard");
}

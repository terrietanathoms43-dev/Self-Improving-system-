"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security";

const schema = z.object({ displayName: z.string().trim().min(2).max(100), confirmation: z.literal("INITIALIZE CAREBRIDGE") });

export async function initializeCareBridge(formData: FormData) {
  await enforceRateLimit("carebridge_bootstrap", 3, 3600);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/setup?error=Confirmation+is+incorrect");
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email) redirect("/login?error=Sign+in+before+initializing+CareBridge");
  const allowedEmail = process.env.CAREBRIDGE_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowedEmail || user.email.toLowerCase() !== allowedEmail) redirect("/unauthorized");
  const admin = createAdminClient();
  const { count } = await admin.from("cbg_user_roles").select("user_id,cbg_roles!inner(name)", { count: "exact", head: true }).eq("cbg_roles.name", "admin");
  if ((count ?? 0) > 0) redirect("/login?error=CareBridge+has+already+been+initialized");
  const { data: role, error: roleError } = await admin.from("cbg_roles").select("id").eq("name", "admin").single();
  if (roleError || !role) throw new Error("CareBridge administrator role is unavailable");
  const { error: userError } = await admin.from("cbg_users").upsert({ id: user.id, email: user.email, display_name: parsed.data.displayName, active: true, last_login_at: new Date().toISOString() }, { onConflict: "id" });
  if (userError) throw userError;
  const { error: assignmentError } = await admin.from("cbg_user_roles").insert({ user_id: user.id, role_id: role.id, assigned_by: user.id });
  if (assignmentError) throw assignmentError;
  await admin.from("cbg_audit_logs").insert({ actor_id: user.id, actor_role: "admin", action: "carebridge_initialized", entity_type: "system", entity_id: "carebridge", metadata: { method: "environment_allowlist" } });
  redirect("/dashboard");
}

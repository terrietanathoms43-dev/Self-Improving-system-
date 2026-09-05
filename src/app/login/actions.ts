"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security";
export async function login(formData: FormData) {
  try {
    await enforceRateLimit("staff_login", 8, 900);
  } catch {
    redirect("/login?error=Too+many+attempts.+Please+wait+and+try+again");
  }
  const parsed = z
    .object({ email: z.email(), password: z.string().min(10).max(128) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=Invalid+credentials");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) redirect("/login?error=Sign-in+failed");
  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("cbg_users")
    .select("id,active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!staff) {
    const bootstrapEmail =
      process.env.CAREBRIDGE_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    if (bootstrapEmail && data.user.email?.toLowerCase() === bootstrapEmail)
      redirect("/setup");
    await supabase.auth.signOut();
    redirect("/login?error=This+account+is+not+authorized+for+CareBridge");
  }
  if (!staff.active) {
    await supabase.auth.signOut();
    redirect("/login?error=This+CareBridge+account+is+suspended");
  }
  await admin
    .from("cbg_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);
  redirect("/dashboard");
}

const registrationSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.email(),
    password: z.string().min(12).max(128),
    confirmPassword: z.string().max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
  });

export async function registerTestingStaff(formData: FormData) {
  if (process.env.CAREBRIDGE_OPEN_STAFF_SIGNUP !== "true")
    redirect("/login?error=Staff+registration+is+currently+closed");
  try {
    await enforceRateLimit("staff_registration", 4, 3600);
  } catch {
    redirect("/login?error=Too+many+attempts.+Please+wait+and+try+again");
  }
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(
      "/login?error=Enter+your+full+name,+a+valid+email,+and+matching+12-character+passwords",
    );
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) redirect("/login?error=Registration+is+not+configured");
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
      data: { full_name: parsed.data.fullName },
    },
  });
  if (error)
    redirect(
      "/login?error=Registration+could+not+be+completed.+If+you+already+have+an+account,+sign+in+instead",
    );
  redirect(
    "/login?success=Check+your+email+and+confirm+your+address+before+signing+in",
  );
}

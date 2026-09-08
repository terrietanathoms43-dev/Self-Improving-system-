"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveAppUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security";

export async function requestReset(fd: FormData) {
  try {
    await enforceRateLimit("password_reset", 4, 3600);
  } catch {
    redirect("/forgot-password?sent=1");
  }
  const parsed = z
    .object({ email: z.email() })
    .safeParse(Object.fromEntries(fd));
  const origin = resolveAppUrl();
  if (parsed.success && origin) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
  }
  redirect("/forgot-password?sent=1");
}

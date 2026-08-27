"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security";
export async function login(formData: FormData) {
  try { await enforceRateLimit("staff_login", 8, 900); } catch { redirect("/login?error=Too+many+attempts.+Please+wait+and+try+again"); }
  const parsed = z
    .object({ email: z.email(), password: z.string().min(10).max(128) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=Invalid+credentials");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=Sign-in+failed");
  redirect("/dashboard");
}

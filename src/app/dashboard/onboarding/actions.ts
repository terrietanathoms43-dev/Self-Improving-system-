"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function completeOnboarding() {
  const actor = await requireActor();
  const s = await createClient();
  const completedAt = new Date().toISOString();
  const { error } = await s.from("cbg_user_preferences").upsert(
    {
      user_id: actor.id,
      onboarding_version: 1,
      onboarding_completed_at: completedAt,
      updated_at: completedAt,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error("The walkthrough could not be completed. Please try again.");
  await s.from("cbg_audit_logs").insert({
    actor_id: actor.id,
    actor_role: actor.roles[0],
    action: "staff_onboarding_completed",
    entity_type: "user_preference",
    entity_id: actor.id,
    metadata: { onboarding_version: 1 },
  });
  revalidatePath("/dashboard", "layout");
}

export async function restartOnboarding() {
  const actor = await requireActor();
  const s = await createClient();
  const { error } = await s.from("cbg_user_preferences").upsert(
    { user_id: actor.id, onboarding_version: 0, onboarding_completed_at: null, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw new Error("The walkthrough could not be restarted.");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export async function refreshRetentionQueue() {
  await requireActor(["admin"]);
  const s = await createClient();
  const { error } = await s.rpc("cbg_refresh_retention_reviews");
  if (error) throw error;
  revalidatePath("/dashboard/system");
}
const retention = z.object({
  reviewId: z.uuid(),
  decision: z.enum(["extended", "approved_for_disposition", "retained"]),
  reason: z.string().min(20).max(3000),
  extendedUntil: z.union([z.literal(""), z.iso.date()]),
});
export async function decideRetention(fd: FormData) {
  const actor = await requireActor(["admin"]);
  const p = retention.parse(Object.fromEntries(fd));
  if (p.decision === "extended" && !p.extendedUntil)
    throw new Error("An extension date is required");
  const s = await createClient();
  const { data: review, error: readError } = await s
    .from("cbg_retention_reviews")
    .select("application_id,legal_hold")
    .eq("id", p.reviewId)
    .single();
  if (readError || !review) throw new Error("Retention review not found");
  if (review.legal_hold && p.decision === "approved_for_disposition")
    throw new Error(
      "Records under legal hold cannot be approved for disposition",
    );
  const { error } = await s
    .from("cbg_retention_reviews")
    .update({
      status: p.decision,
      decision_reason: p.reason,
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      extended_until: p.extendedUntil || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", p.reviewId)
    .eq("status", "pending");
  if (error) throw error;
  if (p.decision === "extended")
    await s
      .from("cbg_applications")
      .update({ retention_until: p.extendedUntil, updated_by: actor.id })
      .eq("id", review.application_id);
  await s
    .from("cbg_audit_logs")
    .insert({
      actor_id: actor.id,
      actor_role: "admin",
      action: "retention_review_decided",
      entity_type: "retention_review",
      entity_id: p.reviewId,
      metadata: { decision: p.decision, reason: p.reason },
    });
  revalidatePath("/dashboard/system");
}

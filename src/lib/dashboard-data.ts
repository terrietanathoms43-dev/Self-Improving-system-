import { createClient } from "@/lib/supabase/server";
export async function getDashboardMetrics() {
  const s = await createClient();
  const [queue, reviews, appeals, alerts, versions] = await Promise.all([
    s
      .from("cbg_applications")
      .select("id", { count: "exact", head: true })
      .in("status", ["verified", "assessment_ready", "human_review"]),
    s.from("cbg_human_reviews").select("id", { count: "exact", head: true }),
    s
      .from("cbg_appeals")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    s
      .from("cbg_fairness_alerts")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "investigating"]),
    s
      .from("cbg_model_versions")
      .select("version,status,activated_at")
      .eq("status", "active")
      .order("activated_at", { ascending: false })
      .limit(1),
  ]);
  return {
    queue: queue.count ?? 0,
    reviews: reviews.count ?? 0,
    appeals: appeals.count ?? 0,
    alerts: alerts.count ?? 0,
    version: versions.data?.[0]?.version ?? "Not configured",
  };
}

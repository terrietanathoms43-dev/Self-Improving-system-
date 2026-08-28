import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActor } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/security";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
export async function GET() {
  const actor = await getActor();
  if (
    !actor ||
    !actor.roles.some((r) => ["human_oversight_committee", "admin"].includes(r))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await enforceRateLimit("fairness_export", 5, 3600);
  } catch {
    return NextResponse.json(
      { error: "Export limit reached" },
      { status: 429 },
    );
  }
  const s = await createClient();
  const { data, error } = await s
    .from("cbg_fairness_metrics")
    .select(
      "period_start,period_end,dimension,dimension_value,case_count,agreement_rate,override_rate,appeal_success_rate,average_confidence,incorrectly_deprioritized,unresolved_reviews,average_decision_hours",
    )
    .order("period_end", { ascending: false })
    .limit(5000);
  if (error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  const columns = [
    "period_start",
    "period_end",
    "dimension",
    "dimension_value",
    "case_count",
    "agreement_rate",
    "override_rate",
    "appeal_success_rate",
    "average_confidence",
    "incorrectly_deprioritized",
    "unresolved_reviews",
    "average_decision_hours",
  ] as const;
  const csv = [
    columns.join(","),
    ...(data ?? []).map((row) =>
      columns.map((key) => csvCell(row[key])).join(","),
    ),
  ].join("\r\n");
  await s
    .from("cbg_export_logs")
    .insert({
      export_type: "fairness_aggregate",
      filters: { limit: 5000 },
      row_count: data?.length ?? 0,
      requested_by: actor.id,
    });
  await s
    .from("cbg_audit_logs")
    .insert({
      actor_id: actor.id,
      actor_role: actor.roles[0],
      action: "privacy_safe_export_created",
      entity_type: "fairness_metrics",
      metadata: { row_count: data?.length ?? 0 },
    });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="carebridge-fairness-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

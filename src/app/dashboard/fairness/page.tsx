import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge } from "@/components/ui";
export default async function Fairness() {
  await requireActor();
  const s = await createClient();
  const [{ data: metrics }, { data: alerts }] = await Promise.all([
    s
      .from("cbg_fairness_metrics")
      .select("*")
      .order("period_end", { ascending: false })
      .limit(50),
    s
      .from("cbg_fairness_alerts")
      .select("*")
      .in("status", ["open", "investigating"])
      .order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <h1 className="text-3xl font-bold">Fairness and performance</h1>
      <p className="mt-2 text-slate-600">
        Aggregated monitoring only. Alerts initiate investigation; they do not
        prove discrimination or change case decisions.
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {(alerts ?? []).map((a) => (
          <Card key={a.id}>
            <Badge tone={a.severity === "high" ? "danger" : "warning"}>
              {a.severity} · {a.status}
            </Badge>
            <h2 className="mt-4 font-semibold">{a.title}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {a.investigation_question}
            </p>
          </Card>
        ))}
        {!alerts?.length ? (
          <Card className="lg:col-span-3 text-center text-slate-500">
            No open fairness investigations.
          </Card>
        ) : null}
      </div>
      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Group",
                "Cases",
                "Agreement",
                "Override",
                "Appeal success",
                "Avg. confidence",
                "Decision hours",
              ].map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(metrics ?? []).map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-3">
                  {m.dimension}: {m.dimension_value}
                </td>
                <td className="px-4 py-3">{m.case_count}</td>
                <td className="px-4 py-3">{m.agreement_rate ?? "—"}%</td>
                <td className="px-4 py-3">{m.override_rate ?? "—"}%</td>
                <td className="px-4 py-3">{m.appeal_success_rate ?? "—"}%</td>
                <td className="px-4 py-3">{m.average_confidence ?? "—"}%</td>
                <td className="px-4 py-3">{m.average_decision_hours ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

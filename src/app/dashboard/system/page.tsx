import { requireActor } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import { decideRetention, refreshRetentionQueue } from "./actions";
export default async function SystemPage() {
  await requireActor(["admin"]);
  const s = await createClient();
  const admin = createAdminClient();
  const [
    { data: reviews },
    { count: errors },
    { data: latestFairness },
    { count: openAlerts },
  ] = await Promise.all([
    s
      .from("cbg_retention_reviews")
      .select("*,cbg_applications(reference_number)")
      .order("retention_until"),
    admin
      .from("cbg_error_events")
      .select("id", { count: "exact", head: true }),
    admin
      .from("cbg_fairness_metrics")
      .select("computed_at")
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("cbg_fairness_alerts")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "investigating"]),
  ]);
  const checks = [
    ...[
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
      "OPENAI_API_KEY",
      "OPENAI_TRAINING_BASE_MODEL",
      "RATE_LIMIT_SALT",
      "CRON_SECRET",
      "NEXT_PUBLIC_APP_URL",
    ].map((key) => ({ name: key, ok: Boolean(process.env[key]) })),
    {
      name: "Recent fairness calculation",
      ok: Boolean(latestFairness?.computed_at),
    },
  ];
  return (
    <>
      <h1 className="text-3xl font-bold">System health and retention</h1>
      <p className="mt-2 text-slate-600">
        Configuration status only—secret values are never displayed.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Recorded error events</p>
          <p className="text-3xl font-bold">{errors ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Open fairness investigations</p>
          <p className="text-3xl font-bold">{openAlerts ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Retention reviews</p>
          <p className="text-3xl font-bold">{reviews?.length ?? 0}</p>
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="font-semibold">Production configuration</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {checks.map((c) => (
            <div
              key={c.name}
              className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"
            >
              <span>{c.name}</span>
              <Badge tone={c.ok ? "success" : "danger"}>
                {c.ok ? "configured" : "missing"}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Human-approved retention queue</h2>
            <p className="text-sm text-slate-600">
              No record is deleted automatically.
            </p>
          </div>
          <form action={refreshRetentionQueue}>
            <Button>Refresh queue</Button>
          </form>
        </div>
        <div className="mt-4 space-y-4">
          {(reviews ?? []).map((r) => (
            <form
              action={decideRetention}
              key={r.id}
              className="rounded-lg border p-4"
            >
              <input type="hidden" name="reviewId" value={r.id} />
              <div className="flex justify-between gap-2">
                <strong>
                  {
                    (
                      r.cbg_applications as unknown as {
                        reference_number: string;
                      }
                    )?.reference_number
                  }
                </strong>
                <Badge tone={r.legal_hold ? "danger" : "default"}>
                  {r.legal_hold ? "legal hold" : r.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Retention date: {r.retention_until}
              </p>
              {r.status === "pending" ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Select name="decision">
                    <option value="extended">Extend retention</option>
                    <option value="retained">
                      Retain indefinitely pending review
                    </option>
                    <option value="approved_for_disposition">
                      Approve for controlled disposition
                    </option>
                  </Select>
                  <Input type="date" name="extendedUntil" />
                  <Textarea
                    className="md:col-span-2"
                    name="reason"
                    minLength={20}
                    placeholder="Evidence-based retention decision"
                    required
                  />
                  <Button className="md:col-span-2">Record decision</Button>
                </div>
              ) : null}
            </form>
          ))}
        </div>
      </Card>
      <Card className="mt-6">
        <h2 className="font-semibold">Privacy-safe exports</h2>
        <p className="mt-2 text-sm text-slate-600">
          Aggregated fairness data only; applicant and medical details are
          excluded. Every export is rate-limited and audited.
        </p>
        <a
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white"
          href="/api/exports/fairness"
        >
          Download fairness CSV
        </a>
      </Card>
    </>
  );
}

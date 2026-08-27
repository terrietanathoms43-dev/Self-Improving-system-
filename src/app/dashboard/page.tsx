import {
  AlertTriangle,
  ClipboardCheck,
  Gavel,
  Scale,
  GitBranch,
} from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { getDashboardMetrics } from "@/lib/dashboard-data";
export default async function Dashboard() {
  const m = await getDashboardMetrics();
  const stats = [
    ["Cases requiring review", m.queue, ClipboardCheck],
    ["Completed human reviews", m.reviews, Gavel],
    ["Open appeals", m.appeals, AlertTriangle],
    ["Fairness investigations", m.alerts, Scale],
  ] as const;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700">
            Operational overview
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            AI review and governance
          </h1>
          <p className="mt-2 text-slate-600">
            Privacy-safe operational metrics. No identifiable applicant data is
            shown.
          </p>
        </div>
        <Badge tone="success">Production rules: {m.version}</Badge>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, Icon]) => (
          <Card key={label}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-3 text-3xl font-bold">{value}</p>
              </div>
              <Icon className="h-5 w-5 text-teal-600" />
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h2 className="font-semibold">Governance controls</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              "AI-only rejection blocked",
              "Human approval required",
              "Version rollback retained",
            ].map((x) => (
              <div
                key={x}
                className="rounded-lg bg-emerald-50 p-4 text-sm font-medium text-emerald-900"
              >
                ✓ {x}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <GitBranch className="h-5 w-5 text-teal-600" />
          <h2 className="mt-4 font-semibold">Controlled improvement</h2>
          <p className="mt-2 text-sm text-slate-600">
            Patterns may generate proposals, but rules never change without
            evaluation and committee activation.
          </p>
        </Card>
      </div>
    </>
  );
}

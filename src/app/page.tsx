import Link from "next/link";
import { ShieldCheck, Scale, Activity, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui";
export default function Home() {
  return (
    <main id="main" className="min-h-screen bg-slate-950 text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="font-bold">
          <span className="text-teal-400">CareBridge</span> Jamaica
        </div>
        <Link
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm"
          href="/login"
        >
          Staff sign in
        </Link>
      </nav>
      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-teal-400">
            Human-governed AI review
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Safer decisions. Clear accountability. Continuous improvement.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            A secure operational system for reviewing medical-assistance
            recommendations, monitoring fairness, managing appeals, and
            approving controlled rules improvements in Jamaica.
          </p>
          <Link
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-3 font-semibold text-slate-950"
            href="/login"
          >
            Open secure workspace <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            [ShieldCheck, "Human decisions remain final"],
            [Scale, "Privacy-safe fairness monitoring"],
            [Activity, "Versioned evaluation and rollback"],
          ].map(([Icon, label], i) => (
            <Card
              key={String(label)}
              className={
                i === 2
                  ? "sm:col-span-2 border-slate-700 bg-slate-900"
                  : "border-slate-700 bg-slate-900"
              }
            >
              <Icon className="mb-8 h-7 w-7 text-teal-400" />
              <p className="font-semibold text-white">{label as string}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

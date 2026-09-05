import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  HeartPulse,
  LockKeyhole,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { login, registerTestingStaff } from "./actions";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const registrationOpen = process.env.CAREBRIDGE_OPEN_STAFF_SIGNUP === "true";
  return (
    <main id="main" className="min-h-screen bg-slate-950">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-2">
        <section className="relative hidden overflow-hidden px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.28),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_38%)]" />
          <div className="relative">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back to CareBridge
            </Link>
            <div className="mt-16 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-400 text-slate-950">
              <HeartPulse className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.22em] text-teal-300">
              CareBridge Jamaica
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-bold tracking-tight">
              Responsible AI review with clear human accountability.
            </h1>
            <p className="mt-5 max-w-lg leading-7 text-slate-300">
              Assess cases, correct errors, monitor fairness, and improve
              governed rules in one secure workspace.
            </p>
          </div>
          <div className="relative grid gap-3 text-sm text-slate-300">
            <p className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-teal-300" /> Protected case
              and medical information
            </p>
            <p className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-teal-300" /> Accountable,
              auditable decisions
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
          <div className="w-full max-w-xl">
            <Link
              href="/"
              className="mb-6 inline-block text-sm font-semibold text-teal-700 lg:hidden"
            >
              ← CareBridge Jamaica
            </Link>
            {registrationOpen ? (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <strong>Testing access is open.</strong> Use test information
                only. Registration will be restricted before live processing.
              </div>
            ) : null}
            {error ? (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {error}
              </div>
            ) : null}
            {success ? (
              <div
                role="status"
                className="mb-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              >
                <MailCheck className="h-5 w-5 shrink-0" /> {success}
              </div>
            ) : null}

            <Card className="p-6 shadow-xl shadow-slate-200/60 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-teal-700">
                    Staff workspace
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">Welcome back</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Sign in with your confirmed email and password.
                  </p>
                </div>
              </div>
              <form action={login} className="mt-7 space-y-4">
                <Field label="Email address">
                  <Input
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="name@example.com"
                    required
                  />
                </Field>
                <Field label="Password">
                  <Input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    minLength={10}
                    required
                  />
                </Field>
                <Button className="w-full" type="submit">
                  Sign in securely
                </Button>
                <Link
                  href="/forgot-password"
                  className="block text-center text-sm font-medium text-teal-700"
                >
                  Forgot your password?
                </Link>
              </form>
            </Card>

            {registrationOpen ? (
              <Card className="mt-6 p-6 sm:p-8">
                <p className="text-sm font-semibold text-blue-700">
                  New testing staff
                </p>
                <h2 className="mt-1 text-xl font-bold">Create your account</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Use any regular email. Supabase will email you a confirmation
                  link before access is created.
                </p>
                <form
                  action={registerTestingStaff}
                  className="mt-6 grid gap-4 sm:grid-cols-2"
                >
                  <Field label="Full name" className="sm:col-span-2">
                    <Input
                      name="fullName"
                      autoComplete="name"
                      minLength={2}
                      maxLength={120}
                      required
                    />
                  </Field>
                  <Field label="Email address" className="sm:col-span-2">
                    <Input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      required
                    />
                  </Field>
                  <Field label="Password">
                    <Input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                    />
                  </Field>
                  <Field label="Confirm password">
                    <Input
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                    />
                  </Field>
                  <p className="text-xs text-slate-500 sm:col-span-2">
                    Use at least 12 characters and a password not used
                    elsewhere.
                  </p>
                  <Button className="w-full sm:col-span-2" type="submit">
                    Create account and confirm email
                  </Button>
                </form>
              </Card>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm font-medium ${className}`}>
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

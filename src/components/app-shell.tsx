import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  GitCompare,
  Scale,
  GitBranch,
  ScrollText,
  LogOut,
  UserPlus,
  Stethoscope,
  Gavel,
  Files,
  Users,
  Bell,
  BrainCircuit,
} from "lucide-react";
import type { Role } from "@/types/database";
const links = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/dashboard/intake", "Application intake", UserPlus],
  ["/dashboard/verification", "Verification", Stethoscope],
  ["/dashboard/queue", "Assessment queue", ClipboardList],
  ["/dashboard/reviews", "Decision comparison", GitCompare],
  ["/dashboard/appeals", "Appeals", Gavel],
  ["/dashboard/documents", "Secure documents", Files],
  ["/dashboard/admin", "Staff administration", Users],
  ["/dashboard/notifications", "Notifications", Bell],
  ["/dashboard/fairness", "Fairness monitoring", Scale],
  ["/dashboard/governance", "Rules & governance", GitBranch],
  ["/dashboard/training", "OpenAI training", BrainCircuit],
  ["/dashboard/audit", "Audit log", ScrollText],
] as const;
export function AppShell({
  children,
  email,
  roles,
}: {
  children: React.ReactNode;
  email: string;
  roles: Role[];
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b bg-white">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 lg:px-8">
          <Link href="/dashboard" className="font-bold">
            <span className="text-teal-700">CareBridge</span> Jamaica
          </Link>
          <div className="text-right">
            <p className="text-sm font-medium">{email}</p>
            <p className="text-xs text-slate-500">
              {roles.join(" · ").replaceAll("_", " ")}
            </p>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[260px_1fr]">
        <aside className="border-r bg-white p-4 lg:min-h-[calc(100vh-4rem)]">
          <nav
            aria-label="Primary"
            className="flex gap-2 overflow-x-auto lg:flex-col"
          >
            {links.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <form action="/auth/signout" method="post" className="mt-6">
            <button className="flex items-center gap-3 px-3 py-2 text-sm text-slate-600">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </aside>
        <main id="main" className="min-w-0 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

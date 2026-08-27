import { AppShell } from "@/components/app-shell";
import { requireActor } from "@/lib/auth";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireActor();
  return (
    <AppShell email={actor.email} roles={actor.roles}>
      {children}
    </AppShell>
  );
}

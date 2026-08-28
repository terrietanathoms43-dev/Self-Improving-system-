import { AppShell } from "@/components/app-shell";
import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingTour } from "@/components/onboarding-tour";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireActor();
  const s = await createClient();
  const { data: preferences } = await s.from("cbg_user_preferences").select("onboarding_version,onboarding_completed_at").eq("user_id",actor.id).maybeSingle();
  const needsOnboarding=!preferences?.onboarding_completed_at||preferences.onboarding_version<1;
  return (
    <AppShell email={actor.email} roles={actor.roles}>
      {needsOnboarding?<OnboardingTour roles={actor.roles}/>:null}
      {children}
    </AppShell>
  );
}

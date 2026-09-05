import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/redirects";

const testingRoles = [
  "intake_officer",
  "medical_verification_officer",
  "social_financial_assessment_officer",
  "case_review_committee",
  "human_oversight_committee",
  "appeals_reviewer",
  "admin",
] as const;

async function provisionConfirmedTester(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  if (process.env.CAREBRIDGE_OPEN_STAFF_SIGNUP !== "true" || !user.email)
    return;
  const admin = createAdminClient();
  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim().slice(0, 120)
      : user.email.split("@")[0].slice(0, 120);
  const { error: userError } = await admin.from("cbg_users").upsert({
    id: user.id,
    display_name: displayName || "Testing staff member",
    email: user.email,
    active: true,
    updated_at: new Date().toISOString(),
  });
  if (userError) throw userError;
  const { data: roles, error: roleError } = await admin
    .from("cbg_roles")
    .select("id,name")
    .in("name", [...testingRoles]);
  if (roleError || roles?.length !== testingRoles.length)
    throw roleError ?? new Error("Testing roles are unavailable");
  const { error: assignmentError } = await admin.from("cbg_user_roles").upsert(
    roles.map((role) => ({ user_id: user.id, role_id: role.id })),
    { onConflict: "user_id,role_id" },
  );
  if (assignmentError) throw assignmentError;
  await admin.from("cbg_audit_logs").insert({
    actor_id: user.id,
    actor_role: "admin",
    action: "testing_staff_self_registered",
    entity_type: "user",
    entity_id: user.id,
    metadata: { temporary_open_registration: true },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeInternalPath(url.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      try {
        await provisionConfirmedTester(data.user);
        return NextResponse.redirect(new URL(next, url.origin));
      } catch {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL(
            "/login?error=Your+email+was+confirmed,+but+staff+access+could+not+be+created",
            url.origin,
          ),
        );
      }
    }
  }
  return NextResponse.redirect(
    new URL("/login?error=Authentication+link+expired", url.origin),
  );
}

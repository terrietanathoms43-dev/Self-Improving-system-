import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
export default async function Queue() {
  await requireActor([
    "intake_officer",
    "medical_verification_officer",
    "social_financial_assessment_officer",
    "case_review_committee",
    "human_oversight_committee",
    "admin",
  ]);
  const s = await createClient();
  const { data } = await s
    .from("cbg_applications")
    .select("id,reference_number,status,parish,submitted_at,updated_at")
    .in("status", ["verified", "assessment_ready", "human_review", "decision_pending"])
    .order("submitted_at");
  return (
    <>
      <h1 className="text-3xl font-bold">Secure assessment queue</h1>
      <p className="mt-2 text-slate-600">
        Mandatory and QA cases wait for full reassessment. Routine AI-led cases remain available for discretionary reviewer selection.
      </p>
      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Reference", "Parish", "Status", "Submitted", "Action"].map(
                (h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-3 font-mono">{c.reference_number}</td>
                <td className="px-4 py-3">{c.parish}</td>
                <td className="px-4 py-3">
                  <Badge>{c.status.replaceAll("_", " ")}</Badge>
                </td>
                <td className="px-4 py-3">
                  {new Date(c.submitted_at).toLocaleDateString("en-JM")}
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="font-semibold text-teal-700 underline"
                    href={`/dashboard/queue/${c.id}`}
                  >
                    Open case
                  </Link>
                </td>
              </tr>
            ))}
            {!data?.length ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No cases currently require assessment.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}

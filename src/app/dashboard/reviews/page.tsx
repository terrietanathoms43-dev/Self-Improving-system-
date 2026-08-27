import { createClient } from "@/lib/supabase/server";
import { Card, Badge } from "@/components/ui";
export default async function Reviews() {
  const s = await createClient();
  const { data } = await s
    .from("cbg_human_reviews")
    .select(
      "id,disposition,proposed_decision,final_score,final_category,evidence_considered,factors_changed,explanation,reviewer_role,reviewed_at,cbg_applications(reference_number),cbg_ai_assessments(score,category,confidence,cbg_model_versions(version)),cbg_appeals(status),cbg_final_decisions(decision,case_outcome)",
    )
    .order("reviewed_at", { ascending: false })
    .limit(100);
  return (
    <>
      <h1 className="text-3xl font-bold">AI-versus-human decisions</h1>
      <p className="mt-2 text-slate-600">
        Human and AI records remain separate and independently auditable.
      </p>
      <div className="mt-6 space-y-4">
        {(data ?? []).map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <p className="font-mono text-sm">
                  {
                    (
                      r.cbg_applications as unknown as {
                        reference_number: string;
                      }
                    )?.reference_number
                  }
                </p>
                <h2 className="mt-1 font-semibold">
                  {r.disposition === "agree"
                    ? "AI followed"
                    : "AI changed by human reviewer"}
                </h2>
              </div>
              <Badge tone={r.disposition === "agree" ? "success" : "warning"}>
                {r.disposition}
              </Badge>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">AI score/category</p>
                <p className="font-semibold">
                  {
                    (
                      r.cbg_ai_assessments as unknown as {
                        score: number;
                        category: string;
                      }
                    )?.score
                  }{" "}
                  ·{" "}
                  {
                    (
                      r.cbg_ai_assessments as unknown as {
                        score: number;
                        category: string;
                      }
                    )?.category
                  }
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Human score/category</p>
                <p className="font-semibold">
                  {r.final_score ?? "—"} · {r.final_category ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Proposed decision</p>
                <p className="font-semibold">{r.proposed_decision}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Reviewer role</p>
                <p className="font-semibold">
                  {r.reviewer_role.replaceAll("_", " ")}
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm">
              <strong>Explanation:</strong> {r.explanation}
            </p>
            <p className="mt-2 text-sm">
              <strong>Evidence:</strong> {r.evidence_considered}
            </p>
          </Card>
        ))}
        {!data?.length ? (
          <Card className="text-center text-slate-500">
            No completed reviews yet.
          </Card>
        ) : null}
      </div>
    </>
  );
}

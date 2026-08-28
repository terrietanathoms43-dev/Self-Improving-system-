import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, Card, Input, Select } from "@/components/ui";
import { openDocument, uploadDocument } from "../operations/actions";
export default async function DocumentsPage() {
  await requireActor([
    "intake_officer",
    "medical_verification_officer",
    "social_financial_assessment_officer",
    "case_review_committee",
    "appeals_reviewer",
    "admin",
  ]);
  const s = await createClient();
  const [{ data: apps }, { data: docs }] = await Promise.all([
    s
      .from("cbg_applications")
      .select("id,reference_number")
      .order("submitted_at", { ascending: false })
      .limit(100),
    s
      .from("cbg_documents")
      .select(
        "id,original_name,document_type,size_bytes,created_at,cbg_applications(reference_number)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return (
    <>
      <h1 className="text-3xl font-bold">Secure case documents</h1>
      <p className="mt-2 text-slate-600">
        Private storage, short-lived download links, type and size validation,
        and audited access.
      </p>
      <Card className="mt-6">
        <form action={uploadDocument} className="grid gap-3 md:grid-cols-3">
          <Select name="applicationId" required>
            <option value="">Select case</option>
            {(apps ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.reference_number}
              </option>
            ))}
          </Select>
          <Input name="documentType" placeholder="Document type" required />
          <Input
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            required
          />
          <Button className="md:col-span-3">Upload securely</Button>
        </form>
      </Card>
      <Card className="mt-6">
        <h2 className="font-semibold">Document register</h2>
        <div className="mt-4 divide-y">
          {(docs ?? []).map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-medium">{d.original_name}</p>
                <p className="text-xs text-slate-500">
                  {
                    (
                      d.cbg_applications as unknown as {
                        reference_number: string;
                      }
                    )?.reference_number
                  }{" "}
                  · {d.document_type} · {Math.ceil(d.size_bytes / 1024)} KB
                </p>
              </div>
              <form action={openDocument}>
                <input type="hidden" name="documentId" value={d.id} />
                <Button>Open for 60 seconds</Button>
              </form>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

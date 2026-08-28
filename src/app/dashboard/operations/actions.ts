"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function values(formData: FormData) {
  return Object.fromEntries(formData) as Record<string, unknown>;
}

async function audit(action: string, entityType: string, entityId: string, metadata = {}) {
  const actor = await requireActor();
  const s = await createClient();
  await s.from("cbg_audit_logs").insert({ actor_id: actor.id, actor_role: actor.roles[0], action, entity_type: entityType, entity_id: entityId, metadata });
}

const intakeSchema = z.object({
  fullName: z.string().min(2).max(120), dateOfBirth: z.iso.date(), parish: z.string().min(2).max(40),
  phone: z.string().max(30).optional(), address: z.string().max(300).optional(), gender: z.string().max(40).optional(),
  insuranceStatus: z.string().max(80).optional(), employmentStatus: z.string().max(80).optional(),
  consentVersion: z.string().min(1).max(40), rural: z.coerce.boolean().default(false), disability: z.coerce.boolean().default(false),
  caregiving: z.coerce.boolean().default(false), welfare: z.coerce.boolean().default(false),
});

export async function createApplication(formData: FormData) {
  await requireActor(["intake_officer", "admin"]);
  const raw = values(formData);
  for (const key of ["rural", "disability", "caregiving", "welfare"]) raw[key] = raw[key] === "on";
  const parsed = intakeSchema.safeParse(raw);
  if (!parsed.success) redirect("/dashboard/intake?error=Please+check+the+required+fields");
  const s = await createClient();
  const reference = `CBJ-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { data: applicationId, error } = await s.rpc("cbg_create_application_atomic",{
    p_reference:reference,p_parish:parsed.data.parish,p_rural:parsed.data.rural,p_consent_version:parsed.data.consentVersion,
    p_retention_until:new Date(Date.now()+7*365*86400000).toISOString().slice(0,10),p_full_name:parsed.data.fullName,
    p_date_of_birth:parsed.data.dateOfBirth,p_phone:parsed.data.phone||"",p_address:parsed.data.address||"",p_gender:parsed.data.gender||"",
    p_disability:parsed.data.disability,p_insurance:parsed.data.insuranceStatus||"",p_employment:parsed.data.employmentStatus||"",
    p_caregiving:parsed.data.caregiving,p_welfare:parsed.data.welfare
  });
  if(error||!applicationId)redirect("/dashboard/intake?error=Application+could+not+be+created");
  revalidatePath("/dashboard/queue");
  redirect(`/dashboard/queue/${applicationId}?success=Application+created`);
}

const medicalSchema = z.object({ applicationId: z.uuid(), urgencyScore: z.coerce.number().int().min(0).max(30), summary: z.string().min(20).max(5000), documentsComplete: z.string().optional() });
export async function submitMedicalVerification(formData: FormData) {
  await requireActor(["medical_verification_officer", "admin"]);
  const parsed = medicalSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/dashboard/verification?error=Check+the+medical+score+and+enter+a+summary+of+at+least+20+characters");
  const s = await createClient();
  const { error } = await s.rpc("cbg_complete_medical_verification",{p_application_id:parsed.data.applicationId,p_urgency_score:parsed.data.urgencyScore,p_summary:parsed.data.summary,p_documents_complete:parsed.data.documentsComplete==="on"});
  if (error) redirect("/dashboard/verification?error=This+case+could+not+be+verified.+It+may+have+already+moved+to+another+stage");
  revalidatePath("/dashboard/verification");
  redirect("/dashboard/verification?success=Medical+verification+completed");
}

const socialSchema = z.object({ applicationId: z.uuid(), financial: z.coerce.number().int().min(0).max(20), access: z.coerce.number().int().min(0).max(20), unmet: z.coerce.number().int().min(0).max(15), vulnerability: z.coerce.number().int().min(0).max(10), support: z.coerce.number().int().min(0).max(5), summary: z.string().min(20).max(5000), missed: z.string().optional(), transport: z.string().optional(), family: z.string().optional() });
export async function submitSocialAssessment(formData: FormData) {
  await requireActor(["social_financial_assessment_officer", "admin"]);
  const parsed = socialSchema.safeParse(values(formData));
  if (!parsed.success) redirect("/dashboard/verification?error=Check+all+social+assessment+scores+and+enter+a+summary+of+at+least+20+characters");
  const s = await createClient();
  const { error } = await s.rpc("cbg_complete_social_assessment",{p_application_id:parsed.data.applicationId,p_financial:parsed.data.financial,p_access:parsed.data.access,p_unmet:parsed.data.unmet,p_vulnerability:parsed.data.vulnerability,p_support:parsed.data.support,p_summary:parsed.data.summary,p_missed:parsed.data.missed==="on",p_transport:parsed.data.transport==="on",p_family:parsed.data.family==="on"});
  if (error) redirect("/dashboard/verification?error=This+case+could+not+be+assessed.+It+may+have+already+moved+to+another+stage");
  revalidatePath("/dashboard/verification"); revalidatePath("/dashboard/queue");
  redirect("/dashboard/verification?success=Social+assessment+completed+and+case+routed+to+the+assessment+queue");
}

const appealSchema = z.object({ applicationId: z.uuid(), reason: z.string().min(20).max(5000), evidence: z.string().max(5000).optional() });
export async function submitAppeal(formData: FormData) {
  await requireActor(["appeals_reviewer", "case_review_committee", "admin"]);
  const parsed = appealSchema.safeParse(values(formData)); if (!parsed.success) throw new Error("Appeal details are incomplete");
  const s = await createClient();
  const { data, error } = await s.rpc("cbg_submit_appeal_atomic",{p_application_id:parsed.data.applicationId,p_reason:parsed.data.reason,p_evidence:parsed.data.evidence||""});
  if (error || !data) throw error ?? new Error("Appeal was not created");
  revalidatePath("/dashboard/appeals");
}

const appealDecisionSchema = z.object({ appealId: z.uuid(), outcome: z.enum(["upheld", "modified", "overturned", "more_information"]), explanation: z.string().min(20).max(5000) });
export async function decideAppeal(formData: FormData) {
  await requireActor(["appeals_reviewer", "admin"]); const parsed = appealDecisionSchema.safeParse(values(formData)); if (!parsed.success) throw new Error("Appeal decision is incomplete");
  const s = await createClient(); const { error } = await s.rpc("cbg_decide_appeal_atomic", { p_appeal_id: parsed.data.appealId, p_outcome: parsed.data.outcome, p_explanation: parsed.data.explanation }); if (error) throw error;
  revalidatePath("/dashboard/appeals"); redirect("/dashboard/appeals?success=Appeal+decision+recorded");
}

const documentSchema = z.object({ applicationId: z.uuid(), documentType: z.string().min(2).max(80) });
export async function uploadDocument(formData: FormData) {
  const actor = await requireActor(["intake_officer", "medical_verification_officer", "social_financial_assessment_officer", "admin"]);
  const parsed = documentSchema.safeParse(values(formData)); const file = formData.get("file");
  if (!parsed.success || !(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) throw new Error("Use a PDF, JPG, or PNG no larger than 10 MB");
  const bytes = Buffer.from(await file.arrayBuffer()); const hash = createHash("sha256").update(bytes).digest("hex");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const path = `${parsed.data.applicationId}/${randomUUID()}-${safeName}`; const s = await createClient();
  const { error: storageError } = await s.storage.from("cbg-case-documents").upload(path, bytes, { contentType: file.type, upsert: false }); if (storageError) throw storageError;
  const { error } = await s.from("cbg_documents").insert({ application_id: parsed.data.applicationId, storage_path: path, original_name: safeName, document_type: parsed.data.documentType, mime_type: file.type, size_bytes: file.size, sha256: hash, uploaded_by: actor.id });
  if (error) { await s.storage.from("cbg-case-documents").remove([path]); throw error; }
  await audit("sensitive_document_uploaded", "application", parsed.data.applicationId, { document_type: parsed.data.documentType, sha256: hash }); revalidatePath("/dashboard/documents");
}

export async function openDocument(formData: FormData) {
  await requireActor(["intake_officer","medical_verification_officer","social_financial_assessment_officer","case_review_committee","appeals_reviewer","admin"]); const id = z.uuid().parse(formData.get("documentId")); const s = await createClient();
  const { data: doc } = await s.from("cbg_documents").select("application_id,storage_path").eq("id", id).single(); if (!doc) throw new Error("Document not found");
  const { data, error } = await s.storage.from("cbg-case-documents").createSignedUrl(doc.storage_path, 60); if (error) throw error;
  await audit("sensitive_document_read", "document", id, { application_id: doc.application_id }); redirect(data.signedUrl);
}

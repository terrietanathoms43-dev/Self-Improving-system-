"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const proposal = z.object({ title:z.string().min(5).max(160), problem:z.string().min(20).max(5000), change:z.string().min(20).max(5000), evidence:z.string().min(20).max(5000), patternId:z.union([z.literal(""),z.uuid()]) });
export async function createProposal(fd:FormData){const actor=await requireActor(["human_oversight_committee","admin"]);const p=proposal.safeParse(Object.fromEntries(fd));if(!p.success)throw new Error("Proposal is incomplete");const s=await createClient();const {error}=await s.from("cbg_policy_proposals").insert({pattern_id:p.data.patternId||null,title:p.data.title,problem_statement:p.data.problem,proposed_change:p.data.change,evidence_summary:p.data.evidence,status:"committee_review",submitted_by:actor.id});if(error)throw error;revalidatePath("/dashboard/governance")}

const decision=z.object({proposalId:z.uuid(),decision:z.enum(["approved","rejected"]),reason:z.string().min(20).max(5000),conflict:z.string().optional()});
export async function decideProposal(fd:FormData){const actor=await requireActor(["human_oversight_committee"]);const p=decision.safeParse(Object.fromEntries(fd));if(!p.success||p.data.conflict==="on")throw new Error("A conflict-free explained decision is required");const s=await createClient();const {error}=await s.from("cbg_policy_proposals").update({status:p.data.decision,committee_decision_by:actor.id,committee_decision_at:new Date().toISOString(),committee_reason:p.data.reason}).eq("id",p.data.proposalId);if(error)throw error;await s.from("cbg_audit_logs").insert({actor_id:actor.id,actor_role:"human_oversight_committee",action:"policy_proposal_decided",entity_type:"policy_proposal",entity_id:p.data.proposalId,metadata:{decision:p.data.decision}});revalidatePath("/dashboard/governance")}

export async function refreshPatterns(){await requireActor(["human_oversight_committee","admin"]);const s=await createClient();const {error}=await s.rpc("cbg_refresh_correction_patterns");if(error)throw error;revalidatePath("/dashboard/governance")}

const activation=z.object({versionId:z.uuid(),evaluationId:z.uuid(),reason:z.string().min(20).max(5000),evidence:z.string().min(20).max(5000),conflict:z.string().optional()});
export async function activateVersion(fd:FormData){await requireActor(["human_oversight_committee"]);const p=activation.safeParse(Object.fromEntries(fd));if(!p.success)throw new Error("Activation approval is incomplete");const s=await createClient();const {error}=await s.rpc("cbg_activate_version",{p_version_id:p.data.versionId,p_evaluation_id:p.data.evaluationId,p_reason:p.data.reason,p_evidence:p.data.evidence,p_conflict:p.data.conflict==="on"});if(error)throw error;revalidatePath("/dashboard/governance")}

const rollback=z.object({currentId:z.uuid(),targetId:z.uuid(),reason:z.string().min(20).max(5000)});
export async function rollbackVersion(fd:FormData){await requireActor(["human_oversight_committee"]);const p=rollback.safeParse(Object.fromEntries(fd));if(!p.success)throw new Error("Rollback request is incomplete");const s=await createClient();const {error}=await s.rpc("cbg_rollback_version",{p_current_id:p.data.currentId,p_target_id:p.data.targetId,p_reason:p.data.reason});if(error)throw error;revalidatePath("/dashboard/governance")}

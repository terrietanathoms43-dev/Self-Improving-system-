"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { ROLES } from "@/types/database";

const inviteSchema=z.object({email:z.email(),displayName:z.string().min(2).max(100),role:z.enum(ROLES)});
export async function inviteStaff(fd:FormData){
 const actor=await requireActor(["admin"]);const p=inviteSchema.safeParse(Object.fromEntries(fd));if(!p.success)throw new Error("Valid staff details are required");
 const admin=createAdminClient();const appUrl=process.env.NEXT_PUBLIC_APP_URL;if(!appUrl)throw new Error("NEXT_PUBLIC_APP_URL is not configured");
 const {data,error}=await admin.auth.admin.inviteUserByEmail(p.data.email,{redirectTo:`${appUrl}/auth/callback?next=/reset-password`});if(error||!data.user)throw error??new Error("Invitation failed");
 const s=await createClient();const {error:userError}=await s.from("cbg_users").insert({id:data.user.id,email:p.data.email,display_name:p.data.displayName});if(userError){await admin.auth.admin.deleteUser(data.user.id);throw userError;}
 const {data:role}=await s.from("cbg_roles").select("id").eq("name",p.data.role).single();if(!role){await admin.from("cbg_users").delete().eq("id",data.user.id);await admin.auth.admin.deleteUser(data.user.id);throw new Error("Role not found");}
 const {error:roleError}=await s.from("cbg_user_roles").insert({user_id:data.user.id,role_id:role.id,assigned_by:actor.id});if(roleError){await admin.from("cbg_users").delete().eq("id",data.user.id);await admin.auth.admin.deleteUser(data.user.id);throw roleError;}
 await s.from("cbg_audit_logs").insert({actor_id:actor.id,actor_role:"admin",action:"staff_invited",entity_type:"user",entity_id:data.user.id,metadata:{role:p.data.role}});revalidatePath("/dashboard/admin");
}
const roleSchema=z.object({userId:z.uuid(),role:z.enum(ROLES)});
export async function assignRole(fd:FormData){const actor=await requireActor(["admin"]);const p=roleSchema.safeParse(Object.fromEntries(fd));if(!p.success)throw new Error("Invalid role assignment");const s=await createClient();const {data:role}=await s.from("cbg_roles").select("id").eq("name",p.data.role).single();if(!role)throw new Error("Role not found");const {error}=await s.from("cbg_user_roles").upsert({user_id:p.data.userId,role_id:role.id,assigned_by:actor.id},{onConflict:"user_id,role_id"});if(error)throw error;await s.from("cbg_audit_logs").insert({actor_id:actor.id,actor_role:"admin",action:"staff_role_assigned",entity_type:"user",entity_id:p.data.userId,metadata:{role:p.data.role}});revalidatePath("/dashboard/admin")}
export async function setStaffActive(fd:FormData){const actor=await requireActor(["admin"]);const p=z.object({userId:z.uuid(),active:z.enum(["true","false"])}).parse(Object.fromEntries(fd));if(p.userId===actor.id&&p.active==="false")throw new Error("You cannot deactivate your own account");const s=await createClient();const {error}=await s.from("cbg_users").update({active:p.active==="true",updated_at:new Date().toISOString()}).eq("id",p.userId);if(error)throw error;await s.from("cbg_audit_logs").insert({actor_id:actor.id,actor_role:"admin",action:p.active==="true"?"staff_activated":"staff_deactivated",entity_type:"user",entity_id:p.userId});revalidatePath("/dashboard/admin")}

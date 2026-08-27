import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/database";
export const getActor=cache(async()=>{const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user) return null;const {data}=await supabase.from("user_roles").select("roles(name)").eq("user_id",user.id);const roles=(data??[]).flatMap((r)=>{const role=r.roles as unknown as {name:Role}|null;return role?[role.name]:[]});return {id:user.id,email:user.email??"",roles};});
export async function requireActor(allowed?:Role[]){const actor=await getActor();if(!actor)redirect("/login");if(allowed&&!actor.roles.some(r=>allowed.includes(r)))redirect("/unauthorized");return actor;}

import { requireActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Input, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";
export default async function Audit({searchParams}:{searchParams:Promise<{action?:string;entity?:string;role?:string;from?:string;to?:string}>}) {
  await requireActor(["human_oversight_committee", "admin"]);
  const filters=await searchParams;
  const s = await createClient();
  let query=s
    .from("cbg_audit_logs")
    .select("id,actor_id,actor_role,action,entity_type,entity_id,occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(200);
  if(filters.action)query=query.ilike("action",`%${filters.action.slice(0,80)}%`);if(filters.entity)query=query.eq("entity_type",filters.entity.slice(0,80));if(filters.role)query=query.eq("actor_role",filters.role);if(filters.from)query=query.gte("occurred_at",`${filters.from}T00:00:00Z`);if(filters.to)query=query.lte("occurred_at",`${filters.to}T23:59:59Z`);const {data}=await query;
  return (
    <>
      <h1 className="text-3xl font-bold">Complete audit log</h1>
      <p className="mt-2 text-slate-600">
        Append-only history of sensitive access, changes, exports, overrides,
        and approvals.
      </p>
      <Card className="mt-6"><form className="grid gap-3 md:grid-cols-5"><Input name="action" defaultValue={filters.action} placeholder="Action contains…"/><Input name="entity" defaultValue={filters.entity} placeholder="Entity type"/><Select name="role" defaultValue={filters.role??""}><option value="">Any role</option>{["intake_officer","medical_verification_officer","social_financial_assessment_officer","case_review_committee","human_oversight_committee","appeals_reviewer","admin"].map(role=><option value={role} key={role}>{role.replaceAll("_"," ")}</option>)}</Select><Input name="from" type="date" defaultValue={filters.from}/><Input name="to" type="date" defaultValue={filters.to}/><button className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white md:col-span-5">Apply audit filters</button></form></Card>
      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Time", "Actor", "Role", "Action", "Entity"].map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id} className="border-t">
                <td className="whitespace-nowrap px-4 py-3">
                  {formatDate(a.occurred_at)}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {a.actor_id ?? "system"}
                </td>
                <td className="px-4 py-3">
                  {a.actor_role?.replaceAll("_", " ") ?? "system"}
                </td>
                <td className="px-4 py-3 font-semibold">{a.action}</td>
                <td className="px-4 py-3">
                  {a.entity_type} {a.entity_id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

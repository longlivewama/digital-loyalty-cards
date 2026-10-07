import { supabaseAdmin } from "@/lib/supabase";
import { getSettings } from "@/lib/settings";
import { memberHistory } from "@/lib/events";
import { age, formatBirthday, isBirthdayThisMonth } from "@/lib/birthday";
import { notFound } from "next/navigation";
import Link from "next/link";
import MemberActions from "@/app/_components/MemberActions";

export const dynamic = "force-dynamic";

const EVT: Record<string, (d: number) => string> = {
  signup: () => "Signed up",
  add: (d) => `+${d} coffee${d > 1 ? "s" : ""} ☕`,
  remove: () => "−1 (correction)",
  claim: () => "🎉 Free coffee redeemed",
};
function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: member } = await db.from("members").select("*").eq("id", id).single();
  if (!member) notFound();

  const { goal } = await getSettings();
  const points = member.points ?? 0;
  const post = `/api/admin/member/${id}`;
  const initial = (member.name || "?").trim().charAt(0).toUpperCase();
  const history = await memberHistory(id, 15);
  const lastVisit = history.find((e) => e.type === "add")?.created_at;

  // Profile (full name, birthday, age, birthday this month).
  const fullName = [member.name, member.last_name].filter(Boolean).join(" ") || member.name;
  const bday = formatBirthday(member.birthday);
  const yrs = age(member.birthday);
  const bdayThisMonth = isBirthdayThisMonth(member.birthday);

  return (
    <div className="app-page">
      <div className="wrap">
        <Link href="/dashboard" className="back-link">← Dashboard</Link>

        <div className="panel">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="av" style={{ width: 54, height: 54, fontSize: 22 }}>{initial}</span>
            <div>
              <div className="page-title" style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {fullName}
                {bdayThisMonth && <span className="chip green" title="Birthday this month">🎂 birthday this month</span>}
              </div>
              <div className="page-sub">
                {member.serial} · {member.total_earned ?? 0} coffees in total{lastVisit ? ` · last visit ${fmt(lastVisit)}` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Stamps + actions: instant update, no reload */}
        <MemberActions id={id} goal={goal} initialPoints={points} />

        <div className="panel">
          <div className="panel-title">Profile</div>
          <div className="info-row"><span className="info-k">Full name</span><span className="info-v">{fullName}</span></div>
          <div className="info-row"><span className="info-k">Phone</span><span className="info-v">{member.phone || "—"}</span></div>
          <div className="info-row">
            <span className="info-k">Birthday</span>
            <span className="info-v">{bday ? `${bday}${yrs != null ? ` · ${yrs} years old` : ""}` : "—"}</span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Wallet cards</div>
          <div className="info-row"><span className="info-k">Apple Wallet</span><span className="info-v">{member.registered_at ? "Added ✓" : "Not added"}</span></div>
          <div className="info-row"><span className="info-k">Google Wallet</span><span className="info-v">{member.google_object_id ? "Card created ✓" : "Not requested"}</span></div>
        </div>

        <div className="panel">
          <div className="panel-title">Note</div>
          <form action={post} method="POST" style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="op" value="note" />
            <input name="note" defaultValue={member.note ?? ""} placeholder="E.g. oat milk, morning regular…" />
            <button type="submit" className="s-ghost">OK</button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-title">History</div>
          {history.length === 0 && <p className="page-sub">No activity yet.</p>}
          {history.map((e) => (
            <div key={e.id} className="row-item">
              <span className="grow">{EVT[e.type]?.(e.delta) ?? e.type}</span>
              <span className="t">{fmt(e.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

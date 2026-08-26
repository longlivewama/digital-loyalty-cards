import { supabaseAdmin } from "@/lib/supabase";
import { getSettings } from "@/lib/settings";
import { memberHistory } from "@/lib/events";
import { age, formatBirthday, isBirthdayThisMonth } from "@/lib/birthday";
import { notFound } from "next/navigation";
import Link from "next/link";
import MemberActions from "@/app/_components/MemberActions";

export const dynamic = "force-dynamic";

const EVT: Record<string, (d: number) => string> = {
  signup: () => "Inscription",
  add: (d) => `+${d} achetée${d > 1 ? "s" : ""} 🍕`,
  remove: () => "−1 (correction)",
  claim: () => "🎉 Pizza offerte",
};
function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) + " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
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

  // Profil enrichi (nom complet, date de naissance, âge, anniversaire ce mois).
  const fullName = [member.name, member.last_name].filter(Boolean).join(" ") || member.name;
  const bday = formatBirthday(member.birthday);
  const yrs = age(member.birthday);
  const bdayThisMonth = isBirthdayThisMonth(member.birthday);

  return (
    <div className="app-page">
      <div className="wrap">
        <Link href="/dashboard" className="back-link">← Tableau de bord</Link>

        <div className="panel">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="av" style={{ width: 54, height: 54, fontSize: 22 }}>{initial}</span>
            <div>
              <div className="page-title" style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {fullName}
                {bdayThisMonth && <span className="chip green" title="Anniversaire ce mois-ci">🎂 anniv. ce mois</span>}
              </div>
              <div className="page-sub">
                {member.serial} · {member.total_earned ?? 0} au total{lastVisit ? ` · vu ${fmt(lastVisit)}` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Score + actions : mise à jour instantanée, sans rechargement */}
        <MemberActions id={id} goal={goal} initialPoints={points} />

        <div className="panel">
          <div className="panel-title">Profil</div>
          <div className="info-row"><span className="info-k">Nom complet</span><span className="info-v">{fullName}</span></div>
          <div className="info-row"><span className="info-k">Téléphone</span><span className="info-v">{member.phone || "—"}</span></div>
          <div className="info-row">
            <span className="info-k">Date de naissance</span>
            <span className="info-v">{bday ? `${bday}${yrs != null ? ` · ${yrs} ans` : ""}` : "—"}</span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Note</div>
          <form action={post} method="POST" style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="op" value="note" />
            <input name="note" defaultValue={member.note ?? ""} placeholder="Ex. habitué du midi, sans gluten…" />
            <button type="submit" className="s-ghost">OK</button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-title">Historique</div>
          {history.length === 0 && <p className="page-sub">Aucune opération.</p>}
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

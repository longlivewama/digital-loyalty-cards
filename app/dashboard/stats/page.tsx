import { supabaseAdmin } from "@/lib/supabase";
import { isBirthdayThisMonth, birthdayDay, formatDayMonth, age } from "@/lib/birthday";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Ev = { type: string; created_at: string };
type Mem = {
  id: string;
  name: string | null;
  last_name: string | null;
  birthday: string | null;
  total_earned: number | null;
};

const fullName = (m: Mem) => [m.name, m.last_name].filter(Boolean).join(" ") || m.name || "Client";

export default async function Stats() {
  const db = supabaseAdmin();
  const now = new Date();
  const DAY = 864e5;

  // Événements des 90 derniers jours (couvre toutes les fenêtres + le graph 8 semaines).
  const since90 = new Date(now.getTime() - 90 * DAY).toISOString();
  const { data: evRaw } = await db.from("events").select("type,created_at").gte("created_at", since90);
  const evs: Ev[] = evRaw ?? [];

  // Membres (top clients + anniversaires).
  const { data: memRaw } = await db.from("members").select("id,name,last_name,birthday,total_earned");
  const members: Mem[] = memRaw ?? [];

  // ── Tableau récap par période (7 / 30 / 90 jours) ──
  const countIn = (days: number, type: string) => {
    const t = now.getTime() - days * DAY;
    return evs.filter((e) => e.type === type && new Date(e.created_at).getTime() >= t).length;
  };
  const periods = [7, 30, 90].map((d) => ({
    d,
    scans: countIn(d, "add"),
    free: countIn(d, "claim"),
    signups: countIn(d, "signup"),
  }));

  // ── Graph d'activité : scans par semaine, 8 dernières semaines (ancien → récent) ──
  const NW = 8;
  const weeks = Array.from({ length: NW }, (_, i) => {
    const startMs = now.getTime() - (NW - i) * 7 * DAY;
    const endMs = now.getTime() - (NW - 1 - i) * 7 * DAY;
    const count = evs.filter((e) => {
      const t = new Date(e.created_at).getTime();
      return e.type === "add" && t >= startMs && t < endMs;
    }).length;
    return { count, label: new Date(startMs).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) };
  });
  const maxW = Math.max(1, ...weeks.map((w) => w.count));

  // ── Top clients fidèles (par pizzas cumulées) ──
  const top = members
    .filter((m) => (m.total_earned ?? 0) > 0)
    .sort((a, b) => (b.total_earned ?? 0) - (a.total_earned ?? 0))
    .slice(0, 8);

  // ── Anniversaires du mois ──
  const bdays = members
    .filter((m) => isBirthdayThisMonth(m.birthday))
    .sort((a, b) => birthdayDay(a.birthday) - birthdayDay(b.birthday));
  const moisLabel = now.toLocaleDateString("fr-FR", { month: "long" });

  return (
    <div className="content-narrow">
      <div className="page-head">
        <div>
          <div className="page-title">Statistiques</div>
          <div className="page-sub">Activité, fidélité et anniversaires de votre clientèle</div>
        </div>
      </div>

      {/* ── Graph 8 semaines (en tête) ── */}
      <div className="panel">
        <div className="panel-title">Scans par semaine · 8 dernières semaines</div>
        <div className="spark" style={{ height: 130 }}>
          {weeks.map((w, i) => (
            <div key={i} className="spark-col">
              <div className="spark-num">{w.count}</div>
              <div className="spark-track">
                <div
                  className={"spark-bar" + (i === weeks.length - 1 ? " today" : "")}
                  style={{ height: `${Math.round((w.count / maxW) * 100)}%` }}
                  title={`Semaine du ${w.label} · ${w.count} scan${w.count > 1 ? "s" : ""}`}
                />
              </div>
              <div className="spark-day">{w.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Récap activité par période ── */}
      <div className="panel">
        <div className="panel-title">Activité</div>
        <table className="tbl stats-matrix">
          <thead>
            <tr><th>Période</th><th>Scans</th><th>Pizzas offertes</th><th>Nouveaux</th></tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.d}>
                <td>{p.d === 7 ? "7 derniers jours" : `${p.d} derniers jours`}</td>
                <td><strong>{p.scans}</strong></td>
                <td>{p.free}</td>
                <td>{p.signups}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="stats-cols">
        {/* ── Top clients fidèles ── */}
        <div className="panel">
          <div className="panel-title">Top clients fidèles</div>
          {top.length === 0 && <p className="page-sub">Pas encore de pizzas cumulées.</p>}
          {top.map((m, i) => (
            <Link key={m.id} href={`/m/${m.id}`} className="row-item rank-row">
              <span className={"rank" + (i < 3 ? " top3" : "")}>{i + 1}</span>
              <span className="grow">{fullName(m)}</span>
              <span className="t">{m.total_earned} 🍕</span>
            </Link>
          ))}
        </div>

        {/* ── Anniversaires du mois ── */}
        <div className="panel">
          <div className="panel-title">🎂 Anniversaires · {moisLabel}</div>
          {bdays.length === 0 && <p className="page-sub">Aucun anniversaire ce mois-ci.</p>}
          {bdays.map((m) => {
            const yrs = age(m.birthday);
            return (
              <Link key={m.id} href={`/m/${m.id}`} className="row-item">
                <span className="grow">{fullName(m)}</span>
                <span className="t">{formatDayMonth(m.birthday)}{yrs != null ? ` · ${yrs} ans` : ""}</span>
              </Link>
            );
          })}
          {bdays.length > 0 && (
            <Link href="/dashboard/members?filter=bday" className="stats-link">Voir dans les membres →</Link>
          )}
        </div>
      </div>
    </div>
  );
}

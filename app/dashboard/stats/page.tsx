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

const fullName = (m: Mem) => [m.name, m.last_name].filter(Boolean).join(" ") || m.name || "Customer";

export default async function Stats() {
  const db = supabaseAdmin();
  const now = new Date();
  const DAY = 864e5;

  // Events of the last 90 days (covers every window + the 8-week chart).
  const since90 = new Date(now.getTime() - 90 * DAY).toISOString();
  const { data: evRaw } = await db.from("events").select("type,created_at").gte("created_at", since90);
  const evs: Ev[] = evRaw ?? [];

  // Members (top customers + birthdays).
  const { data: memRaw } = await db.from("members").select("id,name,last_name,birthday,total_earned");
  const members: Mem[] = memRaw ?? [];

  // ── Summary per period (7 / 30 / 90 days) ──
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

  // ── Activity chart: scans per week, last 8 weeks (oldest → newest) ──
  const NW = 8;
  const weeks = Array.from({ length: NW }, (_, i) => {
    const startMs = now.getTime() - (NW - i) * 7 * DAY;
    const endMs = now.getTime() - (NW - 1 - i) * 7 * DAY;
    const count = evs.filter((e) => {
      const t = new Date(e.created_at).getTime();
      return e.type === "add" && t >= startMs && t < endMs;
    }).length;
    return { count, label: new Date(startMs).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" }) };
  });
  const maxW = Math.max(1, ...weeks.map((w) => w.count));

  // ── Most loyal customers (by total coffees) ──
  const top = members
    .filter((m) => (m.total_earned ?? 0) > 0)
    .sort((a, b) => (b.total_earned ?? 0) - (a.total_earned ?? 0))
    .slice(0, 8);

  // ── Birthdays this month ──
  const bdays = members
    .filter((m) => isBirthdayThisMonth(m.birthday))
    .sort((a, b) => birthdayDay(a.birthday) - birthdayDay(b.birthday));
  const moisLabel = now.toLocaleDateString("en-GB", { month: "long" });

  return (
    <div className="content-narrow">
      <div className="page-head">
        <div>
          <div className="page-title">Statistics</div>
          <div className="page-sub">Activity, loyalty and birthdays of your customers</div>
        </div>
      </div>

      {/* ── 8-week chart (top) ── */}
      <div className="panel">
        <div className="panel-title">Scans per week · last 8 weeks</div>
        <div className="spark" style={{ height: 130 }}>
          {weeks.map((w, i) => (
            <div key={i} className="spark-col">
              <div className="spark-num">{w.count}</div>
              <div className="spark-track">
                <div
                  className={"spark-bar" + (i === weeks.length - 1 ? " today" : "")}
                  style={{ height: `${Math.round((w.count / maxW) * 100)}%` }}
                  title={`Week of ${w.label} · ${w.count} scan${w.count > 1 ? "s" : ""}`}
                />
              </div>
              <div className="spark-day">{w.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Activity per period ── */}
      <div className="panel">
        <div className="panel-title">Activity</div>
        <table className="tbl stats-matrix">
          <thead>
            <tr><th>Period</th><th>Scans</th><th>Free coffees</th><th>New members</th></tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.d}>
                <td>{`Last ${p.d} days`}</td>
                <td><strong>{p.scans}</strong></td>
                <td>{p.free}</td>
                <td>{p.signups}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="stats-cols">
        {/* ── Most loyal customers ── */}
        <div className="panel">
          <div className="panel-title">Most loyal customers</div>
          {top.length === 0 && <p className="page-sub">No coffees stamped yet.</p>}
          {top.map((m, i) => (
            <Link key={m.id} href={`/m/${m.id}`} className="row-item rank-row">
              <span className={"rank" + (i < 3 ? " top3" : "")}>{i + 1}</span>
              <span className="grow">{fullName(m)}</span>
              <span className="t">{m.total_earned} ☕</span>
            </Link>
          ))}
        </div>

        {/* ── Birthdays this month ── */}
        <div className="panel">
          <div className="panel-title">🎂 Birthdays · {moisLabel}</div>
          {bdays.length === 0 && <p className="page-sub">No birthdays this month.</p>}
          {bdays.map((m) => {
            const yrs = age(m.birthday);
            return (
              <Link key={m.id} href={`/m/${m.id}`} className="row-item">
                <span className="grow">{fullName(m)}</span>
                <span className="t">{formatDayMonth(m.birthday)}{yrs != null ? ` · ${yrs} years old` : ""}</span>
              </Link>
            );
          })}
          {bdays.length > 0 && (
            <Link href="/dashboard/members?filter=bday" className="stats-link">View in members →</Link>
          )}
        </div>
      </div>
    </div>
  );
}

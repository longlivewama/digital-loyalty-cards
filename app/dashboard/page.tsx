import { supabaseAdmin } from "@/lib/supabase";
import { recentActivity } from "@/lib/events";
import { countTargets } from "@/lib/broadcast";
import Link from "next/link";

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
const ACT: Record<string, (d: number) => string> = {
  signup: () => "signed up",
  add: (d) => `+${d} coffee${d > 1 ? "s" : ""}`,
  remove: () => "−1 (correction)",
  claim: () => "🎉 free coffee redeemed",
};

export default async function Home() {
  const db = supabaseAdmin();
  const { data: members } = await db.from("members").select("registered_at,total_earned,created_at");
  const list = members ?? [];
  const active = list.filter((m) => m.registered_at).length;
  const coffees = list.reduce((a, m) => a + (m.total_earned ?? 0), 0);

  let migrationNeeded = false;
  try {
    const { error } = await db.from("events").select("*", { count: "exact", head: true }).eq("type", "claim");
    if (error) migrationNeeded = true;
  } catch { migrationNeeded = true; }

  // ───────── Live: events of the last 7 days ─────────
  const now = new Date();
  const since7 = new Date(now.getTime() - 7 * 864e5).toISOString();
  const { data: ev } = await db.from("events").select("type,created_at").gte("created_at", since7);
  const evs = ev ?? [];
  const dk = (d: Date) => d.toISOString().slice(0, 10);
  const todayKey = dk(now);
  const isToday = (iso: string) => iso.slice(0, 10) === todayKey;
  const scansToday = evs.filter((e) => e.type === "add" && isToday(e.created_at)).length;
  const rewardsToday = evs.filter((e) => e.type === "claim" && isToday(e.created_at)).length;
  const signupsToday = evs.filter((e) => e.type === "signup" && isToday(e.created_at)).length;

  // 7-day mini chart (scans/stamps per day)
  const LAB = ["S", "M", "T", "W", "T", "F", "S"];
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * 864e5);
    const k = dk(d);
    const count = evs.filter((e) => e.type === "add" && e.created_at.slice(0, 10) === k).length;
    return { label: LAB[d.getDay()], count, today: k === todayKey };
  });
  const maxC = Math.max(1, ...week.map((d) => d.count));

  // ───────── Return rate (customers who came back ≥2 times) ─────────
  const { data: adds } = await db.from("events").select("member_id").eq("type", "add");
  const tally = new Map<string, number>();
  (adds ?? []).forEach((a: { member_id: string }) =>
    tally.set(a.member_id, (tally.get(a.member_id) ?? 0) + 1)
  );
  const base = tally.size;
  const returning = [...tally.values()].filter((c) => c >= 2).length;
  const retention = base ? Math.round((returning / base) * 100) : 0;

  // ───────── Customers to win back (inactive 30 days, active card) ─────────
  const toRelance = await countTargets("inactive").catch(() => 0);

  const activity = await recentActivity(10);

  return (
    <div className="content-narrow">
      <div className="page-head">
        <div>
          <div className="page-title">Hello 👋</div>
          <div className="page-sub">Overview of your coffee loyalty program</div>
        </div>
      </div>

      {migrationNeeded && (
        <div className="note warn">⚠️ Database migrations are missing (run <strong>npm run db:reset</strong> locally, or the SQL in <strong>supabase/migrations</strong>) to enable activity, history, notifications &amp; settings.</div>
      )}

      {/* ───────── LIVE ───────── */}
      <div className="panel live">
        <div className="live-head"><span className="live-dot" /> Live · today</div>
        <div className="live-row">
          <div className="live-stats">
            <div className="live-stat"><div className="v">{scansToday}</div><div className="l">Scans</div></div>
            <div className="live-stat"><div className="v">{rewardsToday}</div><div className="l">Rewards</div></div>
            <div className="live-stat"><div className="v">{signupsToday}</div><div className="l">New</div></div>
          </div>
          <div className="spark" aria-hidden>
            {week.map((d, i) => (
              <div key={i} className="spark-col">
                <div className="spark-track">
                  <div
                    className={"spark-bar" + (d.today ? " today" : "")}
                    style={{ height: `${Math.round((d.count / maxC) * 100)}%` }}
                    title={`${d.count} scan${d.count > 1 ? "s" : ""}`}
                  />
                </div>
                <div className="spark-day">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───────── KPIs ───────── */}
      <div className="grid-kpi">
        <div className="kpi"><div className="ico">👥</div><div className="v">{list.length}</div><div className="l">Members</div></div>
        <div className="kpi"><div className="ico">📲</div><div className="v">{active}</div><div className="l">Active Apple cards</div></div>
        <div className="kpi"><div className="ico">🔁</div><div className="v">{retention}%</div><div className="l">Return rate</div></div>
        <div className="kpi"><div className="ico">☕</div><div className="v">{coffees}</div><div className="l">Coffees stamped</div></div>
      </div>

      {/* ───────── Win-back ───────── */}
      {toRelance > 0 && (
        <Link href="/dashboard/notify" className="relance">
          <span className="relance-ico">🔔</span>
          <div className="grow">
            <strong>{toRelance} customer{toRelance > 1 ? "s" : ""} to win back</strong>
            <div className="page-sub" style={{ display: "block", marginTop: 2 }}>Inactive for 30 days · notification ready</div>
          </div>
          <span className="relance-cta">Notify →</span>
        </Link>
      )}

      <div className="qa-grid">
        <Link href="/dashboard/members" className="qa"><span className="qa-ico">👥</span>View members</Link>
        <Link href="/dashboard/notify" className="qa"><span className="qa-ico">✦</span>Send a notification</Link>
      </div>

      <div className="panel">
        <div className="panel-title">Recent activity</div>
        {activity.length === 0 && <p className="page-sub">No activity yet.</p>}
        {activity.map((e) => (
          <div key={e.id} className="row-item">
            <span className="av">{(e.name || "?").charAt(0).toUpperCase()}</span>
            <div className="grow"><strong>{e.name || "Customer"}</strong> <span className="page-sub" style={{ display: "inline" }}>{ACT[e.type]?.(e.delta) ?? e.type}</span></div>
            <span className="t">{timeAgo(e.created_at)}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

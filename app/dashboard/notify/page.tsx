import { countTargets, campaignHistory, SEGMENT_LABELS, type Segment } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

const SEGMENTS: Segment[] = ["all", "inactive", "reward", "near"];

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "<1 h ago";
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export default async function Notify({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  const counts = Object.fromEntries(
    await Promise.all(SEGMENTS.map(async (s) => [s, await countTargets(s)] as const))
  ) as Record<Segment, number>;
  const history = await campaignHistory(15);

  return (
    <div className="content-narrow">
      <div className="page-head">
        <div><div className="page-title">Notifications</div><div className="page-sub">Lock-screen push to every targeted Apple Wallet card — free and instant. Google Wallet cards show the message on their next update.</div></div>
      </div>

      {sent != null && <div className="note ok">✅ Notification sent to {sent} card{Number(sent) === 1 ? "" : "s"}.</div>}

      <div className="panel">
        <div className="panel-title">New campaign</div>
        <form action="/api/admin/broadcast" method="POST">
          <textarea name="message" maxLength={120} required rows={3} placeholder="Today only: 20% off all lattes ☕ (max 120 characters)" />
          <div className="seg-opts">
            {SEGMENTS.map((s, i) => (
              <label key={s} className="seg-opt">
                <input type="radio" name="segment" value={s} defaultChecked={i === 0} />
                <span className="grow">{SEGMENT_LABELS[s]}</span>
                <span className="cnt">{counts[s]}</span>
              </label>
            ))}
          </div>
          <button type="submit" className="s-btn-full">Send notification</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">Sent campaigns</div>
        {history.length === 0 && <p className="page-sub">No campaigns yet.</p>}
        {history.map((c) => (
          <div key={c.id} className="row-item">
            <div className="grow"><strong>{c.message}</strong><div className="page-sub">{SEGMENT_LABELS[c.segment as Segment] ?? c.segment} · {c.sent_count} sent</div></div>
            <span className="t">{timeAgo(c.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

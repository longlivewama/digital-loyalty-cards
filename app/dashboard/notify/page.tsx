import { countTargets, campaignHistory, SEGMENT_LABELS, type Segment } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

const SEGMENTS: Segment[] = ["all", "inactive", "reward", "near"];

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "il y a <1 h";
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
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
        <div><div className="page-title">Notifications</div><div className="page-sub">Push sur l&apos;écran verrouillé de toutes les cartes ciblées — gratuit, instantané.</div></div>
      </div>

      {sent != null && <div className="note ok">✅ Notification envoyée à {sent} carte{Number(sent) > 1 ? "s" : ""}.</div>}

      <div className="panel">
        <div className="panel-title">Nouvelle campagne</div>
        <form action="/api/admin/broadcast" method="POST">
          <textarea name="message" maxLength={120} required rows={3} placeholder="Ce soir −20% sur les calzones 🍕 (max 120 caractères)" />
          <div className="seg-opts">
            {SEGMENTS.map((s, i) => (
              <label key={s} className="seg-opt">
                <input type="radio" name="segment" value={s} defaultChecked={i === 0} />
                <span className="grow">{SEGMENT_LABELS[s]}</span>
                <span className="cnt">{counts[s]}</span>
              </label>
            ))}
          </div>
          <button type="submit" className="s-btn-full">Envoyer la notification</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">Campagnes envoyées</div>
        {history.length === 0 && <p className="page-sub">Aucune campagne pour l&apos;instant.</p>}
        {history.map((c) => (
          <div key={c.id} className="row-item">
            <div className="grow"><strong>{c.message}</strong><div className="page-sub">{SEGMENT_LABELS[c.segment as Segment] ?? c.segment} · {c.sent_count} envoyées</div></div>
            <span className="t">{timeAgo(c.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

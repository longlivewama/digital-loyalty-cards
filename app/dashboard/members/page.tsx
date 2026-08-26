import { supabaseAdmin } from "@/lib/supabase";
import { getSettings } from "@/lib/settings";
import { cycle, rewardsAvailable } from "@/lib/loyalty";
import { isBirthdayThisMonth } from "@/lib/birthday";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SP = { q?: string; sort?: string; filter?: string };

export default async function Members({ searchParams }: { searchParams: Promise<SP> }) {
  const { q, sort = "recent", filter = "all" } = await searchParams;
  const { goal } = await getSettings();
  const db = supabaseAdmin();

  let query = db.from("members").select("id,name,last_name,birthday,serial,points,total_earned,registered_at,updated_at").limit(300);
  if (q?.trim()) {
    // recherche sur prénom OU nom ; on retire les caractères qui cassent la syntaxe `or` de PostgREST
    const term = q.trim().replace(/[,()]/g, "");
    query = query.or(`name.ilike.%${term}%,last_name.ilike.%${term}%`);
  }
  if (sort === "points") query = query.order("points", { ascending: false });
  else if (sort === "inactive") query = query.order("updated_at", { ascending: true });
  else query = query.order("created_at", { ascending: false });
  const { data } = await query;
  let list = data ?? [];
  if (filter === "active") list = list.filter((m) => m.registered_at);
  else if (filter === "reward") list = list.filter((m) => rewardsAvailable(m.points ?? 0, goal) > 0);
  else if (filter === "bday") list = list.filter((m) => isBirthdayThisMonth(m.birthday));

  const link = (key: string, val: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("sort", key === "sort" ? val : sort);
    p.set("filter", key === "filter" ? val : filter);
    return `/dashboard/members?${p}`;
  };
  const cur = (key: string) => (key === "sort" ? sort : filter);

  return (
    <div className="content-narrow">
      <div className="page-head">
        <div><div className="page-title">Membres</div><div className="page-sub">{list.length} client{list.length > 1 ? "s" : ""}</div></div>
        <a className="s-btn s-ghost" href="/api/admin/export">⬇︎ Export CSV</a>
      </div>

      <form className="toolbar" method="GET">
        <input className="grow" name="q" defaultValue={q ?? ""} placeholder="Rechercher un client…" />
        <input type="hidden" name="sort" value={sort} /><input type="hidden" name="filter" value={filter} />
        <button type="submit" className="s-sm">Chercher</button>
      </form>

      <div className="filters-bar">
        <div className="filter-set">
          <span className="filter-set-label">Trier</span>
          <div className="seg-tabs">
            <Link href={link("sort", "recent")} className={cur("sort") === "recent" ? "on" : ""}>Récents</Link>
            <Link href={link("sort", "points")} className={cur("sort") === "points" ? "on" : ""}>Points</Link>
            <Link href={link("sort", "inactive")} className={cur("sort") === "inactive" ? "on" : ""}>Inactifs</Link>
          </div>
        </div>
        <span className="filter-divider" aria-hidden="true" />
        <div className="filter-set">
          <span className="filter-set-label">Filtrer</span>
          <div className="seg-tabs">
            <Link href={link("filter", "all")} className={cur("filter") === "all" ? "on" : ""}>Tous</Link>
            <Link href={link("filter", "active")} className={cur("filter") === "active" ? "on" : ""}>Actives</Link>
            <Link href={link("filter", "reward")} className={cur("filter") === "reward" ? "on" : ""}>Récompense</Link>
            <Link href={link("filter", "bday")} className={cur("filter") === "bday" ? "on" : ""}>🎂 Anniv.</Link>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: "8px 12px" }}>
        <table className="tbl">
          <thead><tr><th>Client</th><th>Carte</th><th>Tampons</th><th>Statut</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={4} className="page-sub">Aucun résultat.</td></tr>}
            {list.map((m) => {
              const r = rewardsAvailable(m.points ?? 0, goal);
              const fullName = [m.name, m.last_name].filter(Boolean).join(" ") || m.name;
              const bday = isBirthdayThisMonth(m.birthday);
              return (
                <tr key={m.id}>
                  <td>
                    <Link href={`/m/${m.id}`} className="cell-name" style={{ color: "inherit", textDecoration: "none" }}>
                      <span className="av">{(m.name || "?").charAt(0).toUpperCase()}</span>
                      <span>{fullName}</span>
                      {bday && <span className="bday-tag" title="Anniversaire ce mois-ci">🎂</span>}
                    </Link>
                  </td>
                  <td><span className="page-sub">{m.serial}</span></td>
                  <td>{cycle(m.points ?? 0, goal)}/{goal}</td>
                  <td>
                    {r > 0 ? <span className="chip green">🎉 {r} offerte{r > 1 ? "s" : ""}</span>
                      : m.registered_at ? <span className="chip copper">active</span>
                      : <span className="chip gray">inactive</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

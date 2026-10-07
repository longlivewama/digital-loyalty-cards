import { supabaseAdmin } from "@/lib/supabase";
import { getSettings } from "@/lib/settings";
import { displayStamps, rewardsAvailable } from "@/lib/loyalty";
import { isBirthdayThisMonth } from "@/lib/birthday";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SP = { q?: string; sort?: string; filter?: string };

export default async function Members({ searchParams }: { searchParams: Promise<SP> }) {
  const { q, sort = "recent", filter = "all" } = await searchParams;
  const { goal } = await getSettings();
  const db = supabaseAdmin();

  let query = db.from("members").select("id,name,last_name,birthday,serial,points,total_earned,registered_at,updated_at,google_object_id").limit(300);
  if (q?.trim()) {
    // search first OR last name; strip the characters that break PostgREST `or` syntax
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
        <div><div className="page-title">Members</div><div className="page-sub">{list.length} customer{list.length > 1 ? "s" : ""}</div></div>
        <a className="s-btn s-ghost" href="/api/admin/export">⬇︎ Export CSV</a>
      </div>

      <form className="toolbar" method="GET">
        <input className="grow" name="q" defaultValue={q ?? ""} placeholder="Search a customer…" />
        <input type="hidden" name="sort" value={sort} /><input type="hidden" name="filter" value={filter} />
        <button type="submit" className="s-sm">Search</button>
      </form>

      <div className="filters-bar">
        <div className="filter-set">
          <span className="filter-set-label">Sort</span>
          <div className="seg-tabs">
            <Link href={link("sort", "recent")} className={cur("sort") === "recent" ? "on" : ""}>Recent</Link>
            <Link href={link("sort", "points")} className={cur("sort") === "points" ? "on" : ""}>Stamps</Link>
            <Link href={link("sort", "inactive")} className={cur("sort") === "inactive" ? "on" : ""}>Inactive</Link>
          </div>
        </div>
        <span className="filter-divider" aria-hidden="true" />
        <div className="filter-set">
          <span className="filter-set-label">Filter</span>
          <div className="seg-tabs">
            <Link href={link("filter", "all")} className={cur("filter") === "all" ? "on" : ""}>All</Link>
            <Link href={link("filter", "active")} className={cur("filter") === "active" ? "on" : ""}>Active</Link>
            <Link href={link("filter", "reward")} className={cur("filter") === "reward" ? "on" : ""}>Reward</Link>
            <Link href={link("filter", "bday")} className={cur("filter") === "bday" ? "on" : ""}>🎂 Birthdays</Link>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: "8px 12px" }}>
        <table className="tbl">
          <thead><tr><th>Customer</th><th>Card</th><th>Stamps</th><th>Status</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={4} className="page-sub">No results.</td></tr>}
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
                      {bday && <span className="bday-tag" title="Birthday this month">🎂</span>}
                    </Link>
                  </td>
                  <td><span className="page-sub">{m.serial}</span></td>
                  <td>{displayStamps(m.points ?? 0, goal)}/{goal}</td>
                  <td>
                    {r > 0 ? <span className="chip green">🎉 {r} free coffee{r > 1 ? "s" : ""}</span>
                      : m.registered_at || m.google_object_id
                        ? <span className="chip copper">{[m.registered_at && "Apple", m.google_object_id && "Google"].filter(Boolean).join(" · ")}</span>
                        : <span className="chip gray">no wallet</span>}
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

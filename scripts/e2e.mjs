// End-to-end HTTP test against a RUNNING app + the local Supabase.
//   npm run build && npx next start -p 3100   (or npm run dev -- -p 3100)
//   BASE=http://localhost:3100 npm run e2e
// With GOOGLE=fake, also checks the Google save link against a server started
// with a fake service account (Google API calls fail → graceful fallback).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE || "http://localhost:3100";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]])
);
const PIN = env.MERCHANT_PIN;
const SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const FRENCH = /pizza|Pizzeria|tampon|Carte de fidélité|Ajouter à|Bienvenue|Réglages|Membres|Déconnexion|Récompense|Inscription|Horaires/i;

let passed = 0, failed = 0;
function check(name, ok, detail = "") {
  if (ok) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✖ ${name} ${detail}`); }
}
const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const MYIP = ip();
async function req(p, { method = "GET", form, cookie, json, headers = {}, xff = MYIP } = {}) {
  const h = { "x-forwarded-for": xff, ...headers };
  if (cookie) h.cookie = cookie;
  if (json) h.accept = "application/json";
  let body;
  if (form) { h["content-type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString(); }
  return fetch(BASE + p, { method, headers: h, body, redirect: "manual" });
}
// Rendered HTML as text: React inserts <!-- --> between adjacent text nodes.
const text = async (r) => (await r.text()).replace(/<!-- -->/g, "");
async function dbMember(filter) {
  const r = await fetch(`${SB}/rest/v1/members?select=*&${filter}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  return (await r.json())[0];
}
function passJsonOf(buf) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "e2e-")), "c.pkpass");
  fs.writeFileSync(f, Buffer.from(buf));
  return JSON.parse(execFileSync("unzip", ["-p", f, "pass.json"], { encoding: "utf8" }));
}

console.log(`E2E against ${BASE}\n`);

console.log("Public pages (English only)");
for (const p of ["/", "/join", "/login", "/cgu"]) {
  const r = await req(p); const html = await text(r);
  check(`${p} → 200`, r.status === 200, `got ${r.status}`);
  check(`${p} has no French/pizzeria text`, !FRENCH.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), (html.match(FRENCH) || [])[0]);
}
check("/join shows the 9 → free coffee rule", (await text(await req("/join"))).includes("Buy 9 coffees, get the 10th"));

console.log("\nCustomer signup");
const j = await req("/api/join", { method: "POST", form: { name: "Ahmed", last_name: "Fahim", phone: "", birthday: "1995-03-12" } });
const loc = j.headers.get("location") || "";
check("POST /api/join → 303 to signed /added link", j.status === 303 && /\/added\/[0-9A-F]{8}\?k=[0-9a-f]{32}$/.test(loc), `${j.status} ${loc}`);
const [, serial, k] = loc.match(/\/added\/([0-9A-F]{8})\?k=([0-9a-f]+)/) || [];
const m0 = await dbMember(`serial=eq.${serial}`);
check("member created in Supabase with 0 stamps", m0 && m0.points === 0 && m0.last_name === "Fahim" && m0.auth_token && m0.token_rotated);
const id = m0.id;

const added = await req(`/added/${serial}?k=${k}`); const addedHtml = await added.text();
check("/added (signed) → 200 with Apple button", added.status === 200 && addedHtml.includes("Add to Apple Wallet"));
check("/added shows Google button only when configured", process.env.GOOGLE === "fake" ? addedHtml.includes("Add to Google Wallet") : !addedHtml.includes("Add to Google Wallet"));
check("/added without key → 404", (await req(`/added/${serial}`)).status === 404);
check("/added with a wrong key → 404", (await req(`/added/${serial}?k=${"0".repeat(32)}`)).status === 404);
check("pass download without key → 403", (await req(`/api/pass/${serial}`)).status === 403);
check("status without key → 403", (await req(`/api/member/${serial}/status`)).status === 403);
const st = await req(`/api/member/${serial}/status?k=${k}`);
check("status (signed) → registered:false", st.status === 200 && (await st.json()).registered === false);

console.log("\nApple Wallet pass (test certificates)");
const pk = await req(`/api/pass/${serial}?k=${k}`);
check("pkpass → 200 application/vnd.apple.pkpass", pk.status === 200 && pk.headers.get("content-type") === "application/vnd.apple.pkpass", `${pk.status}`);
const pj = passJsonOf(await pk.arrayBuffer());
check("pass barcode = /m/[member-id] (no secret)", pj.barcodes[0].message.endsWith(`/m/${id}`) && !pj.barcodes[0].message.includes(m0.auth_token));
check("pass shows 0/9 STAMPS", pj.storeCard.headerFields[0].label === "STAMPS" && pj.storeCard.headerFields[0].value === "0/9");
check("pass carries the per-card auth token", pj.authenticationToken === m0.auth_token);

console.log("\nGoogle Wallet save link");
const g = await req(`/api/google-pass/${serial}?k=${k}`);
if (process.env.GOOGLE === "fake") {
  const gl = g.headers.get("location") || "";
  check("google-pass → 302 to pay.google.com save link (fallback JWT)", g.status === 302 && gl.startsWith("https://pay.google.com/gp/v/save/"), `${g.status}`);
  const claims = JSON.parse(Buffer.from(gl.split("/save/")[1].split(".")[1], "base64url"));
  const obj = claims.payload.loyaltyObjects[0];
  check("JWT object: same QR + 0/9", obj.barcode?.value?.endsWith(`/m/${id}`) && obj.loyaltyPoints?.balance?.string === "0/9", JSON.stringify(obj).slice(0, 120));
  check("google_object_id stored on the member", !!(await dbMember(`id=eq.${id}`)).google_object_id);
} else {
  check("google-pass → 503 when Google is not configured", g.status === 503, `${g.status}`);
}
check("google-pass without key → 403", (await req(`/api/google-pass/${serial}`)).status === 403);

console.log("\nSignup validation (server-side)");
const before = (await (await fetch(`${SB}/rest/v1/members?select=id`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}`, prefer: "count=exact", range: "0-0" } })).headers.get("content-range"));
for (const [label, form, err] of [
  ["empty names", { name: "", last_name: "" }, "name"],
  ["41-char name", { name: "A".repeat(41), last_name: "X" }, "name"],
  ["invalid birthday", { name: "A", last_name: "B", birthday: "2023-02-30" }, "birthday"],
  ["future birthday", { name: "A", last_name: "B", birthday: "2999-01-01" }, "birthday"],
  ["invalid phone", { name: "A", last_name: "B", phone: "<script>" }, "phone"],
]) {
  const r = await req("/api/join", { method: "POST", form });
  check(`signup rejects ${label}`, r.status === 303 && (r.headers.get("location") || "").endsWith(`/join?error=${err}`), r.headers.get("location"));
}
check("signup rejects a non-form body → 400", (await fetch(BASE + "/api/join", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status === 400);
const after = (await (await fetch(`${SB}/rest/v1/members?select=id`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}`, prefer: "count=exact", range: "0-0" } })).headers.get("content-range"));
check("rejected signups created no rows", before === after, `${before} → ${after}`);
check("/added shows the member QR code", addedHtml.includes('alt="Loyalty card QR code, member ' + serial));

console.log("\nDatabase permissions (public anon key)");
const ANON = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const anonH = { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": "application/json" };
check("anon cannot read members", JSON.stringify(await (await fetch(`${SB}/rest/v1/members?select=id`, { headers: anonH })).json()) === "[]");
check("anon cannot insert members", (await fetch(`${SB}/rest/v1/members`, { method: "POST", headers: anonH, body: JSON.stringify({ serial: "HACK", name: "x" }) })).status >= 400);
check("anon cannot call change_points", (await fetch(`${SB}/rest/v1/rpc/change_points`, { method: "POST", headers: anonH, body: JSON.stringify({ p_id: id, p_delta: 50, p_earned: 50 }) })).status >= 400);
check("anon cannot call claim_reward", (await fetch(`${SB}/rest/v1/rpc/claim_reward`, { method: "POST", headers: anonH, body: JSON.stringify({ p_id: id, p_goal: 1 }) })).status >= 400);

console.log("\nStaff protection");
const m1 = await req(`/m/${id}`);
check("/m/[id] without login → redirect to /login?next=…", [302, 307].includes(m1.status) && (m1.headers.get("location") || "").includes(`/login?next=%2Fm%2F${id}`));
check("admin API without login (fetch) → 401", (await req(`/api/admin/member/${id}`, { method: "POST", form: { op: "add" }, json: true })).status === 401);
check("admin API without login (form) → redirect to /login", [302, 307].includes((await req(`/api/admin/member/${id}`, { method: "POST", form: { op: "add" } })).status));
check("old raw-PIN cookie is rejected", [302, 307].includes((await req("/dashboard", { cookie: `mpin=${PIN}` })).status));
check("CSV export without login → blocked", (await req("/api/admin/export")).status !== 200);
check("no stamp was added by unauthenticated calls", (await dbMember(`id=eq.${id}`)).points === 0);
const evilNext = await req("/api/auth", { method: "POST", form: { pin: PIN, next: "//evil.example.com" }, xff: ip() });
check("open redirect via next=//host blocked", (evilNext.headers.get("location") || "").startsWith(`${BASE}/dashboard`) || evilNext.headers.get("location") === "/dashboard", evilNext.headers.get("location"));

console.log("\nPIN brute-force lockout");
const attacker = ip();
for (let i = 0; i < 5; i++) await req("/api/auth", { method: "POST", form: { pin: "000000", next: "/dashboard" }, xff: attacker });
const locked = await req("/api/auth", { method: "POST", form: { pin: PIN, next: "/dashboard" }, xff: attacker });
check("after 5 wrong PINs the IP is locked (even with the right PIN)", (locked.headers.get("location") || "").includes("error=locked"));

console.log("\nStaff login + QR scan flow");
const login = await req("/api/auth", { method: "POST", form: { pin: PIN, next: `/m/${id}` } });
const setCookie = login.headers.get("set-cookie") || "";
const cookie = (setCookie.match(/mpin=[^;]+/) || [""])[0];
check("login → 303 back to the scanned member page", login.status === 303 && (login.headers.get("location") || "").endsWith(`/m/${id}`));
check("session cookie is HttpOnly and is not the PIN", /HttpOnly/i.test(setCookie) && cookie && cookie !== `mpin=${PIN}`);
const page = await req(`/m/${id}`, { cookie }); const pageHtml = await text(page);
check("member page → 200, English, 0/9", page.status === 200 && pageHtml.includes("Ahmed Fahim") && pageHtml.includes("more coffees until a free coffee") && !FRENCH.test(pageHtml.replace(/<script[\s\S]*?<\/script>/g, "")));

console.log("\nStamps → reward → redeem");
const op = async (o, n) => (await (await req(`/api/admin/member/${id}`, { method: "POST", form: n ? { op: o, n } : { op: o }, json: true, cookie })).json()).points ?? null;
const opStatus = async (target, form) => (await req(`/api/admin/member/${target}`, { method: "POST", form, json: true, cookie })).status;
let pts;
for (let i = 1; i <= 8; i++) pts = await op("add", "1");
check("+1 ×8 → 8", pts === 8);
check("redeem at 8 is refused (409)", (await opStatus(id, { op: "claim" })) === 409 && (await dbMember(`id=eq.${id}`)).points === 8);
pts = await op("add", "1");
check("+1 → 9 (Supabase)", pts === 9 && (await dbMember(`id=eq.${id}`)).points === 9);
const p9 = await req(`/m/${id}`, { cookie }); const h9 = await text(p9);
check("member page: Reward available, 9/9, Redeem button", h9.includes("Reward available") && h9.includes("Redeem free coffee") && /9<span[^>]*>\/9/.test(h9));
const pass9 = passJsonOf(await (await req(`/api/pass/${serial}?k=${k}`)).arrayBuffer());
check("Apple pass at 9: 9/9 + free coffee message", pass9.storeCard.headerFields[0].value === "9/9" && pass9.storeCard.auxiliaryFields[0].value.includes("free coffee"));
check("redeem → 0", (await op("claim")) === 0 && (await dbMember(`id=eq.${id}`)).points === 0);
check("second redeem refused", (await op("claim")) === null);
check("−1 at 0 stays 0", (await op("remove")) === 0);
await Promise.all(Array.from({ length: 20 }, () => op("add", "1")));
check("20 simultaneous +1 over HTTP → exactly 20", (await dbMember(`id=eq.${id}`)).points === 20);
check("−1 → 19", (await op("remove")) === 19);
check("+3 in one tap → 22", (await op("add", "3")) === 22);
check("quantity is clamped (n=1000 → +100)", (await op("add", "1000")) === 122);
check("unknown member → 404", (await opStatus("00000000-0000-4000-8000-000000000000", { op: "add" })) === 404);
check("malformed member id → 404", (await opStatus("not-a-uuid", { op: "add" })) === 404);
check("unknown operation → 400", (await opStatus(id, { op: "delete" })) === 400);
check("negative / non-integer quantity → 400", (await opStatus(id, { op: "add", n: "-5" })) === 400 && (await opStatus(id, { op: "add", n: "1.5" })) === 400);
check("wallet resync op accepted", (await (await req(`/api/admin/member/${id}`, { method: "POST", form: { op: "sync" }, json: true, cookie })).json()).ok === true);

console.log("\nApple Wallet web service (device registration + update)");
const fresh = await dbMember(`id=eq.${id}`);
const ptid = pj.passTypeIdentifier;
const regPath = `/api/wallet/v1/devices/dev123/registrations/${ptid}/${serial}`;
check("register with a wrong token → 401", (await req(regPath, { method: "POST", headers: { authorization: "ApplePass nope", "content-type": "application/json" } })).status === 401);
check("register with the legacy serial token → 401 (rotated card)", (await req(regPath, { method: "POST", headers: { authorization: `ApplePass ${serial.padEnd(16, "0")}` } })).status === 401);
const reg = await fetch(BASE + regPath, { method: "POST", headers: { authorization: `ApplePass ${fresh.auth_token}`, "content-type": "application/json" }, body: JSON.stringify({ pushToken: "e2e-fake-push-token" }) });
check("register with the card token → 201", reg.status === 201);
check("/added status now registered:true", (await (await req(`/api/member/${serial}/status?k=${k}`)).json()).registered === true);
const list = await req(`/api/wallet/v1/devices/dev123/registrations/${ptid}?passesUpdatedSince=2000-01-01T00:00:00+00:00`);
check("updated-passes list contains the serial", list.status === 200 && (await list.json()).serialNumbers.includes(serial));
const wp = await req(`/api/wallet/v1/passes/${ptid}/${serial}`, { headers: { authorization: `ApplePass ${fresh.auth_token}` } });
const lastMod = wp.headers.get("last-modified");
const wpj = wp.status === 200 ? passJsonOf(await wp.arrayBuffer()) : null;
// 122 stamps = 13 free coffees waiting → full card (9/9).
check("updated pass fetch → 200 pkpass with current balance (122 → 9/9, rewards waiting)", wpj?.storeCard.headerFields[0].value === "9/9" && wpj.storeCard.secondaryFields[1].value === "Free coffee 🎉");
check("If-Modified-Since → 304", (await req(`/api/wallet/v1/passes/${ptid}/${serial}`, { headers: { authorization: `ApplePass ${fresh.auth_token}`, "if-modified-since": lastMod } })).status === 304);
check("+1 after registration still works (APNs push fails safely)", (await op("add", "1")) === 123);
check("unregister → 200", (await req(regPath, { method: "DELETE", headers: { authorization: `ApplePass ${fresh.auth_token}` } })).status === 200);

console.log("\nDashboard (English)");
for (const p of ["/dashboard", "/dashboard/members", "/dashboard/stats", "/dashboard/settings", "/dashboard/notify"]) {
  const r = await req(p, { cookie }); const html = await text(r);
  check(`${p} → 200, no French`, r.status === 200 && !FRENCH.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), `${r.status} ${(html.match(FRENCH) || [])[0] || ""}`);
}
const csv = await req("/api/admin/export", { cookie }); const csvText = await csv.text();
check("CSV export → English header + member row", csv.status === 200 && csvText.includes("First name,Last name") && csvText.includes(serial));
const evil = await req("/api/join", { method: "POST", form: { name: '=HYPERLINK("http://evil")', last_name: "+SUM(1,2)" } });
const evilSerial = (evil.headers.get("location") || "").match(/added\/(\w+)/)[1];
const csv2 = await (await req("/api/admin/export", { cookie })).text();
check("CSV export neutralises formula injection", csv2.includes(`"'=HYPERLINK(""http://evil"")","'+SUM(1,2)"`) && !/(^|,)"?=HYPERLINK/m.test(csv2));
const csvRow = csv2.split("\n").find((l) => l.includes(serial)).split(",");
const dbRow = await dbMember(`id=eq.${id}`);
check("CSV row matches the database (stamps, total)", csvRow[5] === String(dbRow.points) && csvRow[6] === String(dbRow.total_earned));
await fetch(`${SB}/rest/v1/members?serial=eq.${evilSerial}`, { method: "DELETE", headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
const settings = await req("/api/admin/settings", { method: "POST", cookie, form: { section: "resto", resto_name: "Coffee Shop", address: "1 Example Street\nYour City", hours: "Mon–Fri · 7am–6pm", instagram: "https://www.instagram.com/", phone: "" } });
check("settings save → redirect ?saved=1", (settings.headers.get("location") || "").includes("/dashboard/settings?saved=1"));
const out = await req("/api/auth/logout", { method: "POST", cookie });
check("logout clears the cookie", /mpin=;|Max-Age=0/i.test(out.headers.get("set-cookie") || ""));

console.log(`\n${passed} passed, ${failed} failed`);
// Clean up the test member.
await fetch(`${SB}/rest/v1/members?id=eq.${id}`, { method: "DELETE", headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
process.exit(failed ? 1 : 0);

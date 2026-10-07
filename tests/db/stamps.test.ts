// Database-backed tests (local Supabase): `npm run db:start` then `npm run test:db`.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { supabaseAdmin } from "../../lib/supabase";
import { addPoints, removePoint, claimReward, pushUpdate } from "../../lib/members";
import { setWalletClientFactory, syncMember, objectId, googleWalletConfig, type WalletClient } from "../../lib/googleWallet";

const db = () => supabaseAdmin();
const ids: string[] = [];
const points = async (id: string) =>
  (await db().from("members").select("points").eq("id", id).single()).data!.points as number;

async function newMember(p = 0): Promise<string> {
  const serial = "T" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const { data, error } = await db()
    .from("members")
    .insert({ name: "Test", last_name: "Customer", serial, points: p, total_earned: p, auth_token: crypto.randomUUID() })
    .select("id")
    .single();
  assert.ifError(error);
  ids.push(data!.id);
  return data!.id;
}

before(() => {
  assert.ok(process.env.SUPABASE_URL, "run with --env-file=.env.local and a local Supabase");
  // Never talk to the real Google API from tests.
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  Object.assign(process.env, {
    WALLET_ISSUER_ID: "3388000000099999999",
    CLIENT_EMAIL: "test@example.iam.gserviceaccount.com",
    PRIVATE_KEY: privateKey,
  });
});
after(async () => {
  setWalletClientFactory(null);
  if (ids.length) await db().from("members").delete().in("id", ids);
});

test("+1 stamp, −1 stamp (never below 0), events logged", async () => {
  const id = await newMember();
  assert.equal(await addPoints(id, 1), 1);
  assert.equal(await addPoints(id, 3), 4);
  assert.equal(await removePoint(id), 3);
  const z = await newMember(0);
  assert.equal(await removePoint(z), 0);
  const { data: ev } = await db().from("events").select("type,delta").eq("member_id", id).order("id");
  assert.deepEqual(ev, [{ type: "add", delta: 1 }, { type: "add", delta: 3 }, { type: "remove", delta: -1 }]);
});

test("9 stamps → reward available → redeem → 0", async () => {
  const id = await newMember();
  for (let i = 0; i < 8; i++) await addPoints(id, 1);
  assert.equal(await claimReward(id), null, "no reward at 8 stamps");
  assert.equal(await addPoints(id, 1), 9);
  assert.equal(await claimReward(id), 0);
  assert.equal(await points(id), 0);
  assert.equal(await claimReward(id), null, "cannot redeem twice");
});

test("race: 20 simultaneous +1 → exactly +20 (atomic change_points)", async () => {
  const id = await newMember();
  await Promise.all(Array.from({ length: 20 }, () => addPoints(id, 1)));
  assert.equal(await points(id), 20);
  const { data } = await db().from("members").select("total_earned").eq("id", id).single();
  assert.equal(data!.total_earned, 20);
});

test("race: two simultaneous redemptions of one reward → only one succeeds", async () => {
  const id = await newMember(9);
  const r = await Promise.all([claimReward(id), claimReward(id), claimReward(id)]);
  assert.equal(r.filter((x) => x === 0).length, 1);
  assert.equal(r.filter((x) => x === null).length, 2);
  assert.equal(await points(id), 0);
});

// ---- Google Wallet sync after DB updates ----------------------------------

function recordingApi(behaviour: "ok" | "404" | "500" | "throw") {
  const patches: Record<string, any>[] = [];
  const fail = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
  const patch = async (p: { requestBody: Record<string, any> }) => {
    if (behaviour === "throw") throw new Error("socket hang up");
    if (behaviour === "404") throw fail(404);
    if (behaviour === "500") throw fail(500);
    patches.push(p.requestBody);
    return {};
  };
  const api = { loyaltyobject: { patch }, loyaltyclass: {} } as unknown as WalletClient;
  return { api, patches };
}

test("Google sync mirrors the database balance (6 → 7, 9/9, redeem → 0/9)", async () => {
  const id = await newMember(6);
  const cfg = googleWalletConfig()!;
  await db().from("members").update({ google_object_id: objectId(cfg, id) }).eq("id", id);
  const { api, patches } = recordingApi("ok");
  setWalletClientFactory(() => api);

  await addPoints(id, 1);
  assert.equal(await syncMember(id, "http://localhost:3000"), "patched");
  assert.equal(patches.at(-1)!.loyaltyPoints.balance.string, "7/9");
  assert.equal(patches.at(-1)!.barcode.value, `http://localhost:3000/m/${id}`);

  await addPoints(id, 2);
  await syncMember(id, "http://localhost:3000");
  assert.equal(patches.at(-1)!.loyaltyPoints.balance.string, "9/9");
  assert.equal(patches.at(-1)!.secondaryLoyaltyPoints.balance.int, 1);

  await claimReward(id);
  await pushUpdate(id, "http://localhost:3000"); // the real post-mutation hook
  assert.equal(patches.at(-1)!.loyaltyPoints.balance.string, "0/9");
});

test("Google failures never corrupt the stamp balance", async () => {
  const id = await newMember(4);
  const cfg = googleWalletConfig()!;
  await db().from("members").update({ google_object_id: objectId(cfg, id) }).eq("id", id);
  for (const b of ["500", "throw"] as const) {
    setWalletClientFactory(() => recordingApi(b).api);
    await addPoints(id, 1);
    assert.equal(await syncMember(id, "http://localhost:3000"), "failed");
    await pushUpdate(id, "http://localhost:3000"); // must not throw
  }
  assert.equal(await points(id), 6);

  setWalletClientFactory(() => recordingApi("404").api);
  assert.equal(await syncMember(id, "http://localhost:3000"), "not_saved");

  // Members who never asked for a Google card are skipped entirely.
  const other = await newMember(1);
  assert.equal(await syncMember(other, "http://localhost:3000"), "skipped");
});

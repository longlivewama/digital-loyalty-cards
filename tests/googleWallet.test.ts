import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import {
  buildLoyaltyClass,
  buildLoyaltyObject,
  createSaveUrl,
  ensureClass,
  googleWalletConfig,
  isGoogleWalletConfigured,
  missingGoogleWalletEnv,
  objectId,
  prepareSave,
  setWalletClientFactory,
  statusOf,
  upsertObject,
  type WalletClient,
} from "../lib/googleWallet";
import { buildPassJson } from "../lib/pass";
import { DEFAULT_SETTINGS } from "../lib/settings";
import type { Member } from "../lib/supabase";

const base = "https://coffee.example.com";
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const ENV = {
  WALLET_ISSUER_ID: "3388000000012345678",
  TYPE: "service_account",
  PROJECT_ID: "coffee-test",
  PRIVATE_KEY_ID: "abc123",
  // One-line .env form, with literal \n like the reference README.
  PRIVATE_KEY: privateKey.replace(/\n/g, "\\n"),
  CLIENT_EMAIL: "wallet@coffee-test.iam.gserviceaccount.com",
  CLIENT_ID: "1234567890",
};
const member = (points: number, extra: Partial<Member> = {}): Member => ({
  id: "6f1c1a52-1111-4222-8333-944455556666",
  serial: "3FA2C9B1",
  name: "Ahmed",
  last_name: "Fahim",
  points,
  total_earned: points,
  phone: null,
  created_at: "2026-10-01T10:00:00Z",
  ...extra,
});

// A mock of the Google Wallet REST API: records calls, simulates statuses.
type Call = { op: string; id?: string; body?: Record<string, unknown> };
function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status } });
}
function mockApi(opts: { classExists?: boolean; objectExists?: boolean; fail?: number[] } = {}) {
  const calls: Call[] = [];
  const failures = [...(opts.fail ?? [])]; // statuses to throw, one per call
  let classExists = !!opts.classExists;
  let objectExists = !!opts.objectExists;
  const step = async (c: Call, run: () => void) => {
    calls.push(c);
    const f = failures.shift();
    if (f) throw httpError(f);
    run();
    return { status: 200 };
  };
  const api: WalletClient = {
    loyaltyclass: {
      get: (p) => step({ op: "class.get", id: p.resourceId }, () => { if (!classExists) throw httpError(404); }),
      insert: (p) => step({ op: "class.insert", body: p.requestBody as never }, () => { classExists = true; }),
      patch: (p) => step({ op: "class.patch", id: p.resourceId, body: p.requestBody as never }, () => {}),
    },
    loyaltyobject: {
      get: (p) => step({ op: "object.get", id: p.resourceId }, () => { if (!objectExists) throw httpError(404); }),
      insert: (p) => step({ op: "object.insert", body: p.requestBody as never }, () => { objectExists = true; }),
      patch: (p) => step({ op: "object.patch", id: p.resourceId, body: p.requestBody as never }, () => { if (!objectExists) throw httpError(404); }),
    },
  };
  return { api, calls };
}

beforeEach(() => {
  Object.assign(process.env, ENV);
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});
afterEach(() => setWalletClientFactory(null));

test("configuration: required variables and private-key normalisation", () => {
  assert.deepEqual(missingGoogleWalletEnv({}), ["WALLET_ISSUER_ID", "CLIENT_EMAIL", "PRIVATE_KEY"]);
  assert.equal(isGoogleWalletConfigured({}), false);
  const cfg = googleWalletConfig(ENV)!;
  assert.equal(cfg.classSuffix, "coffee_loyalty");
  assert.ok(cfg.credentials.private_key.includes("\n-----END PRIVATE KEY-----"));
  assert.ok(!cfg.credentials.private_key.includes("\\n"));
  assert.equal(googleWalletConfig({ ...ENV, GOOGLE_WALLET_CLASS_SUFFIX: "bad suffix!" }), null);
});

test("object: same member, same QR, same stamps as the Apple pass", () => {
  const cfg = googleWalletConfig(ENV)!;
  const obj = buildLoyaltyObject(cfg, member(6), DEFAULT_SETTINGS, base);
  const apple = buildPassJson(member(6), base, DEFAULT_SETTINGS);
  assert.equal(obj.id, "3388000000012345678.member_6f1c1a52111142228333944455556666");
  assert.equal(obj.classId, "3388000000012345678.coffee_loyalty");
  assert.equal(obj.barcode?.type, "QR_CODE");
  assert.equal(obj.barcode?.value, apple.barcodes[0].message); // one identity
  assert.equal(obj.loyaltyPoints?.balance?.string, apple.storeCard.headerFields[0].value); // "6/9"
  assert.equal(obj.loyaltyPoints?.label, "Stamps");
  assert.equal(obj.secondaryLoyaltyPoints?.balance?.int, 0);
  assert.equal(obj.accountName, "Ahmed Fahim");
  assert.equal(obj.textModulesData?.[0].header, "Your Progress");
  assert.equal(obj.textModulesData?.[0].body, "3 more coffees until your free coffee ☕");
});

test("object at 9 stamps: 9/9 and free coffee available", () => {
  const cfg = googleWalletConfig(ENV)!;
  const obj = buildLoyaltyObject(cfg, member(9), DEFAULT_SETTINGS, base);
  assert.equal(obj.loyaltyPoints?.balance?.string, "9/9");
  assert.equal(obj.secondaryLoyaltyPoints?.balance?.int, 1);
  assert.equal(obj.textModulesData?.[0].header, "Free coffee available! 🎉");
  // after redeeming: 0/9
  assert.equal(buildLoyaltyObject(cfg, member(0), DEFAULT_SETTINGS, base).loyaltyPoints?.balance?.string, "0/9");
});

test("class: English program details, logo, review status", () => {
  const cfg = googleWalletConfig(ENV)!;
  const cls = buildLoyaltyClass(cfg, DEFAULT_SETTINGS, base);
  assert.equal(cls.programName, "Coffee Shop Loyalty Card");
  assert.equal(cls.issuerName, "Coffee Shop");
  assert.equal(cls.programLogo?.sourceUri?.uri, `${base}/logo.png`);
  assert.equal(cls.reviewStatus, "UNDER_REVIEW");
  assert.match(cls.textModulesData![0].body!, /Buy 9 coffees and your next coffee is free/);
  const custom = googleWalletConfig({ ...ENV, GOOGLE_WALLET_LOGO_URL: "https://cdn.example.com/l.png" })!;
  assert.equal(buildLoyaltyClass(custom, DEFAULT_SETTINGS, base).programLogo?.sourceUri?.uri, "https://cdn.example.com/l.png");
});

test("save link: RS256 JWT signed by the service account", () => {
  const thin = createSaveUrl(member(6), DEFAULT_SETTINGS, base, { objectExists: true });
  assert.ok(thin.startsWith("https://pay.google.com/gp/v/save/"));
  const claims = jwt.verify(thin.split("/save/")[1], publicKey, { algorithms: ["RS256"] }) as Record<string, any>;
  assert.equal(claims.iss, ENV.CLIENT_EMAIL);
  assert.equal(claims.aud, "google");
  assert.equal(claims.typ, "savetowallet");
  assert.deepEqual(claims.origins, [base]);
  assert.deepEqual(claims.payload.loyaltyObjects, [
    { id: objectId(googleWalletConfig()!, member(6).id), classId: "3388000000012345678.coffee_loyalty" },
  ]);
});

test("save link without an API object embeds the full object (fits in a URL)", () => {
  const url = createSaveUrl(member(6), DEFAULT_SETTINGS, base);
  assert.ok(url.length <= 1800, `URL too long: ${url.length}`);
  const claims = jwt.verify(url.split("/save/")[1], publicKey, { algorithms: ["RS256"] }) as Record<string, any>;
  const obj = claims.payload.loyaltyObjects[0];
  assert.equal(obj.loyaltyPoints.balance.string, "6/9");
  assert.equal(obj.barcode.value, `${base}/m/${member(6).id}`);
  assert.equal(obj.classId, "3388000000012345678.coffee_loyalty");
});

test("ensureClass inserts when missing, patches when present", async () => {
  const a = mockApi({ classExists: false });
  setWalletClientFactory(() => a.api);
  assert.equal(await ensureClass(DEFAULT_SETTINGS, base), "inserted");
  assert.deepEqual(a.calls.map((c) => c.op), ["class.get", "class.insert"]);
  assert.equal(await ensureClass(DEFAULT_SETTINGS, base), "cached");

  const b = mockApi({ classExists: true });
  setWalletClientFactory(() => b.api);
  assert.equal(await ensureClass(DEFAULT_SETTINGS, base, { force: true }), "patched");
  assert.deepEqual(b.calls.map((c) => c.op), ["class.get", "class.patch"]);
});

test("upsertObject: patch, or insert on 404", async () => {
  const a = mockApi({ objectExists: false });
  setWalletClientFactory(() => a.api);
  assert.equal(await upsertObject(member(3), DEFAULT_SETTINGS, base), "inserted");
  assert.deepEqual(a.calls.map((c) => c.op), ["object.patch", "object.insert"]);
  assert.equal(await upsertObject(member(4), DEFAULT_SETTINGS, base), "patched");
  const last = a.calls.at(-1)!;
  assert.equal((last.body as any).loyaltyPoints.balance.string, "4/9");
});

test("transient errors are retried once; client errors are not", async () => {
  const a = mockApi({ objectExists: true, fail: [503] });
  setWalletClientFactory(() => a.api);
  assert.equal(await upsertObject(member(1), DEFAULT_SETTINGS, base), "patched");
  assert.deepEqual(a.calls.map((c) => c.op), ["object.patch", "object.patch"]);

  const b = mockApi({ objectExists: true, fail: [403] });
  setWalletClientFactory(() => b.api);
  await assert.rejects(upsertObject(member(1), DEFAULT_SETTINGS, base), /HTTP 403/);
  assert.equal(b.calls.length, 1);
});

test("prepareSave never fails because of Google: falls back to an embedded JWT", async () => {
  const a = mockApi({ fail: [500, 500] }); // class.get fails twice (retry) → API path abandoned
  setWalletClientFactory(() => a.api);
  const r = await prepareSave(member(2), base);
  assert.equal(r.apiOk, false);
  assert.ok(r.url.startsWith("https://pay.google.com/gp/v/save/"));
  assert.equal(r.objectId, "3388000000012345678.member_6f1c1a52111142228333944455556666");

  const ok = mockApi();
  setWalletClientFactory(() => ok.api);
  const r2 = await prepareSave(member(2), base);
  assert.equal(r2.apiOk, true);
  assert.deepEqual(ok.calls.map((c) => c.op), ["class.get", "class.insert", "object.patch", "object.insert"]);
});

test("statusOf reads gaxios-style errors", () => {
  assert.equal(statusOf(httpError(404)), 404);
  assert.equal(statusOf({ code: 429 }), 429);
  assert.equal(statusOf({ code: "ECONNRESET" }), 0);
  assert.equal(statusOf(new Error("x")), 0);
});

import { test, before } from "node:test";
import assert from "node:assert/strict";

before(() => {
  process.env.APP_SECRET = "test-secret-123";
  process.env.MERCHANT_PIN = "1234";
});

test("card links: valid key accepted, others rejected", async () => {
  const { cardKey, verifyCardKey } = await import("../lib/linkSign");
  const k = await cardKey("3FA2C9B1");
  assert.match(k, /^[0-9a-f]{32}$/);
  assert.equal(await verifyCardKey("3FA2C9B1", k), true);
  assert.equal(await verifyCardKey("3FA2C9B2", k), false); // another card
  const tampered = k.slice(0, -1) + (k.endsWith("0") ? "1" : "0");
  assert.equal(await verifyCardKey("3FA2C9B1", tampered), false);
  assert.equal(await verifyCardKey("3FA2C9B1", null), false);
  assert.equal(await verifyCardKey("3FA2C9B1", ""), false);
});

test("merchant cookie is an HMAC, not the PIN", async () => {
  const { merchantSession, verifyMerchantSession } = await import("../lib/linkSign");
  const cookie = await merchantSession("1234");
  assert.notEqual(cookie, "1234");
  assert.ok(!cookie.includes("1234"));
  assert.equal(await verifyMerchantSession(cookie), true);
  assert.equal(await verifyMerchantSession("1234"), false); // the old raw-PIN cookie
  assert.equal(await verifyMerchantSession(undefined), false);
});

test("a different APP_SECRET invalidates links and sessions", async () => {
  const { cardKey, merchantSession, verifyCardKey, verifyMerchantSession } = await import("../lib/linkSign");
  const k = await cardKey("ABC");
  const c = await merchantSession("1234");
  process.env.APP_SECRET = "rotated";
  assert.equal(await verifyCardKey("ABC", k), false);
  assert.equal(await verifyMerchantSession(c), false);
  process.env.APP_SECRET = "test-secret-123";
});

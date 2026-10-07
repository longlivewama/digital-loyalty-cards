import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { buildPassJson, generatePkpass, isAppleWalletConfigured, missingAppleWalletEnv } from "../lib/pass";
import { DEFAULT_SETTINGS } from "../lib/settings";
import type { Member } from "../lib/supabase";

const base = "https://coffee.example.com";
const member = (points: number, extra: Partial<Member> = {}): Member => ({
  id: "6f1c1a52-1111-4222-8333-944455556666",
  serial: "3FA2C9B1",
  name: "Ahmed",
  last_name: "Fahim",
  points,
  total_earned: points,
  phone: null,
  created_at: "2026-10-01T10:00:00Z",
  auth_token: "secret-token-abc",
  ...extra,
});

before(() => {
  // No database in unit tests: settings fall back to the defaults.
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

test("configuration validation lists the missing Apple variables", () => {
  assert.deepEqual(missingAppleWalletEnv({}), ["PASS_TYPE_ID", "TEAM_ID", "PASS_WWDR", "PASS_SIGNER_CERT", "PASS_SIGNER_KEY"]);
  assert.equal(isAppleWalletConfigured({}), false);
});

test("pass content: English coffee card, same QR as Google, 6/9", () => {
  const p = buildPassJson(member(6), base, DEFAULT_SETTINGS);
  assert.equal(p.storeCard.headerFields[0].label, "STAMPS");
  assert.equal(p.storeCard.headerFields[0].value, "6/9");
  assert.equal(p.barcodes[0].message, `${base}/m/${member(6).id}`);
  assert.equal(p.barcodes[0].format, "PKBarcodeFormatQR");
  assert.equal(p.barcodes[0].altText, "Member 3FA2C9B1");
  assert.equal(p.webServiceURL, `${base}/api/wallet`);
  assert.equal(p.authenticationToken, "secret-token-abc");
  // The QR carries the member id only, never the card's secret token.
  assert.ok(!p.barcodes[0].message.includes("secret-token-abc"));
  // Customer-visible text only (field keys are internal identifiers).
  const fields = [...p.storeCard.headerFields, ...p.storeCard.secondaryFields, ...p.storeCard.auxiliaryFields, ...p.storeCard.backFields] as { label?: string; value?: string }[];
  const text = [p.description, p.logoText, ...fields.flatMap((f) => [f.label, f.value])].join("\n");
  assert.match(text, /3 more coffees until your free coffee/);
  assert.doesNotMatch(text, /pizza|Pizz|tampon|Plus que|Horaires/i);
});

test("pass at 9 stamps: full card + free coffee", () => {
  const p = buildPassJson(member(9), base, DEFAULT_SETTINGS);
  assert.equal(p.storeCard.headerFields[0].value, "9/9");
  assert.equal(p.backgroundColor, "rgb(28, 64, 36)");
  assert.equal(p.storeCard.secondaryFields[1].value, "Free coffee 🎉");
  assert.equal(p.storeCard.auxiliaryFields[0].value, "You've earned a free coffee! 🎉");
});

test("signs a real .pkpass with test certificates", async () => {
  // Fresh certificates in a temp folder (never touches the developer's certs/dev).
  const certsDir = fs.mkdtempSync(path.join(os.tmpdir(), "certs-"));
  const lines = execFileSync("bash", ["scripts/dev-certs.sh"], {
    encoding: "utf8",
    env: { ...process.env, CERTS_DIR: certsDir, PASS_TYPE_ID: "pass.com.example.coffee.test", TEAM_ID: "TESTTEAM01" },
  }).split("\n");
  for (const l of lines) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
  assert.equal(isAppleWalletConfigured(), true);

  const buf = await generatePkpass(member(6), base);
  assert.ok(buf.length > 1000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pkpass-"));
  const file = path.join(dir, "card.pkpass");
  fs.writeFileSync(file, buf);
  const entries = execFileSync("unzip", ["-Z1", file], { encoding: "utf8" }).split("\n").filter(Boolean);
  for (const f of ["pass.json", "manifest.json", "signature", "strip.png", "strip@2x.png", "icon.png", "logo.png"]) {
    assert.ok(entries.includes(f), `missing ${f}`);
  }

  // manifest.json holds the SHA-1 of every file, signature signs the manifest.
  const manifest = JSON.parse(execFileSync("unzip", ["-p", file, "manifest.json"], { encoding: "utf8" }));
  const passJson = execFileSync("unzip", ["-p", file, "pass.json"]);
  assert.equal(manifest["pass.json"], crypto.createHash("sha1").update(passJson).digest("hex"));
  const parsed = JSON.parse(passJson.toString());
  assert.equal(parsed.passTypeIdentifier, "pass.com.example.coffee.test");
  assert.equal(parsed.teamIdentifier, "TESTTEAM01");

  execFileSync("sh", ["-c", `cd "${dir}" && unzip -q card.pkpass manifest.json signature`]);
  const out = execFileSync(
    "openssl",
    ["smime", "-verify", "-binary", "-inform", "DER", "-in", path.join(dir, "signature"),
      "-content", path.join(dir, "manifest.json"), "-CAfile", path.join(certsDir, "wwdr.pem"), "-purpose", "any", "-out", "/dev/null"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  assert.equal(out, "");
});

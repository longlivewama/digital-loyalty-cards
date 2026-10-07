import { PKPass } from "passkit-generator";
import fs from "node:fs";
import path from "node:path";
import { cycle, displayStamps, rewardsAvailable, remaining } from "./loyalty";
import { stampStrips } from "./stampStrip";
import { getSettings, DEFAULT_SETTINGS, type Settings } from "./settings";
import type { Member } from "./supabase";

const MODEL_DIR = path.join(process.cwd(), "pass-model");
const IMAGE_FILES = [
  "icon.png", "icon@2x.png", "icon@3x.png",
  "logo.png", "logo@2x.png", "logo@3x.png",
  "strip.png", "strip@2x.png", "strip@3x.png",
];

// Load the model images once.
let imageBuffers: Record<string, Buffer> | null = null;
function loadImages(): Record<string, Buffer> {
  if (imageBuffers) return imageBuffers;
  const out: Record<string, Buffer> = {};
  for (const f of IMAGE_FILES) {
    const p = path.join(MODEL_DIR, f);
    if (fs.existsSync(p)) out[f] = fs.readFileSync(p);
  }
  imageBuffers = out;
  return out;
}

// The three PEMs are passed base64-encoded (one line each) in the environment.
const APPLE_ENV = ["PASS_TYPE_ID", "TEAM_ID", "PASS_WWDR", "PASS_SIGNER_CERT", "PASS_SIGNER_KEY"] as const;

export function missingAppleWalletEnv(env: Record<string, string | undefined> = process.env): string[] {
  return APPLE_ENV.filter((k) => !env[k]?.trim());
}

export function isAppleWalletConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return missingAppleWalletEnv(env).length === 0;
}

function b64(envName: string): Buffer {
  const v = process.env[envName];
  if (!v) throw new Error(`${envName} missing`);
  const buf = Buffer.from(v, "base64");
  if (!buf.toString("utf8").includes("-----BEGIN")) {
    throw new Error(`${envName} must be the base64 encoding of a PEM file`);
  }
  return buf;
}

// Targeted message (broadcast / review nudge) shown on the card, hidden after
// 30 days so an old "flash offer" does not stay on the card forever.
// Shared with the Google Wallet card.
export function activePushMsg(member: Pick<Member, "push_msg" | "push_msg_at">): string | null {
  const msg = member.push_msg?.trim();
  if (!msg || !member.push_msg_at) return null;
  const fresh = Date.now() - new Date(member.push_msg_at).getTime() < 30 * 24 * 3600 * 1000;
  return fresh ? msg : null;
}

// Optional shop location: the pass shows up on the lock screen near the shop.
function shopLocation(s: Settings) {
  const lat = parseFloat(process.env.SHOP_LATITUDE || "");
  const lng = parseFloat(process.env.SHOP_LONGITUDE || "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return [
    {
      latitude: lat,
      longitude: lng,
      relevantText: `☕ Welcome to ${s.resto_name}! Show your loyalty card.`,
    },
  ];
}

export function buildPassJson(member: Member, baseUrl: string, s: Settings) {
  const goal = s.goal || 9;
  const points = member.points;
  const rewards = rewardsAvailable(points, goal);
  const ready = rewards > 0;
  const left = remaining(points, goal);
  // Stamps shown: a full card (goal/goal) while a reward is waiting, else the cycle.
  const displayCount = displayStamps(points, goal);

  // Lock-screen notification on +1 (carried by the front "news" field whose
  // value changes): countdown, or reward reached.
  const notifMsg = ready
    ? "You've earned a free coffee! 🎉"
    : `${left} more coffee${left > 1 ? "s" : ""} until your free coffee ☕`;

  // ---- Targeted message (broadcast), per customer (member.push_msg) ----
  // IMPORTANT: lock-screen notifications only fire when the VALUE of a FRONT
  // field changes (back fields do not notify reliably). The trigger is therefore
  // the front "news" field, ALWAYS present (default value when empty) with
  // changeMessage "%@". The back shows the full text WITHOUT changeMessage
  // (no double notification).
  const msg = activePushMsg(member);
  const offerBack = msg ?? `Thank you for your loyalty at ${s.resto_name} ☕`;
  const newsFront = msg ?? notifMsg;

  // Back of the card: current offer → Google review → hours → address →
  // instagram → (phone) → loyalty program (at the bottom).
  const backFields: Record<string, unknown>[] = [
    {
      key: "offer",
      label: msg ? "🔥 Current offer" : "📣 From the team",
      value: offerBack,
    },
  ];

  // Permanent (tappable) Google review link, tracked through /r/[id] so the
  // nudges stop after a click. Only when a review URL is configured.
  if (s.review_url) {
    backFields.push({
      key: "avisGoogle",
      label: "Your opinion matters ⭐️",
      value: "Leave us a Google review 🙏",
      attributedValue: `<a href="${baseUrl}/r/${member.id}">⭐️ Leave a Google review</a>`,
    });
  }

  backFields.push(
    { key: "horaires", label: "Opening hours", value: s.hours },
    { key: "adresse", label: "Address", value: s.address },
    { key: "instagram", label: "Instagram", value: s.instagram }
  );
  if (s.phone) backFields.push({ key: "tel", label: "Phone", value: s.phone });
  backFields.push({
    key: "regle",
    label: "Loyalty program",
    value: `Every coffee you buy earns a stamp ☕\nCollect ${goal} stamps and your next coffee is free!`,
  });

  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.PASS_TYPE_ID || "pass.com.example.loyalty",
    teamIdentifier: process.env.TEAM_ID || "TEAMID1234",
    organizationName: s.resto_name,
    serialNumber: member.serial,
    description: `${s.resto_name} loyalty card`,
    logoText: s.resto_name,
    foregroundColor: "rgb(245, 236, 222)",
    backgroundColor: ready ? "rgb(28, 64, 36)" : "rgb(59, 36, 22)",
    labelColor: "rgb(214, 170, 120)",
    webServiceURL: `${baseUrl}/api/wallet`,
    // Per-card secret token; falls back to the legacy token (padded serial)
    // before migration. See lib/cardAuth.ts for the server-side soft rotation.
    authenticationToken: member.auth_token || member.serial.padEnd(16, "0"),
    ...(shopLocation(s) ? { maxDistance: 150, locations: shopLocation(s) } : {}),
    storeCard: {
      headerFields: [
        {
          key: "points",
          label: "STAMPS",
          value: `${displayCount}/${goal}`,
          // No changeMessage here: the notification is carried by "news" only
          // (otherwise Apple merges several messages into "Card updated").
        },
      ],
      // No primaryFields: the strip image carries the stamp grid.
      secondaryFields: [
        { key: "membre", label: "MEMBER", value: member.name },
        {
          key: "reste",
          label: "TO GO",
          value: ready ? "Free coffee 🎉" : `${left} coffee${left > 1 ? "s" : ""}`,
          textAlignment: "PKTextAlignmentRight",
        },
      ],
      auxiliaryFields: [
        {
          // Reliable notification trigger (broadcast + review): FRONT field, changeMessage.
          key: "news",
          label: "📣 News",
          value: newsFront,
          changeMessage: "%@",
        },
        {
          key: "depuis",
          label: "SINCE",
          value: new Date(member.created_at).getFullYear().toString(),
          textAlignment: "PKTextAlignmentRight",
        },
      ],
      backFields,
    },
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: `${baseUrl}/m/${member.id}`,
        messageEncoding: "iso-8859-1",
        altText: `Member ${member.serial}`,
      },
    ],
  };
}

export async function generatePkpass(member: Member, baseUrl: string): Promise<Buffer> {
  const missing = missingAppleWalletEnv();
  if (missing.length) throw new Error(`Apple Wallet is not configured (missing ${missing.join(", ")})`);

  const settings = await getSettings().catch(() => DEFAULT_SETTINGS);
  const buffers: Record<string, Buffer> = { ...loadImages() };

  // Stamp strip rendered for this customer (replaces the static strip).
  const goal = settings.goal || 9;
  const filled = rewardsAvailable(member.points, goal) > 0 ? goal : cycle(member.points, goal);
  Object.assign(buffers, await stampStrips(filled, goal));

  buffers["pass.json"] = Buffer.from(JSON.stringify(buildPassJson(member, baseUrl, settings)));

  const pass = new PKPass(buffers, {
    wwdr: b64("PASS_WWDR"),
    signerCert: b64("PASS_SIGNER_CERT"),
    signerKey: b64("PASS_SIGNER_KEY"),
  });

  return pass.getAsBuffer();
}

/*
 * Google Wallet loyalty card — server-only.
 *
 * Adapted from RaimundoDiaz/google-wallet-passes (loyaltyPass.js), itself based
 * on google-wallet/rest-samples: Copyright 2022 Google Inc., Apache License 2.0
 * (http://www.apache.org/licenses/LICENSE-2.0).
 *
 * The Supabase member row stays the single source of truth: the Google object
 * only renders members.points, exactly like the Apple pass, and carries the
 * same QR code (/m/[member.id]). Every write here happens AFTER the database
 * mutation and never throws into the caller, so a Google API failure can never
 * corrupt a stamp balance; the next successful sync re-renders the full state.
 */
import { walletobjects, auth as googleAuth, type walletobjects_v1 } from "@googleapis/walletobjects";
import jwt from "jsonwebtoken";
import { supabaseAdmin, type Member } from "./supabase";
import { getSettings, DEFAULT_SETTINGS, type Settings } from "./settings";
import { displayStamps, rewardsAvailable, remaining } from "./loyalty";
import { activePushMsg } from "./pass";

export type LoyaltyClass = walletobjects_v1.Schema$LoyaltyClass;
export type LoyaltyObject = walletobjects_v1.Schema$LoyaltyObject;

const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const SAVE_URL = "https://pay.google.com/gp/v/save/";
// Google recommends pre-created objects once a "fat" JWT URL grows past ~1800
// characters (some browsers truncate long URLs).
const MAX_FAT_URL = 1800;
const log = (...a: unknown[]) => console.log("[GOOGLE-WALLET]", ...a);

// ---- Configuration ---------------------------------------------------------

export type ServiceAccount = {
  type: string;
  project_id?: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
  universe_domain?: string;
};

export type GoogleWalletConfig = {
  issuerId: string;
  classSuffix: string;
  logoUrl: string | null;
  credentials: ServiceAccount;
};

type Env = Record<string, string | undefined>;
const REQUIRED = ["WALLET_ISSUER_ID", "CLIENT_EMAIL", "PRIVATE_KEY"] as const;

// Env names follow the service-account JSON (same names as google-wallet-passes).
export function missingGoogleWalletEnv(env: Env = process.env): string[] {
  return REQUIRED.filter((k) => !env[k]?.trim());
}

// Accepts the key with literal "\n" (one-line .env value) or real newlines.
function normalizeKey(raw: string): string {
  return raw.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

export function googleWalletConfig(env: Env = process.env): GoogleWalletConfig | null {
  if (missingGoogleWalletEnv(env).length) return null;
  const classSuffix = (env.GOOGLE_WALLET_CLASS_SUFFIX || "coffee_loyalty").trim();
  if (!/^[\w.-]+$/.test(classSuffix)) {
    log("invalid GOOGLE_WALLET_CLASS_SUFFIX (letters, digits, '.', '_' and '-' only)");
    return null;
  }
  return {
    issuerId: env.WALLET_ISSUER_ID!.trim(),
    classSuffix,
    logoUrl: env.GOOGLE_WALLET_LOGO_URL?.trim() || null,
    credentials: {
      type: env.TYPE || "service_account",
      project_id: env.PROJECT_ID,
      private_key_id: env.PRIVATE_KEY_ID,
      private_key: normalizeKey(env.PRIVATE_KEY!),
      client_email: env.CLIENT_EMAIL!.trim(),
      client_id: env.CLIENT_ID,
      auth_uri: env.AUTH_URI,
      token_uri: env.TOKEN_URI,
      auth_provider_x509_cert_url: env.AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: env.CLIENT_X509_CERT_URL,
      universe_domain: env.UNIVERSE_DOMAIN,
    },
  };
}

export function isGoogleWalletConfigured(env: Env = process.env): boolean {
  return googleWalletConfig(env) !== null;
}

export function classId(cfg: GoogleWalletConfig): string {
  return `${cfg.issuerId}.${cfg.classSuffix}`;
}

// One object per member, derived from the member UUID (stable, collision-free).
export function objectId(cfg: GoogleWalletConfig, memberId: string): string {
  return `${cfg.issuerId}.member_${memberId.replace(/-/g, "")}`;
}

// ---- API client (injectable so tests can mock the API boundary) -----------

type Res = { resourceId: string };
type Body<T> = { requestBody: T };
type PatchBody<T> = Res & Body<T>;
export interface WalletClient {
  loyaltyclass: {
    get(p: Res): Promise<unknown>;
    insert(p: Body<LoyaltyClass>): Promise<unknown>;
    patch(p: PatchBody<LoyaltyClass>): Promise<unknown>;
  };
  loyaltyobject: {
    get(p: Res): Promise<unknown>;
    insert(p: Body<LoyaltyObject>): Promise<unknown>;
    patch(p: PatchBody<LoyaltyObject>): Promise<unknown>;
  };
}

function defaultClient(cfg: GoogleWalletConfig): WalletClient {
  const auth = new googleAuth.GoogleAuth({ credentials: cfg.credentials, scopes: [SCOPE] });
  return walletobjects({ version: "v1", auth }) as unknown as WalletClient;
}

let clientFactory: (cfg: GoogleWalletConfig) => WalletClient = defaultClient;
let cachedClient: { key: string; client: WalletClient } | null = null;

// Test hook: swap the API client (pass null to restore the real one).
export function setWalletClientFactory(f: ((cfg: GoogleWalletConfig) => WalletClient) | null) {
  clientFactory = f ?? defaultClient;
  cachedClient = null;
  classReady = null;
}

function client(cfg: GoogleWalletConfig): WalletClient {
  const key = `${cfg.issuerId}:${cfg.credentials.client_email}`;
  if (cachedClient?.key !== key) cachedClient = { key, client: clientFactory(cfg) };
  return cachedClient.client;
}

// HTTP status of a googleapis (gaxios) error, or 0 for network/auth errors.
export function statusOf(err: unknown): number {
  const e = err as { response?: { status?: number }; status?: number; code?: unknown };
  const s = e?.response?.status ?? e?.status ?? (typeof e?.code === "number" ? e.code : Number(e?.code));
  return Number.isFinite(s) ? Number(s) : 0;
}

function describe(err: unknown): string {
  const e = err as { message?: string };
  return `status=${statusOf(err)} ${e?.message ?? String(err)}`.slice(0, 300);
}

// One retry for transient failures (rate limit, 5xx, network).
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const s = statusOf(err);
    if (s !== 0 && s !== 429 && s < 500) throw err;
    await new Promise((r) => setTimeout(r, 400));
    return fn();
  }
}

// ---- Builders (pure) -------------------------------------------------------

function logoUri(cfg: GoogleWalletConfig, base: string): string {
  return cfg.logoUrl || `${base}/logo.png`;
}

export function buildLoyaltyClass(cfg: GoogleWalletConfig, s: Settings, base: string): LoyaltyClass {
  const goal = s.goal || 9;
  const modules: walletobjects_v1.Schema$TextModuleData[] = [
    {
      id: "rules",
      header: "How it works",
      body: `Collect a stamp with every coffee. Buy ${goal} coffees and your next coffee is free!`,
    },
  ];
  if (s.hours) modules.push({ id: "hours", header: "Opening hours", body: s.hours });
  if (s.address) modules.push({ id: "address", header: "Address", body: s.address });
  if (s.phone) modules.push({ id: "phone", header: "Phone", body: s.phone });

  return {
    id: classId(cfg),
    issuerName: s.resto_name,
    programName: `${s.resto_name} Loyalty Card`,
    programLogo: {
      sourceUri: { uri: logoUri(cfg, base) },
      contentDescription: { defaultValue: { language: "en-US", value: `${s.resto_name} logo` } },
    },
    hexBackgroundColor: "#3b2416",
    // Same as the reference: classes are created/updated as UNDER_REVIEW.
    reviewStatus: "UNDER_REVIEW",
    multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
    textModulesData: modules,
    linksModuleData: s.instagram
      ? { uris: [{ id: "instagram", uri: s.instagram, description: "Instagram" }] }
      : undefined,
  };
}

export function buildLoyaltyObject(
  cfg: GoogleWalletConfig,
  member: Member,
  s: Settings,
  base: string
): LoyaltyObject {
  const goal = s.goal || 9;
  const points = member.points ?? 0;
  const rewards = rewardsAvailable(points, goal);
  const ready = rewards > 0;
  const left = remaining(points, goal);
  const fullName = [member.name, member.last_name].filter(Boolean).join(" ") || member.name;

  const modules: walletobjects_v1.Schema$TextModuleData[] = [
    ready
      ? {
          id: "progress",
          header: "Free coffee available! 🎉",
          body: "Show this card at the counter to redeem your free coffee.",
        }
      : {
          id: "progress",
          header: "Your Progress",
          body: `${left} more coffee${left > 1 ? "s" : ""} until your free coffee ☕`,
        },
  ];
  const news = activePushMsg(member);
  if (news) modules.push({ id: "news", header: "News", body: news });

  return {
    id: objectId(cfg, member.id),
    classId: classId(cfg),
    state: "ACTIVE",
    accountId: member.serial,
    accountName: fullName,
    loyaltyPoints: {
      label: "Stamps",
      balance: { string: `${displayStamps(points, goal)}/${goal}` },
    },
    secondaryLoyaltyPoints: {
      label: "Free coffees",
      balance: { int: rewards },
    },
    // Same QR as the Apple pass: the staff scan lands on /m/[id] (PIN-protected).
    barcode: {
      type: "QR_CODE",
      value: `${base}/m/${member.id}`,
      alternateText: `Member ${member.serial}`,
    },
    textModulesData: modules,
  };
}

// ---- API operations --------------------------------------------------------

// Remembers that the class exists in this process (stamp syncs skip the check).
let classReady: string | null = null;

// get → insert if missing, otherwise patch so settings changes propagate.
export async function ensureClass(
  s: Settings,
  base: string,
  opts: { force?: boolean } = {}
): Promise<"inserted" | "patched" | "cached"> {
  const cfg = googleWalletConfig();
  if (!cfg) throw new Error("Google Wallet is not configured");
  const id = classId(cfg);
  if (!opts.force && classReady === id) return "cached";
  const api = client(cfg);
  const body = buildLoyaltyClass(cfg, s, base);

  let exists = true;
  try {
    await withRetry(() => api.loyaltyclass.get({ resourceId: id }));
  } catch (err) {
    if (statusOf(err) !== 404) throw err;
    exists = false;
  }
  if (exists) await withRetry(() => api.loyaltyclass.patch({ resourceId: id, requestBody: body }));
  else await withRetry(() => api.loyaltyclass.insert({ requestBody: body }));
  classReady = id;
  return exists ? "patched" : "inserted";
}

// Writes the member's current state: insert if missing, patch otherwise.
export async function upsertObject(
  member: Member,
  s: Settings,
  base: string
): Promise<"inserted" | "patched"> {
  const cfg = googleWalletConfig();
  if (!cfg) throw new Error("Google Wallet is not configured");
  const api = client(cfg);
  const body = buildLoyaltyObject(cfg, member, s, base);
  try {
    await withRetry(() => api.loyaltyobject.patch({ resourceId: body.id!, requestBody: body }));
    return "patched";
  } catch (err) {
    if (statusOf(err) !== 404) throw err;
  }
  await withRetry(() => api.loyaltyobject.insert({ requestBody: body }));
  return "inserted";
}

// "Add to Google Wallet" link. When the object already exists through the API
// the JWT only references it (as in the reference createJwtExistingObject);
// otherwise it embeds the class and the full object so Google creates them on
// save — the card is always saveable even if the API calls failed.
export function createSaveUrl(
  member: Member,
  s: Settings,
  base: string,
  opts: { objectExists?: boolean } = {}
): string {
  const cfg = googleWalletConfig();
  if (!cfg) throw new Error("Google Wallet is not configured");
  const sign = (payload: Record<string, unknown>) =>
    SAVE_URL +
    jwt.sign(
      { iss: cfg.credentials.client_email, aud: "google", typ: "savetowallet", origins: [base], payload },
      cfg.credentials.private_key,
      { algorithm: "RS256" }
    );

  const thin = () => sign({ loyaltyObjects: [{ id: objectId(cfg, member.id), classId: classId(cfg) }] });
  if (opts.objectExists) return thin();
  const object = buildLoyaltyObject(cfg, member, s, base);
  // Largest payload that fits: class + object, then the object alone (the
  // class usually exists already), then a plain reference.
  const withClass = sign({ loyaltyClasses: [buildLoyaltyClass(cfg, s, base)], loyaltyObjects: [object] });
  if (withClass.length <= MAX_FAT_URL) return withClass;
  const objectOnly = sign({ loyaltyObjects: [object] });
  return objectOnly.length <= MAX_FAT_URL ? objectOnly : thin();
}

export type PrepareResult = { url: string; objectId: string; apiOk: boolean };

// Used by /api/google-pass: best-effort class + object upsert, then a fresh
// save link. API failures are logged and fall back to the embedded JWT.
export async function prepareSave(member: Member, base: string): Promise<PrepareResult> {
  const cfg = googleWalletConfig();
  if (!cfg) throw new Error("Google Wallet is not configured");
  const s = await getSettings().catch(() => DEFAULT_SETTINGS);
  let apiOk = false;
  try {
    await ensureClass(s, base);
    await upsertObject(member, s, base);
    apiOk = true;
  } catch (err) {
    log(`prepare ${member.serial} failed, using embedded JWT:`, describe(err));
  }
  return {
    url: createSaveUrl(member, s, base, { objectExists: apiOk }),
    objectId: objectId(cfg, member.id),
    apiOk,
  };
}

export type SyncResult = "skipped" | "not_configured" | "patched" | "not_saved" | "failed";

// Re-renders the member's Google card from the database (state, not delta:
// a missed update is healed by the next successful one). Never throws.
export async function syncMember(id: string, base: string): Promise<SyncResult> {
  const cfg = googleWalletConfig();
  if (!cfg) return "not_configured";
  try {
    const db = supabaseAdmin();
    const { data: member } = await db.from("members").select("*").eq("id", id).single();
    // No Google card requested for this member yet: nothing to update.
    if (!member?.google_object_id) return "skipped";
    const s = await getSettings().catch(() => DEFAULT_SETTINGS);
    const body = buildLoyaltyObject(cfg, member as Member, s, base);
    try {
      await withRetry(() =>
        client(cfg).loyaltyobject.patch({ resourceId: body.id!, requestBody: body })
      );
      return "patched";
    } catch (err) {
      // Object not created yet (the save link will create it with fresh state).
      if (statusOf(err) === 404) return "not_saved";
      throw err;
    }
  } catch (err) {
    log(`sync ${id} failed:`, describe(err));
    return "failed";
  }
}

// After a settings change (shop name, hours, address…): re-patch the class so
// every Google card shows the new details. Never throws.
export async function refreshClass(base: string): Promise<boolean> {
  if (!isGoogleWalletConfigured()) return false;
  try {
    await ensureClass(await getSettings(), base, { force: true });
    return true;
  } catch (err) {
    log("class refresh failed:", describe(err));
    return false;
  }
}

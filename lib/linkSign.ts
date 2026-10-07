// HMAC helpers shared by the middleware (Edge runtime) and API routes (Node):
// Web Crypto only, so the same code runs in both.
//
// - Customer links (/added, pass download, Google save link, status) carry
//   `?k=<hmac(serial)>`, so knowing a card serial (printed on the card, in the
//   dashboard and the CSV export) is not enough to download someone's pass and
//   its Wallet authentication token.
// - The merchant cookie holds an HMAC of the PIN instead of the PIN itself.

// APP_SECRET is the dedicated secret; the Supabase service key is a server-only
// fallback so an existing deployment keeps working until APP_SECRET is set.
function appSecret(): string {
  const s = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("APP_SECRET is not set");
  return s;
}

const enc = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time comparison of two strings.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- Customer links --------------------------------------------------------

export async function cardKey(serial: string): Promise<string> {
  return (await hmacHex(appSecret(), `card:${serial}`)).slice(0, 32);
}

export async function verifyCardKey(serial: string, key: string | null | undefined): Promise<boolean> {
  if (!key) return false;
  return safeEqual(await cardKey(serial), key);
}

// ---- Merchant session cookie ----------------------------------------------

export async function merchantSession(pin: string): Promise<string> {
  return hmacHex(appSecret(), `merchant:${pin}`);
}

export async function verifyMerchantSession(cookie: string | null | undefined): Promise<boolean> {
  const pin = process.env.MERCHANT_PIN;
  if (!pin || !cookie) return false;
  return safeEqual(await merchantSession(pin), cookie);
}

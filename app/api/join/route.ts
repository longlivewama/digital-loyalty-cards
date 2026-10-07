import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { cardKey } from "@/lib/linkSign";

export const runtime = "nodejs";

// Signup: creates the member (the single customer record behind both the Apple
// and the Google card), then redirects to the page offering both wallets.
//
// Inputs are validated here too: the browser's `required`/`maxLength` can be
// bypassed by posting directly to this route.
const MAX_NAME = 40;
const MAX_PHONE = 20;

function field(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// "YYYY-MM-DD", a real calendar date between 1900 and today.
function validBirthday(v: string): boolean {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return (
    d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] &&
    +m[1] >= 1900 && d.getTime() <= Date.now()
  );
}

// Back to the form with a message (the form is a plain HTML post).
function invalid(req: NextRequest, error: string) {
  return NextResponse.redirect(new URL(`/join?error=${error}`, req.url), 303);
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }
  const name = field(form, "name");
  const lastName = field(form, "last_name");
  const birthday = field(form, "birthday") || null; // optional, "YYYY-MM-DD"
  const phone = field(form, "phone") || null; // optional

  if (!name || !lastName) return invalid(req, "name");
  if (name.length > MAX_NAME || lastName.length > MAX_NAME) return invalid(req, "name");
  if (birthday && !validBirthday(birthday)) return invalid(req, "birthday");
  if (phone && (phone.length > MAX_PHONE || !/^\+?[0-9 ().-]{4,}$/.test(phone))) return invalid(req, "phone");

  const serial = crypto.randomUUID().split("-")[0].toUpperCase(); // e.g. 3FA2C9B1
  const authToken = crypto.randomUUID(); // the card's secret token (not guessable)

  const db = supabaseAdmin();
  const base = { name, serial, points: 0, total_earned: 0, phone };

  // Full insert (last name + birthday + secret token).
  // token_rotated=true: the card is born with its secret token, so the legacy
  // token (padded serial) never has to be accepted for it.
  let { data, error } = await db
    .from("members")
    .insert({ ...base, last_name: lastName, birthday, auth_token: authToken, token_rotated: true })
    .select()
    .single();
  // Fallback ONLY when optional columns are missing (migrations not run,
  // PostgREST PGRST204). Any other error must not create a card without its
  // secret token.
  if (error?.code === "PGRST204") {
    ({ data, error } = await db.from("members").insert(base).select().single());
  }

  if (error || !data) {
    console.error("[JOIN] insert failed", error?.message);
    return NextResponse.json(
      { error: "Sorry, we couldn't create your loyalty card. Please try again." },
      { status: 500 }
    );
  }

  await logEvent(data.id, "signup", 0);

  // 303 → wallet choice page. The signed key (k) is what lets this browser
  // download the pass; the serial alone is not enough.
  const k = await cardKey(data.serial);
  return NextResponse.redirect(new URL(`/added/${data.serial}?k=${k}`, req.url), 303);
}

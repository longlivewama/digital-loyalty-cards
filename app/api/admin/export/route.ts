import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// Customer-controlled values are neutralised against spreadsheet formula
// injection (=, +, -, @, tab, CR at the start → prefixed with a quote).
function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV export of the customer base.
export async function GET() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("members")
    .select("name,last_name,birthday,phone,serial,points,total_earned,registered_at,google_object_id,created_at")
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const header = ["First name", "Last name", "Birthday", "Phone", "Serial", "Stamps", "Total coffees", "Apple Wallet", "Google Wallet", "Signed up"];
  const lines = [header.join(",")];
  for (const m of rows) {
    lines.push(
      [
        csvCell(m.name),
        csvCell(m.last_name),
        csvCell(m.birthday?.slice(0, 10)),
        csvCell(m.phone),
        csvCell(m.serial),
        csvCell(m.points),
        csvCell(m.total_earned),
        csvCell(m.registered_at ? "yes" : "no"),
        csvCell(m.google_object_id ? "yes" : "no"),
        csvCell(m.created_at?.slice(0, 10)),
      ].join(",")
    );
  }
  const csv = "﻿" + lines.join("\n"); // BOM for Excel

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="coffee-loyalty-customers.csv"`,
    },
  });
}

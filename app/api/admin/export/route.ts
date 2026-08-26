import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Export CSV de la base clients (argument clé : récupérer sa base vs plateformes).
export async function GET() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("members")
    .select("name,last_name,birthday,phone,serial,points,total_earned,registered_at,created_at")
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const header = ["Prénom", "Nom", "Date de naissance", "Téléphone", "Serial", "Points", "Total pizzas", "Carte active", "Inscription"];
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
        csvCell(m.registered_at ? "oui" : "non"),
        csvCell(m.created_at?.slice(0, 10)),
      ].join(",")
    );
  }
  const csv = "﻿" + lines.join("\n"); // BOM pour Excel

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-esempio.csv"`,
    },
  });
}

import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import AddedClient from "./AddedClient";

export const dynamic = "force-dynamic";

// Écran de confirmation : déclenche le téléchargement puis attend (poll) que
// la carte soit réellement ajoutée au Wallet avant d'afficher la validation.
export default async function Added({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const db = supabaseAdmin();
  const { data: member } = await db.from("members").select("name").eq("serial", serial).single();
  if (!member) notFound();

  return <AddedClient serial={serial} name={member.name} passUrl={`/api/pass/${serial}`} />;
}

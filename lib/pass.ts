import { PKPass } from "passkit-generator";
import fs from "node:fs";
import path from "node:path";
import { cycle, rewardsAvailable, remaining } from "./loyalty";
import { stampStrips } from "./stampStrip";
import { getSettings, DEFAULT_SETTINGS, type Settings } from "./settings";
import type { Member } from "./supabase";

const MODEL_DIR = path.join(process.cwd(), "pass-model");
const IMAGE_FILES = [
  "icon.png", "icon@2x.png", "icon@3x.png",
  "logo.png", "logo@2x.png", "logo@3x.png",
  "strip.png", "strip@2x.png", "strip@3x.png",
];

// charge les images du modèle une seule fois
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

function b64(envName: string): Buffer {
  const v = process.env[envName];
  if (!v) throw new Error(`${envName} manquant`);
  return Buffer.from(v, "base64");
}

function buildPassJson(member: Member, baseUrl: string, s: Settings) {
  const goal = s.goal || 10;
  const points = member.points;
  const rewards = rewardsAvailable(points, goal);
  const ready = rewards > 0;
  const reste = remaining(points, goal);
  // Tampons affichés : si une récompense est dispo (cycle complet non réclamé),
  // on montre la carte pleine (goal/goal) plutôt que 0 ; sinon le cycle en cours.
  const displayCount = ready ? goal : cycle(points, goal);

  // Message de la notif lock-screen au +1 (porté par le champ avant "points"
  // qui change de valeur). Dynamique : compte à rebours ou récompense atteinte.
  const notifMsg = ready
    ? "Vous avez une pizza gratuite ! 🎉"
    : `Plus que ${reste} pizza${reste > 1 ? "s" : ""} avant la pizza gratuite 🍕`;

  // ---- Message ciblé (broadcast), par client (member.push_msg) ----
  // IMPORTANT : la notif lock-screen ne se déclenche que sur changement de
  // VALEUR d'un champ de la FACE AVANT (les champs au dos ne notifient pas de
  // façon fiable). On porte donc le déclencheur sur un champ avant "news",
  // TOUJOURS présent (valeur défaut quand vide) avec changeMessage "%@".
  // Le dos affiche le texte complet, SANS changeMessage (pas de double notif).
  // Le message ciblé (offre / relance avis) expire après 30 jours : sans ça un
  // "Offre flash ce soir" resterait collé sur la carte indéfiniment.
  const msg = member.push_msg?.trim();
  const msgFresh = member.push_msg_at
    ? Date.now() - new Date(member.push_msg_at).getTime() < 30 * 24 * 3600 * 1000
    : false;
  const hasMsg = !!msg && msg.length > 0 && msgFresh;
  const offerBack = hasMsg ? msg! : `Merci de votre fidélité chez ${s.resto_name} 🍕`;

  // Valeur du champ avant "news" qui PORTE la notif (changeMessage "%@", fiable).
  // Par défaut (pas d'offre en cours) : compte à rebours dynamique -> la notif
  // du +1 affiche "Plus que X pizzas avant la pizza gratuite". Une offre broadcast
  // prend le dessus quand elle est active.
  const newsFront = hasMsg ? msg! : notifMsg;

  // Dos de la carte — ordre voulu :
  // offre du moment → avis Google → horaires → adresse → instagram → (tél)
  // → programme de fidélité (tout en bas). L'offre n'a PAS de changeMessage
  // (la notif est portée par le champ avant "news", pas de double notif).
  const backFields: Record<string, unknown>[] = [
    {
      key: "offer",
      label: hasMsg ? "🔥 Offre du moment" : "📣 Le mot de la maison",
      value: offerBack,
    },
  ];

  // Lien d'avis Google permanent (tappable). Passe par /r/[id] pour détecter
  // le clic → on arrête les relances. Présent seulement si un lien est réglé.
  if (s.review_url) {
    backFields.push({
      key: "avisGoogle",
      label: "Votre avis compte ⭐️",
      value: "Laissez-nous un avis Google 🙏",
      attributedValue: `<a href="${baseUrl}/r/${member.id}">⭐️ Laisser un avis Google</a>`,
    });
  }

  backFields.push(
    { key: "horaires", label: "Horaires", value: s.hours },
    { key: "adresse", label: "Adresse", value: s.address },
    { key: "instagram", label: "Instagram", value: s.instagram }
  );
  if (s.phone) backFields.push({ key: "tel", label: "Téléphone", value: s.phone });
  backFields.push({
    key: "regle",
    label: "Programme de fidélité",
    value: `À chaque pizza achetée, votre carte est tamponnée 🍕\nUne fois ${goal} tampons réunis, votre prochaine pizza est offerte !`,
  });

  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.PASS_TYPE_ID || "pass.com.example.loyalty",
    teamIdentifier: process.env.TEAM_ID || "TEAMID1234",
    organizationName: s.resto_name,
    serialNumber: member.serial,
    description: `Carte de fidélité ${s.resto_name}`,
    logoText: s.resto_name,
    foregroundColor: "rgb(243, 233, 216)",
    backgroundColor: ready ? "rgb(28, 64, 36)" : "rgb(40, 28, 20)",
    labelColor: "rgb(201, 154, 104)",
    webServiceURL: `${baseUrl}/api/wallet`,
    // Jeton secret par carte ; repli sur l'ancien (serial padé) si pas encore
    // migré. Voir lib/cardAuth.ts pour la rotation douce côté serveur.
    authenticationToken: member.auth_token || member.serial.padEnd(16, "0"),
    maxDistance: 150,
    locations: [
      {
        latitude: 44.8666,
        longitude: -0.6047,
        relevantText: `🍕 Bienvenue chez ${s.resto_name} ! Présentez votre carte.`,
      },
    ],
    storeCard: {
      headerFields: [
        {
          key: "points",
          label: "TAMPONS",
          value: `${displayCount}/${goal}`,
          // Pas de changeMessage ici : la notif est portée par le seul champ
          // "news" (sinon Apple regroupe plusieurs messages en "Carte modifiée").
        },
      ],
      // Pas de primaryFields : la bande image (strip) porte la grille de tampons.
      secondaryFields: [
        { key: "membre", label: "CLIENT", value: member.name },
        {
          key: "reste",
          label: "RESTANT",
          value: ready ? "Au comptoir 🎉" : `${reste} pizza${reste > 1 ? "s" : ""}`,
          textAlignment: "PKTextAlignmentRight",
        },
      ],
      auxiliaryFields: [
        {
          // Déclencheur notif fiable (broadcast + avis) : champ AVANT, changeMessage.
          key: "news",
          label: "📣 À la une",
          value: newsFront,
          changeMessage: "%@",
        },
        {
          key: "depuis",
          label: "DEPUIS",
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
        altText: `Membre ${member.serial}`,
      },
    ],
  };
}

export async function generatePkpass(member: Member, baseUrl: string): Promise<Buffer> {
  const settings = await getSettings().catch(() => DEFAULT_SETTINGS);
  const buffers: Record<string, Buffer> = { ...loadImages() };

  // Bande "tampons" générée selon l'état du client (remplace le strip statique).
  // Récompense dispo → carte pleine (goal) ; sinon le cycle en cours.
  const goal = settings.goal || 10;
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

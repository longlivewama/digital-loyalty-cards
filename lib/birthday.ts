// Helpers date de naissance. `birthday` arrive de Supabase au format "YYYY-MM-DD"
// (colonne `date`, voir MIGRATION-PROFILE.sql) ou null si le client ne l'a pas saisie.

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// Parse robuste : on lit l'année/mois/jour à la main pour éviter les décalages
// de fuseau horaire (new Date("YYYY-MM-DD") est interprété en UTC).
function parts(birthday?: string | null): { y: number; m: number; d: number } | null {
  if (!birthday) return null;
  const match = birthday.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = +match[1], m = +match[2], d = +match[3];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

// Âge en années révolues, ou null si pas de date.
export function age(birthday?: string | null, now: Date = new Date()): number | null {
  const p = parts(birthday);
  if (!p) return null;
  let a = now.getFullYear() - p.y;
  const beforeBday = now.getMonth() + 1 < p.m || (now.getMonth() + 1 === p.m && now.getDate() < p.d);
  if (beforeBday) a -= 1;
  return a >= 0 && a < 130 ? a : null;
}

// L'anniversaire tombe-t-il ce mois-ci ? (sert au badge 🎂 + au filtre/onglet)
export function isBirthdayThisMonth(birthday?: string | null, now: Date = new Date()): boolean {
  const p = parts(birthday);
  return !!p && p.m === now.getMonth() + 1;
}

// Jour du mois (1..31) pour trier les anniversaires du mois ; +Infinity si pas de date.
export function birthdayDay(birthday?: string | null): number {
  const p = parts(birthday);
  return p ? p.d : Number.POSITIVE_INFINITY;
}

// "12 mars 1990" (ou "12 mars" si année absente) ; "" si pas de date.
export function formatBirthday(birthday?: string | null): string {
  const p = parts(birthday);
  if (!p) return "";
  return `${p.d} ${MOIS[p.m - 1]}${p.y ? ` ${p.y}` : ""}`;
}

// "12 mars" (jour + mois, sans année) — pour les listes d'anniversaires.
export function formatDayMonth(birthday?: string | null): string {
  const p = parts(birthday);
  if (!p) return "";
  return `${p.d} ${MOIS[p.m - 1]}`;
}

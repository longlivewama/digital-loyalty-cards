import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

// Génère la bande "tampons" de la carte Wallet : une grille de ronds.
// Vide = rond contour (centre transparent). Plein = l'emoji pizza 🍕 d'Apple
// (pass-model/pizza.png) dans le rond. Fond transparent → la couleur de la carte
// (marron, ou vert quand récompense) passe derrière.
// Dimensions du strip Apple (storeCard) : 375×144 @1x, ×2, ×3.

const BASE_W = 375;
const BASE_H = 144;

// L'emoji pizza Apple, chargé une fois en data-URI (pour l'embarquer dans le SVG).
let pizzaHref: string | null | undefined;
function pizzaImage(): string | null {
  if (pizzaHref !== undefined) return pizzaHref;
  try {
    const p = path.join(process.cwd(), "pass-model", "pizza.png");
    pizzaHref = "data:image/png;base64," + fs.readFileSync(p).toString("base64");
  } catch {
    pizzaHref = null;
  }
  return pizzaHref;
}

// Dessin de secours si l'asset emoji est absent (pizza SVG simple).
function drawnPizza(cx: number, cy: number, r: number): string {
  const pr = r * 0.15;
  const ring = r * 0.42;
  const peps = [0, 1, 2, 3, 4]
    .map((i) => {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      return `<circle cx="${(cx + Math.cos(a) * ring).toFixed(1)}" cy="${(cy + Math.sin(a) * ring).toFixed(1)}" r="${pr.toFixed(1)}" fill="#b5341f"/>`;
    })
    .join("");
  return (
    `<circle cx="${cx}" cy="${cy}" r="${(r * 0.86).toFixed(1)}" fill="#d99a52"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${(r * 0.7).toFixed(1)}" fill="#f3c869"/>` +
    peps
  );
}

function ring(cx: number, cy: number, r: number): string {
  // léger disque sombre translucide → le slot vide reste lisible par-dessus la photo
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(15,10,7,0.45)" stroke="#f3e9d8" stroke-width="2.5"/>`;
}

function buildSvg(filled: number, goal: number, scale: number, scrim = false): string {
  const rows = Math.max(1, Math.ceil(goal / 5));
  const cols = Math.ceil(goal / rows);
  const padX = 22;
  const padY = 16;
  const gapX = 12;
  const gapY = 14;
  const cellW = (BASE_W - padX * 2 - gapX * (cols - 1)) / cols;
  const cellH = (BASE_H - padY * 2 - gapY * (rows - 1)) / rows;
  const r = Math.min(cellW, cellH) / 2;
  const href = pizzaImage();
  const imgSize = r * 1.78;

  const parts: string[] = [];
  // voile sombre par-dessus la photo de fond pour garder les ronds lisibles
  if (scrim) parts.push(`<rect x="0" y="0" width="${BASE_W}" height="${BASE_H}" fill="rgba(26,17,11,0.42)"/>`);
  for (let i = 0; i < goal; i++) {
    const row = Math.floor(i / cols);
    const colCount = Math.min(cols, goal - row * cols);
    const col = i - row * cols;
    const rowW = colCount * cellW + (colCount - 1) * gapX;
    const startX = (BASE_W - rowW) / 2;
    const cx = startX + col * (cellW + gapX) + cellW / 2;
    const cy = padY + row * (cellH + gapY) + cellH / 2;

    parts.push(ring(cx, cy, r)); // le slot (rond) est toujours visible
    if (i < filled) {
      parts.push(
        href
          ? `<image xlink:href="${href}" x="${(cx - imgSize / 2).toFixed(1)}" y="${(cy - imgSize / 2).toFixed(1)}" width="${imgSize.toFixed(1)}" height="${imgSize.toFixed(1)}" preserveAspectRatio="xMidYMid meet"/>`
          : drawnPizza(cx, cy, r)
      );
    }
  }

  const w = Math.round(BASE_W * scale);
  const h = Math.round(BASE_H * scale);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${BASE_W} ${BASE_H}">${parts.join("")}</svg>`;
}

// Compose une résolution : grille (+ voile) PAR-DESSUS la photo de fond (l'ancien
// strip, ex. la pizza napolitaine). Si la photo manque → fond transparent.
async function composeOne(name: string, scale: number, filled: number, goal: number): Promise<Buffer> {
  const w = BASE_W * scale;
  const h = BASE_H * scale;
  try {
    const photo = path.join(process.cwd(), "pass-model", name);
    const grid = Buffer.from(buildSvg(filled, goal, scale, true)); // voile activé (photo derrière)
    return await sharp(photo)
      .resize(w, h, { fit: "cover" })
      .composite([{ input: grid, top: 0, left: 0 }])
      .png()
      .toBuffer();
  } catch {
    return sharp(Buffer.from(buildSvg(filled, goal, scale, false))).png().toBuffer();
  }
}

// Renvoie les 3 résolutions du strip pour un nombre de tampons remplis donné.
export async function stampStrips(
  filled: number,
  goal: number
): Promise<{ "strip.png": Buffer; "strip@2x.png": Buffer; "strip@3x.png": Buffer }> {
  const [s1, s2, s3] = await Promise.all([
    composeOne("strip.png", 1, filled, goal),
    composeOne("strip@2x.png", 2, filled, goal),
    composeOne("strip@3x.png", 3, filled, goal),
  ]);
  return { "strip.png": s1, "strip@2x.png": s2, "strip@3x.png": s3 };
}

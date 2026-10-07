import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

// Renders the Wallet card's "stamps" strip: a grid of circles.
// Empty = outlined circle. Filled = a coffee cup (pass-model/coffee.png if you
// provide one, otherwise a drawn SVG cup). Transparent background → the card
// colour (espresso brown, or green when a reward is ready) shows through.
// Apple strip size (storeCard): 375×144 @1x, ×2, ×3.

const BASE_W = 375;
const BASE_H = 144;

// Optional custom stamp artwork, loaded once as a data URI (embedded in the SVG).
let stampHref: string | null | undefined;
function stampImage(): string | null {
  if (stampHref !== undefined) return stampHref;
  try {
    const p = path.join(process.cwd(), "pass-model", "coffee.png");
    stampHref = "data:image/png;base64," + fs.readFileSync(p).toString("base64");
  } catch {
    stampHref = null;
  }
  return stampHref;
}

// Default stamp: a simple coffee cup with a saucer and steam.
export function drawnCoffee(cx: number, cy: number, r: number): string {
  const f = (n: number) => n.toFixed(1);
  const w = r * 0.9; // cup width
  const h = r * 0.62; // cup height
  const top = cy - h * 0.35;
  const left = cx - w / 2 - r * 0.08;
  return (
    // saucer
    `<ellipse cx="${f(cx - r * 0.08)}" cy="${f(top + h + r * 0.08)}" rx="${f(w * 0.72)}" ry="${f(r * 0.1)}" fill="#e9d8c0"/>` +
    // cup body
    `<path d="M${f(left)} ${f(top)} h${f(w)} v${f(h * 0.55)} a${f(w / 2)} ${f(h * 0.45)} 0 0 1 ${f(-w)} 0 z" fill="#f5ecde"/>` +
    // coffee surface
    `<ellipse cx="${f(left + w / 2)}" cy="${f(top + r * 0.02)}" rx="${f(w / 2 - r * 0.06)}" ry="${f(r * 0.07)}" fill="#6b3f22"/>` +
    // handle
    `<circle cx="${f(left + w + r * 0.1)}" cy="${f(top + h * 0.35)}" r="${f(r * 0.16)}" fill="none" stroke="#f5ecde" stroke-width="${f(r * 0.09)}"/>` +
    // steam
    `<path d="M${f(cx - r * 0.2)} ${f(top - r * 0.12)} q${f(r * 0.1)} ${f(-r * 0.12)} 0 ${f(-r * 0.24)} M${f(cx + r * 0.02)} ${f(top - r * 0.12)} q${f(r * 0.1)} ${f(-r * 0.12)} 0 ${f(-r * 0.24)}" fill="none" stroke="#f5ecde" stroke-width="${f(r * 0.06)}" stroke-linecap="round" opacity="0.8"/>`
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
  const href = stampImage();
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
          : drawnCoffee(cx, cy, r)
      );
    }
  }

  const w = Math.round(BASE_W * scale);
  const h = Math.round(BASE_H * scale);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${BASE_W} ${BASE_H}">${parts.join("")}</svg>`;
}

// Renders one resolution: stamp grid (+ scrim) OVER the background strip
// (pass-model/strip*.png, coffee-bean artwork). Missing image → transparent.
async function composeOne(name: string, scale: number, filled: number, goal: number): Promise<Buffer> {
  const w = BASE_W * scale;
  const h = BASE_H * scale;
  try {
    const photo = path.join(process.cwd(), "pass-model", name);
    const grid = Buffer.from(buildSvg(filled, goal, scale, true)); // scrim on (photo behind)
    return await sharp(photo)
      .resize(w, h, { fit: "cover" })
      .composite([{ input: grid, top: 0, left: 0 }])
      .png()
      .toBuffer();
  } catch {
    return sharp(Buffer.from(buildSvg(filled, goal, scale, false))).png().toBuffer();
  }
}

// Returns the 3 strip resolutions for a given number of filled stamps.
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

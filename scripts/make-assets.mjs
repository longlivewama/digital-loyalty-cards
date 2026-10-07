// Generates placeholder coffee-shop artwork for the Wallet card (pass-model/),
// the site logo (public/logo.png) and the app icons (app/favicon.ico,
// app/icon.png, app/apple-icon.png — picked up by Next.js automatically). Flat generated art, replace it with
// your real branding when you have it. Run: npm run assets
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (...p) => path.join(root, ...p);

// Espresso background with scattered coffee beans (stamps are drawn on top).
function stripSvg(w, h) {
  const beans = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w, y = rnd() * h, r = (6 + rnd() * 6) * (w / 375), a = rnd() * 180;
    beans.push(
      `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(0)})" opacity="0.18">` +
        `<ellipse rx="${(r * 0.7).toFixed(1)}" ry="${r.toFixed(1)}" fill="#c9915c"/>` +
        `<path d="M0 ${(-r * 0.85).toFixed(1)} q${(r * 0.35).toFixed(1)} ${(r * 0.85).toFixed(1)} 0 ${(r * 1.7).toFixed(1)}" stroke="#3b2416" stroke-width="${(r * 0.12).toFixed(1)}" fill="none"/>` +
        `</g>`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5a3620"/><stop offset="1" stop-color="#2a170c"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${beans.join("")}</svg>`;
}

// Round logo: cream cup on espresso.
function logoSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#3b2416" stroke="#d6aa78" stroke-width="3"/>
    <path d="M28 40 h38 v12 a19 17 0 0 1 -38 0 z" fill="#f5ecde"/>
    <ellipse cx="47" cy="40.5" rx="17" ry="3" fill="#6b3f22"/>
    <circle cx="70" cy="47" r="6" fill="none" stroke="#f5ecde" stroke-width="3.5"/>
    <ellipse cx="47" cy="71" rx="26" ry="4" fill="#d6aa78"/>
    <path d="M40 33 q4 -5 0 -10 M50 33 q4 -5 0 -10" stroke="#f5ecde" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}

// App icon: simplified for small sizes (no thin ring; bolder cup; steam only
// when there is room for it). `rounded` = transparent corners for browsers;
// iOS applies its own mask, so the apple-icon is a full square.
function appIconSvg(size, { steam = size >= 48, rounded = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="${rounded ? 22 : 0}" fill="#3b2416"/>
    <path d="M20 ${steam ? 42 : 34} h50 v14 a25 22 0 0 1 -50 0 z" fill="#f5ecde"/>
    <circle cx="76" cy="${steam ? 52 : 44}" r="9" fill="none" stroke="#f5ecde" stroke-width="6"/>
    <rect x="14" y="${steam ? 80 : 74}" width="62" height="7" rx="3.5" fill="#d6aa78"/>
    ${steam ? '<path d="M36 34 q6 -7 0 -14 M52 34 q6 -7 0 -14" stroke="#d6aa78" stroke-width="5" fill="none" stroke-linecap="round"/>' : ""}
  </svg>`;
}

// Minimal ICO writer: PNG-compressed entries (supported by all current browsers).
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e); // width
    header.writeUInt8(size >= 256 ? 0 : size, e + 1); // height
    header.writeUInt16LE(1, e + 4); // color planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

const png = (svg) => sharp(Buffer.from(svg)).png();

for (const [name, scale] of [["strip.png", 1], ["strip@2x.png", 2], ["strip@3x.png", 3]]) {
  await png(stripSvg(375 * scale, 144 * scale)).toFile(out("pass-model", name));
}
for (const [name, size] of [["icon.png", 29], ["icon@2x.png", 58], ["icon@3x.png", 87], ["logo.png", 50], ["logo@2x.png", 100], ["logo@3x.png", 150]]) {
  await png(logoSvg(size)).resize(size, size).toFile(out("pass-model", name));
}
// Site logo; also the Google Wallet program logo (served at /logo.png, square,
// Google recommends ≥ 660×660).
await png(logoSvg(660)).resize(660, 660).toFile(out("public", "logo.png"));
// App icons (Next.js file conventions in app/).
const icoEntries = [];
for (const size of [16, 32, 48]) {
  icoEntries.push({ size, data: await png(appIconSvg(size)).resize(size, size).toBuffer() });
}
await fs.writeFile(out("app", "favicon.ico"), ico(icoEntries));
await png(appIconSvg(512)).resize(512, 512).toFile(out("app", "icon.png"));
await png(appIconSvg(180, { rounded: false })).resize(180, 180).toFile(out("app", "apple-icon.png"));
console.log("Coffee artwork written to pass-model/, public/logo.png and app/ icons");

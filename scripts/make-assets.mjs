// Generates placeholder coffee-shop artwork for the Wallet card (pass-model/)
// and the site logo (public/logo.png). Flat generated art, replace it with
// your real branding when you have it. Run: npm run assets
import sharp from "sharp";
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
console.log("Coffee artwork written to pass-model/ and public/logo.png");

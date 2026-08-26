/** @type {import('next').NextConfig} */
const nextConfig = {
  // paquets serveur (natifs / lourds), pas de bundling client
  serverExternalPackages: ["passkit-generator", "sharp"],
};
module.exports = nextConfig;

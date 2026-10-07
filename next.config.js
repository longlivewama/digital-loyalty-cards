/** @type {import('next').NextConfig} */
const nextConfig = {
  // server-only packages (native / heavy): never bundled
  serverExternalPackages: ["passkit-generator", "sharp", "@googleapis/walletobjects"],
};
module.exports = nextConfig;

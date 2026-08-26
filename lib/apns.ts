import http2 from "node:http2";

// Auth APNs par certificat : on réutilise le certificat Pass Type ID
// (le même qui signe les cartes). Aucune clé .p8 supplémentaire nécessaire.
function clientCerts() {
  const cert = Buffer.from(process.env.PASS_SIGNER_CERT || "", "base64");
  const key = Buffer.from(process.env.PASS_SIGNER_KEY || "", "base64");
  return { cert, key };
}

const APNS_HOST = "https://api.push.apple.com";
const PASS_TYPE_ID = process.env.PASS_TYPE_ID || "pass.com.example.loyalty";

// Envoie un push Wallet (payload vide) -> iOS va re-télécharger la carte.
// Retourne le status APNs (200 = ok). Ne throw pas : on log et on continue.
// Timeout dur : si APNs ne répond pas (connexion qui "pend" sans RST), on
// abandonne au bout de TIMEOUT_MS au lieu de laisser la fonction serverless
// figer jusqu'à son maxDuration (et tuer le reste d'un broadcast/relance).
const TIMEOUT_MS = 8000;

export async function pushPassUpdate(pushToken: string): Promise<number> {
  if (!pushToken) return 0;
  const { cert, key } = clientCerts();

  return new Promise((resolve) => {
    let settled = false;
    let client: http2.ClientHttp2Session | undefined;
    const done = (s: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        client?.close();
      } catch {
        /* déjà fermé */
      }
      resolve(s);
    };
    const timer = setTimeout(() => done(-1), TIMEOUT_MS);

    try {
      client = http2.connect(APNS_HOST, { cert, key });
    } catch {
      return done(-1);
    }
    client.on("error", () => done(-1));

    // Push Wallet : topic = passTypeId, payload vide {}. Pas d'apns-push-type
    // (méthode PassKit historique — un "background" forcerait priority 5 = lent).
    // apns-priority: 10 = "livre tout de suite" (vs défaut flou qui peut différer
    // la MAJ pour économiser la batterie). N'enlève pas la nature best-effort d'APNs.
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${pushToken}`,
      "apns-topic": PASS_TYPE_ID,
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let status = 0;
    let body = "";
    req.on("response", (h) => {
      status = Number(h[":status"]) || 0;
    });
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (status !== 200) console.error("APNs", status, body);
      done(status);
    });
    req.on("error", () => done(-1));

    req.write("{}");
    req.end();
  });
}

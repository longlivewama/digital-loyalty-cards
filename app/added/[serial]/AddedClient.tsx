"use client";

import { useEffect, useRef, useState } from "react";

export default function AddedClient({
  serial,
  name,
  passUrl,
}: {
  serial: string;
  name: string;
  passUrl: string;
}) {
  const [added, setAdded] = useState(false);
  const dl = useRef<HTMLAnchorElement>(null);

  // déclenche le téléchargement une fois (le tap d'inscription = geste valide)
  useEffect(() => {
    const t = setTimeout(() => dl.current?.click(), 700);
    return () => clearTimeout(t);
  }, []);

  // poll : registered=true dès que la carte est ajoutée au Wallet
  useEffect(() => {
    if (added) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/member/${serial}/status`, { cache: "no-store" });
        const j = await r.json();
        if (j.registered) {
          setAdded(true);
          clearInterval(id);
        }
      } catch {
        /* réseau : on réessaiera au prochain tick */
      }
    }, 2000);
    return () => clearInterval(id);
  }, [serial, added]);

  if (added) {
    return (
      <div className="card ready">
        <div style={{ fontSize: 64, lineHeight: 1 }}>✅</div>
        <h1 style={{ marginTop: 10 }}>Carte ajoutée !</h1>
        <h2>Bienvenue {name}</h2>
        <p className="muted">
          Votre carte est active dans Apple Wallet. Présentez-la à chaque visite pour cumuler vos
          tampons 🍕
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="spinner" />
      <h1 style={{ marginTop: 16 }}>Ajout en cours…</h1>
      <h2>Bienvenue {name}</h2>
      <p className="muted">
        Touchez <strong>Ajouter à Apple Wallet</strong> ci-dessous, puis <strong>Ajouter</strong> en
        haut à droite. Cette page se validera automatiquement.
      </p>
      <div className="spacer" />

      <a id="dl" ref={dl} className="btn" href={passUrl}>
        Ajouter à Apple Wallet
      </a>

      <p className="muted" style={{ marginTop: 18, fontSize: 13 }}>
        Le téléchargement ne s&apos;est pas lancé ?{" "}
        <a href={passUrl} style={{ color: "var(--copper)", textDecoration: "underline" }}>
          Réessayer
        </a>
      </p>
    </div>
  );
}

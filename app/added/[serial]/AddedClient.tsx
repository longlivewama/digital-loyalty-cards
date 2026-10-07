"use client";

import { useEffect, useRef, useState } from "react";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

// Stop polling after 10 minutes (e.g. an Android customer never adds an Apple pass).
const POLL_MS = 2000;
const POLL_MAX = (10 * 60 * 1000) / POLL_MS;

export default function AddedClient({
  name,
  serial,
  memberQr,
  statusUrl,
  appleUrl,
  googleUrl,
}: {
  name: string;
  serial: string;
  memberQr: string;
  statusUrl: string;
  appleUrl: string | null;
  googleUrl: string | null;
}) {
  const [added, setAdded] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const appleLink = useRef<HTMLAnchorElement>(null);

  // On iPhone, open the Apple pass once (the signup tap counts as a user gesture).
  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    if (p !== "ios" || !appleUrl) return;
    const t = setTimeout(() => appleLink.current?.click(), 700);
    return () => clearTimeout(t);
  }, [appleUrl]);

  // Poll: registered=true as soon as the card has been added to Apple Wallet.
  useEffect(() => {
    if (added || !appleUrl) return;
    let ticks = 0;
    const id = setInterval(async () => {
      if (++ticks > POLL_MAX) return clearInterval(id);
      try {
        const r = await fetch(statusUrl, { cache: "no-store" });
        const j = await r.json();
        if (j.registered) {
          setAdded(true);
          clearInterval(id);
        }
      } catch {
        /* network: retry on the next tick */
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [statusUrl, appleUrl, added]);

  if (added) {
    return (
      <div className="card ready">
        <div style={{ fontSize: 64, lineHeight: 1 }}>✅</div>
        <h1 style={{ marginTop: 10 }}>Card added!</h1>
        <h2>Welcome, {name}</h2>
        <p className="muted">
          Your loyalty card is now in Apple Wallet. Show it every time you order to collect your
          stamps ☕
        </p>
      </div>
    );
  }

  const apple = appleUrl && (
    <a key="apple" ref={appleLink} className="btn wallet-btn apple" href={appleUrl}>
      Add to Apple Wallet
    </a>
  );
  const google = googleUrl && (
    <a key="google" className="btn wallet-btn google" href={googleUrl}>
      Add to Google Wallet
    </a>
  );
  // Show the wallet that matches the phone first.
  const buttons = platform === "android" ? [google, apple] : [apple, google];

  return (
    <div className="card">
      <div style={{ fontSize: 56, lineHeight: 1 }}>☕</div>
      <h1 style={{ marginTop: 12 }}>Your loyalty card is ready</h1>
      <h2>Welcome, {name}</h2>
      <p className="muted">
        Buy 9 coffees, get the 10th free. Add your card to your phone&apos;s wallet — your stamps
        update automatically.
      </p>
      <div className="spacer" />

      {appleUrl || googleUrl ? (
        <div className="wallet-buttons">{buttons}</div>
      ) : (
        <p className="muted">
          Digital wallet cards are not available yet. Please ask the staff to add stamps for you.
        </p>
      )}

      {appleUrl && (
        <p className="muted" style={{ marginTop: 18, fontSize: 13 }}>
          On iPhone, tap <strong>Add</strong> in the top-right corner after opening the card. This
          page confirms automatically.
        </p>
      )}
      {googleUrl && (
        <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          On Android, tap <strong>Add to Google Wallet</strong> and then <strong>Save</strong>.
        </p>
      )}

      <div className="spacer" />
      <p className="muted" style={{ fontSize: 13 }}>
        No wallet? Take a screenshot of your card&apos;s QR code and show it at the counter.
      </p>
      <div className="qr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={memberQr} alt={`Loyalty card QR code, member ${serial}`} />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Member {serial}</p>
    </div>
  );
}

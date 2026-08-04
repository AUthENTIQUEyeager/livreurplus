"use client";

import { useEffect, useState } from "react";

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CLE_IOS_MASQUE = "livreurplus_bannière_ios_masquée";

function estIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iosClassique = /iphone|ipad|ipod/i.test(ua);
  // iPadOS moderne se déclare comme "Macintosh" mais a le tactile.
  const iPadOSDeguise = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return iosClassique || iPadOSDeguise;
}

function estDejaInstallee(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  // @ts-expect-error : propriété spécifique à Safari iOS
  const iosStandalone = window.navigator.standalone === true;
  return standalone || iosStandalone;
}

export default function PwaInstall() {
  const [inviteAndroid, setInviteAndroid] = useState<EvenementInstallation | null>(null);
  const [afficherBanniereIos, setAfficherBanniereIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Échec silencieux : l'app continue de fonctionner sans SW.
      });
    }

    if (estDejaInstallee()) return;

    const gererInvite = (e: Event) => {
      e.preventDefault();
      setInviteAndroid(e as EvenementInstallation);
    };
    window.addEventListener("beforeinstallprompt", gererInvite);

    if (estIos() && !localStorage.getItem(CLE_IOS_MASQUE)) {
      const t = setTimeout(() => setAfficherBanniereIos(true), 2000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", gererInvite);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", gererInvite);
  }, []);

  async function installerAndroid() {
    if (!inviteAndroid) return;
    await inviteAndroid.prompt();
    await inviteAndroid.userChoice;
    setInviteAndroid(null);
  }

  function fermerBanniereIos() {
    setAfficherBanniereIos(false);
    localStorage.setItem(CLE_IOS_MASQUE, "1");
  }

  return (
    <>
      {inviteAndroid && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 bg-ink px-4 py-3 text-white shadow-lg sm:bottom-4 sm:left-1/2 sm:right-auto sm:w-[420px] sm:-translate-x-1/2 sm:rounded-2xl">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-72.png" alt="" className="h-10 w-10 rounded-xl" />
            <div>
              <p className="text-sm font-semibold">Installer LivreurPlus</p>
              <p className="text-xs text-white/60">Accès rapide, sans navigateur</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInviteAndroid(null)}
              className="rounded-lg px-2 py-1.5 text-xs text-white/60"
            >
              Plus tard
            </button>
            <button
              onClick={installerAndroid}
              className="rounded-lg bg-route px-3 py-1.5 text-xs font-semibold text-white"
            >
              Installer
            </button>
          </div>
        </div>
      )}

      {afficherBanniereIos && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-ink px-4 py-3 text-white shadow-lg sm:bottom-4 sm:left-1/2 sm:right-auto sm:w-[420px] sm:-translate-x-1/2 sm:rounded-2xl">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-72.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Installer LivreurPlus</p>
              <p className="mt-1 text-xs leading-relaxed text-white/70">
                Appuie sur{" "}
                <span className="inline-flex items-center rounded bg-white/15 px-1.5 py-0.5 font-medium">
                  Partager ⬆
                </span>{" "}
                puis{" "}
                <span className="inline-flex items-center rounded bg-white/15 px-1.5 py-0.5 font-medium">
                  Sur l&apos;écran d&apos;accueil
                </span>
                .
              </p>
            </div>
            <button onClick={fermerBanniereIos} className="text-xs text-white/50">
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { BRAND_ICON_URL } from "@/lib/brand";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "raronexus-install-prompt-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isMobileLike() {
  return window.matchMedia("(max-width: 1023px), (pointer: coarse)").matches;
}

function isIos() {
  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1)
  );
}

export function InstallPromptCard() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === "true") return;
    if (isStandalone() || !isMobileLike()) return;

    const ios = isIos();
    const iosPromptTimeout = window.setTimeout(() => {
      setIosDevice(ios);
      setVisible(ios);
    }, 0);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      localStorage.setItem(DISMISSED_KEY, "true");
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.clearTimeout(iosPromptTimeout);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const canShowInstallButton = Boolean(installPrompt);
  const helpText = useMemo(() => {
    if (iosDevice && !canShowInstallButton) {
      return "No Safari, use Compartilhar e depois Adicionar a Tela de Inicio.";
    }

    return "Acesse o autenticador RaroNexus mais rapido pela tela inicial.";
  }, [canShowInstallButton, iosDevice]);

  async function handleInstall() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      localStorage.setItem(DISMISSED_KEY, "true");
      setVisible(false);
    }

    setInstallPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="fixed inset-x-3 bottom-10 z-50 mx-auto max-w-md rounded-xl border border-cyan-400/25 bg-slate-950/95 p-4 text-slate-100 shadow-2xl shadow-slate-950/70 backdrop-blur lg:hidden">
      <div className="flex items-start gap-3">
        <Image
          src={BRAND_ICON_URL}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-lg bg-white object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Instalar RaroNexus</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {helpText}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canShowInstallButton ? (
              <button
                type="button"
                onClick={() => void handleInstall()}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-500"
              >
                Instalar
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
            >
              Agora nao
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

"use client";

import { Download, Share, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function PwaInstallGate({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const update = () => {
      setStandalone(isStandaloneMode());
      setIsIOS(isIOSDevice());
      setChecked(true);
    };

    update();
    const media = window.matchMedia("(display-mode: standalone)");
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setStandalone(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    media.addEventListener?.("change", update);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      media.removeEventListener?.("change", update);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") setInstallPrompt(null);
  }

  if (!checked) {
    return <div className="pwa-gate min-h-dvh bg-[#0f1720]" />;
  }

  if (standalone) return <>{children}</>;

  return (
    <main className="pwa-gate flex min-h-dvh items-center justify-center bg-[#0f1720] px-5 py-8 text-white">
      <section className="pwa-gate-card w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-2xl">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[1.7rem] bg-gradient-to-br from-[#7bd0ff] via-[#229ed9] to-[#0969a8] shadow-xl shadow-[#229ed9]/25">
          <Smartphone size={38} />
        </div>
        <h1 className="text-center text-2xl font-black tracking-[-0.04em]">Установите веб-приложение</h1>
        <p className="mt-3 text-center text-sm leading-6 text-white/65">
          Pirogram работает только как установленное веб-приложение. Так чат открывается отдельной иконкой, push работает стабильнее, а интерфейс выглядит как обычное приложение.
        </p>

        {installPrompt && !isIOS ? (
          <button onClick={() => void install()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#229ed9] px-4 py-3 font-bold text-white shadow-lg shadow-[#229ed9]/25 active:scale-[0.98]">
            <Download size={19} /> Установить приложение
          </button>
        ) : null}

        <div className="mt-6 space-y-3">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="mb-2 flex items-center gap-2 font-bold"><Share size={17} /> iPhone / iPad</p>
            <p className="text-sm leading-6 text-white/70">Откройте сайт в Safari, нажмите «Поделиться», затем «На экран Домой» и «Добавить». Потом запускайте Pirogram с иконки на экране.</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="mb-2 flex items-center gap-2 font-bold"><Download size={17} /> Android</p>
            <p className="text-sm leading-6 text-white/70">Нажмите кнопку «Установить» выше. Если кнопки нет: меню браузера ⋮, затем «Установить приложение» или «Добавить на главный экран».</p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-white/45">После установки закройте эту вкладку и откройте Pirogram через новую иконку.</p>
      </section>
    </main>
  );
}

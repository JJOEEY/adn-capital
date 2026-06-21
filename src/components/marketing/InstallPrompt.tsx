"use client";

/**
 * "Cài app ADN" prompt — converts a mobile web visitor into an installed PWA.
 * Chrome/Android: catches `beforeinstallprompt` and offers a one-tap install.
 * iOS Safari (no such event): shows the manual "Thêm vào màn hình chính" hint.
 * Hidden when already installed (standalone) or dismissed. Marketing surfaces only.
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("adn-install-dismissed") === "1") return;
    } catch {}

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (standalone) return;

    const ua = navigator.userAgent;
    if (!/Android|iPhone|iPad|iPod/i.test(ua)) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setShow(true);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isIOSSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    if (isIOSSafari) {
      setIosHint(true);
      setShow(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem("adn-install-dismissed", "1");
    } catch {}
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {}
    setDeferred(null);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Cài ADN làm ứng dụng"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
        zIndex: 9990,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          maxWidth: 460,
          margin: "0 auto",
          background: "var(--surface, #fff)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "11px 13px",
          boxShadow: "0 16px 44px -18px rgba(0,0,0,0.34)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: "var(--primary)",
            color: "var(--on-primary, #fff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 18,
            flex: "0 0 auto",
          }}
        >
          A
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Cài ADN làm app</div>
          <div style={{ fontSize: 12, lineHeight: 1.4, color: "var(--text-secondary)" }}>
            {iosHint
              ? "Bấm Chia sẻ rồi chọn “Thêm vào MH chính”."
              : "Toàn màn hình, mở nhanh, nhận cảnh báo tín hiệu."}
          </div>
        </div>
        {!iosHint && (
          <button
            type="button"
            onClick={install}
            style={{
              flex: "0 0 auto",
              background: "var(--primary)",
              color: "var(--on-primary, #fff)",
              border: "none",
              borderRadius: 20,
              padding: "9px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cài
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Đóng"
          style={{
            flex: "0 0 auto",
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <X size={17} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

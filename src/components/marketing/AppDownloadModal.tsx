"use client";

/**
 * Pop-up giới thiệu app ADN + hướng dẫn tải.
 * - Android: nút tải APK trực tiếp (/downloads/adn-capital.apk).
 * - iOS: "Sắp ra mắt" + gợi ý thêm vào màn hình chính (PWA) tạm thời.
 * - Desktop: gợi ý mở trên điện thoại Android.
 * Tự hiện 1 lần/thiết bị (localStorage), ẩn khi đã cài standalone. Thay cho InstallPrompt cũ.
 */

import { useEffect, useState } from "react";
import { X, Download, Apple, Smartphone, Crosshair, Bot, Activity } from "lucide-react";

const SEEN_KEY = "adn-app-promo-v1";
const APK_URL = "/downloads/adn-capital.apk";

type Platform = "android" | "ios" | "desktop";

export function AppDownloadModal() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : "desktop");

    // Mở lại popup khi bấm "Tải app" ở footer (bỏ qua cờ đã-xem).
    const onOpen = () => setShow(true);
    window.addEventListener("adn:open-app-download", onOpen);

    // Tự hiện 1 lần/thiết bị — bỏ qua nếu đã xem hoặc đang chạy standalone (đã cài app/PWA).
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (!seen && !standalone) {
      t = setTimeout(() => setShow(true), 1200);
    }
    return () => {
      window.removeEventListener("adn:open-app-download", onOpen);
      if (t) clearTimeout(t);
    };
  }, []);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  const isIOS = platform === "ios";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tải ứng dụng ADN Capital"
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9995,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        animation: "adnFade 0.18s ease",
      }}
    >
      <style>{`@keyframes adnFade{from{opacity:0}to{opacity:1}}@keyframes adnPop{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--surface, #fff)",
          border: "1px solid var(--border)",
          borderRadius: 22,
          padding: 22,
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.55)",
          position: "relative",
          animation: "adnPop 0.24s cubic-bezier(0.23,1,0.32,1)",
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Đóng"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--surface-2, rgba(0,0,0,0.05))",
            border: "none",
            borderRadius: 10,
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <X size={17} strokeWidth={2} />
        </button>

        {/* Icon + tiêu đề */}
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 13 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192x192.png"
            alt="ADN Capital"
            width={56}
            height={56}
            style={{
              width: 56,
              height: 56,
              borderRadius: 15,
              flex: "0 0 auto",
              boxShadow: "0 10px 26px -10px var(--primary)",
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
              ADN trên điện thoại
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>
              Tín hiệu mua/bán · AIDEN soi mã · nhịp thị trường
            </div>
          </div>
        </div>

        {/* Tính năng app */}
        <div style={{ display: "grid", gap: 10, margin: "2px 0 16px", fontSize: 13 }}>
          {[
            { Icon: Crosshair, t: "Radar quét cả sàn, có mã vào điểm mua là báo ngay về máy" },
            { Icon: Bot, t: "Hỏi AIDEN soi mã bất kỳ: kỹ thuật, cơ bản, định giá — nên mua hay không" },
            { Icon: Activity, t: "ADNCore chấm điểm thị trường: hôm nay nên đánh hay đứng ngoài" },
          ].map(({ Icon, t }) => (
            <div key={t} style={{ display: "flex", gap: 9, alignItems: "flex-start", color: "var(--text-secondary)" }}>
              <Icon size={16} style={{ color: "var(--primary)", flex: "0 0 auto", marginTop: 1 }} />
              <span>{t}</span>
            </div>
          ))}
        </div>

        {/* CTA theo nền tảng */}
        {isIOS ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                background: "var(--surface-2, rgba(0,0,0,0.05))",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "13px 16px",
                color: "var(--text-secondary)",
                fontSize: 14.5,
                fontWeight: 700,
              }}
            >
              <Apple size={18} /> iOS — Sắp ra mắt
            </div>
            <div style={{ marginTop: 9, fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
              Tạm thời: bấm <b>Chia sẻ</b> → <b>Thêm vào MH chính</b> để dùng như app.
            </div>
          </>
        ) : (
          <>
            <a
              href={APK_URL}
              download="adn-capital.apk"
              onClick={() => {
                try {
                  localStorage.setItem(SEEN_KEY, "1");
                } catch {}
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                background: "var(--primary)",
                color: "var(--on-primary, #fff)",
                borderRadius: 14,
                padding: "13px 16px",
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <Download size={18} /> Tải app Android (.apk)
            </a>
            <div
              style={{
                marginTop: 8,
                fontSize: 11.5,
                color: "var(--text-muted)",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Smartphone size={13} />
              {platform === "desktop"
                ? "Mở adncapital.com.vn trên điện thoại Android để cài"
                : "~3.5MB · cho phép “cài từ nguồn này” khi máy hỏi"}
            </div>
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              <Apple size={13} /> iPhone / iPad — sắp ra mắt
            </div>
          </>
        )}
      </div>
    </div>
  );
}

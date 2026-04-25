"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";
import { isAdnNativeRuntime } from "@/lib/mobileRuntime";

interface AppRelease {
  version: string;
  buildNumber: number;
  title: string;
  summary: string;
  updateType: "recommended" | "required";
  downloadUrl: string | null;
}

interface LatestReleasePayload {
  latest: AppRelease;
  minSupportedVersion: string;
}

function normalizeVersion(version: string) {
  const clean = version.trim().replace(/[^\d.]/g, "");
  const parts = clean.split(".").filter(Boolean);
  while (parts.length < 3) parts.push("0");
  return parts.slice(0, 3).join(".");
}

function compareVersions(left: string, right: string) {
  const leftParts = normalizeVersion(left).split(".").map(Number);
  const rightParts = normalizeVersion(right).split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

function getNativeAppVersion() {
  if (typeof window === "undefined") return null;
  const match = window.navigator.userAgent.match(/ADNCapitalAndroid\/([0-9.]+)/i);
  return match?.[1] ? normalizeVersion(match[1]) : null;
}

export function AppUpdateNotice() {
  const [payload, setPayload] = useState<LatestReleasePayload | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdnNativeRuntime()) return;

    const detectedVersion = getNativeAppVersion();
    if (!detectedVersion) return;

    setCurrentVersion(detectedVersion);
    setDismissedVersion(localStorage.getItem("adn_dismissed_app_update"));

    let cancelled = false;
    fetch("/api/app/releases/latest", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.latest?.version) setPayload(data);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const state = useMemo(() => {
    if (!payload || !currentVersion) return null;

    const latestVersion = normalizeVersion(payload.latest.version);
    const minVersion = normalizeVersion(payload.minSupportedVersion);
    const isRequired = compareVersions(currentVersion, minVersion) < 0;
    const hasUpdate = compareVersions(currentVersion, latestVersion) < 0;

    if (!isRequired && !hasUpdate) return null;
    if (!isRequired && dismissedVersion === latestVersion) return null;

    return {
      latestVersion,
      isRequired,
      release: payload.latest,
    };
  }, [currentVersion, dismissedVersion, payload]);

  if (!state) return null;

  const dismiss = () => {
    if (state.isRequired) return;
    localStorage.setItem("adn_dismissed_app_update", state.latestVersion);
    setDismissedVersion(state.latestVersion);
  };

  return (
    <div className="px-4 pb-3">
      <div
        className="rounded-2xl border p-3 shadow-sm"
        style={{
          background: "var(--surface)",
          borderColor: state.isRequired ? "rgba(239,68,68,0.35)" : "var(--border)",
          color: "var(--text-primary)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">
              {state.isRequired ? "Cần cập nhật app" : "Có bản cập nhật app mới"}
            </p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Phiên bản mới {state.release.version}. Xem nội dung cập nhật và tải APK nếu bản mới đã được phát hành.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/app-updates"
                className="rounded-xl px-3 py-2 text-xs font-bold"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                Xem cập nhật
              </Link>
              {state.release.downloadUrl && (
                <a
                  href={state.release.downloadUrl}
                  className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Tải APK
                </a>
              )}
              {!state.isRequired && (
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-xl border px-3 py-2 text-xs font-bold"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Để sau
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

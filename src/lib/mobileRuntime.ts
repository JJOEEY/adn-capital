"use client";

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
};

export function isAdnNativeRuntime() {
  if (typeof window === "undefined") return false;

  const capacitor = (window as CapacitorWindow).Capacitor;
  const platform = capacitor?.getPlatform?.();
  const isCapacitorNative = capacitor?.isNativePlatform?.() === true || platform === "android" || platform === "ios";

  return isCapacitorNative || window.navigator.userAgent.includes("ADNCapitalAndroid");
}

export function isStandalonePwaRuntime() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isStandaloneAppRuntime() {
  return isStandalonePwaRuntime() || isAdnNativeRuntime();
}

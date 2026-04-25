export type AppReleaseKind = "recommended" | "required";

export interface AppRelease {
  version: string;
  buildNumber: number;
  releasedAt: string;
  title: string;
  summary: string;
  updateType: AppReleaseKind;
  downloadUrl: string | null;
  checksumSha256: string | null;
  changes: string[];
}

const configuredDownloadUrl = process.env.ADN_ANDROID_APK_URL?.trim() || null;
const configuredChecksum = process.env.ADN_ANDROID_APK_SHA256?.trim() || null;

export const MIN_SUPPORTED_APP_VERSION = process.env.ADN_APP_MIN_SUPPORTED_VERSION?.trim() || "1.0.0";

export const APP_RELEASES: AppRelease[] = [
  {
    version: "1.0.0",
    buildNumber: 1,
    releasedAt: "2026-04-25T00:00:00+07:00",
    title: "Nền tảng app ADN Capital",
    summary:
      "Hoàn thiện app-first flow, thanh điều hướng PWA và nền tảng kiểm tra cập nhật APK cho khách hàng cài ngoài.",
    updateType: "recommended",
    downloadUrl: configuredDownloadUrl,
    checksumSha256: configuredChecksum,
    changes: [
      "Bổ sung trang Thông báo cập nhật để khách hàng xem các bản cập nhật và vá lỗi mới.",
      "Thêm cơ chế kiểm tra phiên bản APK khi app chạy trong runtime Android.",
      "Đồng bộ app shell theo theme hiện tại, không hardcode màu riêng cho PWA.",
      "Giữ dữ liệu app đọc từ API/DataHub canonical của website.",
    ],
  },
];

export function compareVersions(left: string, right: string) {
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

export function normalizeVersion(version: string) {
  const clean = version.trim().replace(/[^\d.]/g, "");
  const parts = clean.split(".").filter(Boolean);
  while (parts.length < 3) parts.push("0");
  return parts.slice(0, 3).join(".");
}

export function getLatestAppRelease() {
  return APP_RELEASES[0];
}

export function getAppReleasePayload() {
  return {
    latest: getLatestAppRelease(),
    releases: APP_RELEASES,
    minSupportedVersion: MIN_SUPPORTED_APP_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

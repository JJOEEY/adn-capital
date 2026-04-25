import Link from "next/link";
import { Download, History, ShieldCheck, Smartphone } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { getAppReleasePayload } from "@/lib/appReleases";

function formatReleaseDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AppUpdatesPage() {
  const payload = getAppReleasePayload();
  const latest = payload.latest;

  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl space-y-5 p-4 pb-28">
        <section
          className="rounded-3xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                Thông báo cập nhật
              </p>
              <h1 className="mt-2 text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                Cập nhật ứng dụng ADN Capital
              </h1>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Đây là nơi thông báo các bản cập nhật, vá lỗi và thay đổi mới của app. Với bản cài ngoài Google Play,
                app không thể tự cài đặt âm thầm; hệ thống sẽ báo phiên bản mới và dẫn tới file APK khi link tải được
                cấu hình.
              </p>
            </div>
          </div>
        </section>

        <section
          className="rounded-3xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
              Phiên bản mới nhất
            </h2>
          </div>
          <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xl font-black" style={{ color: "var(--text-primary)" }}>
                  {latest.title}
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                  Version {latest.version} · Build {latest.buildNumber} · {formatReleaseDate(latest.releasedAt)}
                </p>
              </div>
              {latest.downloadUrl ? (
                <a
                  href={latest.downloadUrl}
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <Download className="h-4 w-4" />
                  Tải APK mới
                </a>
              ) : (
                <span
                  className="rounded-2xl border px-4 py-2 text-sm font-bold"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Chưa có link APK
                </span>
              )}
            </div>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {latest.summary}
            </p>
            <ul className="mt-4 space-y-2">
              {latest.changes.map((change) => (
                <li key={change} className="flex gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
            {!latest.downloadUrl && (
              <p className="mt-4 rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-700">
                Chưa cấu hình `ADN_ANDROID_APK_URL`. Các thay đổi web/PWA vẫn tự cập nhật sau deploy, còn bản APK native
                mới sẽ cần link tải riêng để khách hàng cài thủ công.
              </p>
            )}
          </div>
        </section>

        <section
          className="rounded-3xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
              Lịch sử cập nhật
            </h2>
          </div>
          <div className="mt-4 space-y-3">
            {payload.releases.map((release) => (
              <div key={`${release.version}-${release.buildNumber}`} className="rounded-2xl border p-4" style={{ borderColor: "var(--border)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black" style={{ color: "var(--text-primary)" }}>
                    {release.version}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatReleaseDate(release.releasedAt)}
                  </p>
                </div>
                <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {release.summary}
                </p>
              </div>
            ))}
          </div>
        </section>

        <Link href="/menu" className="block rounded-2xl border p-4 text-center text-sm font-bold" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          Quay lại Menu
        </Link>
      </div>
    </MainLayout>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isStandaloneAppRuntime } from "@/lib/mobileRuntime";

interface PwaEntryRedirectProps {
  children: React.ReactNode;
}

export function PwaEntryRedirect({ children }: PwaEntryRedirectProps) {
  const router = useRouter();
  const { status } = useSession();
  const [runtime, setRuntime] = useState<"checking" | "app" | "web">("checking");

  useEffect(() => {
    const isApp = isStandaloneAppRuntime();
    setRuntime(isApp ? "app" : "web");
  }, []);

  useEffect(() => {
    if (runtime !== "app" || status === "loading") return;
    router.replace(status === "authenticated" ? "/dashboard" : "/auth?app=1");
  }, [router, runtime, status]);

  if (runtime === "web") {
    return <>{children}</>;
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center px-6 text-center"
      style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}
    >
      <div className="space-y-3">
        <div
          className="mx-auto h-10 w-10 animate-pulse rounded-2xl"
          style={{ background: "var(--primary-light)" }}
        />
        <p className="text-sm font-bold">Đang mở ADN Capital...</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Kiểm tra phiên đăng nhập để vào app.
        </p>
      </div>
    </main>
  );
}

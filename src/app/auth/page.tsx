"use client";

import { Suspense, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Eye,
  LayoutDashboard,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  WalletCards,
} from "lucide-react";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";
import { isStandaloneAppRuntime } from "@/lib/mobileRuntime";

const benefits = [
  {
    icon: LayoutDashboard,
    title: PRODUCT_NAMES.dashboard,
    body: "Theo dõi VNINDEX, thanh khoản, độ rộng thị trường, bản tin sáng, tổng kết cuối ngày và các cơ hội mới trong cùng một màn hình.",
  },
  {
    icon: Bot,
    title: PRODUCT_NAMES.brokerWorkflow,
    body: "Xem mã cổ phiếu đáng chú ý, vùng giá tham khảo, trạng thái theo dõi và cảnh báo rủi ro trước khi ra quyết định.",
  },
  {
    icon: WalletCards,
    title: "Quy trình có kiểm soát",
    body: "Các thao tác quan trọng luôn có bước kiểm tra và xác nhận rõ ràng. ADN Capital không tự động giao dịch thay nhà đầu tư.",
  },
];

const safeUseSteps = [
  `Đăng nhập ${BRAND.name} để mở ${PRODUCT_NAMES.dashboard} và bộ công cụ phân tích.`,
  "Theo dõi thị trường, cơ hội và cảnh báo rủi ro trong cùng một tài khoản.",
  "Mọi thao tác nhạy cảm đều cần xác nhận của nhà đầu tư; hệ thống không tự ý thực hiện giao dịch.",
];

function AuthPageShell({ children, compactApp = false }: { children: ReactNode; compactApp?: boolean }) {
  if (compactApp) {
    return (
      <main
        className="min-h-screen overflow-hidden px-4 py-8"
        style={{
          background: "var(--page-surface)",
          color: "var(--text-primary)",
          paddingTop: "calc(28px + env(safe-area-inset-top, 0px))",
          paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
          <div className="mb-6 text-center">
            <Image src="/brand/favicon.png" alt={BRAND.name} width={56} height={56} className="mx-auto rounded-2xl" priority />
            <h1 className="mt-4 text-2xl font-black tracking-[-0.04em]">Đăng nhập {BRAND.name}</h1>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              Đăng nhập để mở {PRODUCT_NAMES.dashboard}, tin tức, {PRODUCT_NAMES.brokerWorkflow} và {PRODUCT_NAMES.art} trong app.
            </p>
          </div>
          {children}
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-10"
      style={{ background: "var(--page-surface)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative"
        >
          <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: "rgba(46,77,61,0.16)" }} />
          <div
            className="relative rounded-[2rem] border p-6 sm:p-8 lg:p-10"
            style={{
              background: "linear-gradient(145deg, var(--surface), var(--surface-2))",
              borderColor: "var(--border)",
            }}
          >
            <div className="mb-8 flex items-center gap-3">
              <Image src="/brand/favicon.png" alt={BRAND.name} width={56} height={56} className="rounded-2xl" priority />
              <div>
                <p className="text-sm font-bold tracking-[0.28em]" style={{ color: "var(--primary)" }}>
                  {BRAND.name.toUpperCase()}
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {BRAND.tagline}
                </p>
              </div>
            </div>

            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{ background: "var(--primary-light)", borderColor: "var(--border)", color: "var(--primary)" }}
            >
              <ShieldCheck className="h-4 w-4" />
              Quy trình an toàn, không tự động giao dịch
            </div>

            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              Đăng nhập để mở {BRAND.name}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 sm:text-lg" style={{ color: "var(--text-secondary)" }}>
              Một điểm vào cho {PRODUCT_NAMES.dashboard}, {PRODUCT_NAMES.brokerWorkflow}, {PRODUCT_NAMES.art} và cảnh báo quan trọng.
              {` ${PRODUCT_NAMES.assistant}`} hỗ trợ giải thích, còn quyết định cuối cùng luôn thuộc về nhà đầu tư.
            </p>

            <div className="mt-8 grid gap-3">
              {benefits.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                    <div className="flex gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="font-bold">{item.title}</h2>
                        <p className="mt-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/terminal"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition"
                style={{ background: "var(--primary)", color: "#EBE2CF" }}
              >
                <Eye className="h-4 w-4" />
                Xem tư vấn read-only
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Xem gói dịch vụ
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }}>
          {children}
        </motion.section>
      </div>
    </main>
  );
}

function AuthPageSkeleton() {
  return (
    <AuthPageShell compactApp>
      <div className="rounded-[2rem] border p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="mb-6 h-12 animate-pulse rounded-2xl" style={{ background: "var(--surface-2)" }} />
        <div className="h-[520px] animate-pulse rounded-2xl" style={{ background: "var(--surface-2)" }} />
      </div>
    </AuthPageShell>
  );
}

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [isStandaloneRuntime, setIsStandaloneRuntime] = useState(false);
  const isAppMode = searchParams.get("app") === "1" || isStandaloneRuntime;

  const [mode, setMode] = useState<"login" | "register">(searchParams.get("mode") === "register" ? "register" : "login");
  const selectedPlan = searchParams.get("plan");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(searchParams.get("mode") === "register" ? "register" : "login");
  }, [searchParams]);

  useEffect(() => {
    setIsStandaloneRuntime(isStandaloneAppRuntime());
  }, []);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  const handleCredentialLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setError("Email hoặc mật khẩu không đúng.");
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Đăng ký thất bại.");
        setLoading(false);
        return;
      }

      const loginResult = await signIn("credentials", { email, password, redirect: false });
      if (loginResult?.error) {
        setError("Đăng ký thành công nhưng đăng nhập tự động lỗi. Vui lòng đăng nhập lại.");
        setMode("login");
        setLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại.");
      setLoading(false);
    }
  };

  const inputStyle = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    "--tw-ring-color": "rgba(46,77,61,0.22)",
  } as CSSProperties;

  const inputClass = "w-full rounded-xl py-3 pl-11 pr-4 text-sm outline-none transition focus:ring-2";

  return (
    <AuthPageShell compactApp={isAppMode}>
      <div className="rounded-[2rem] border p-5 shadow-sm sm:p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="mb-5 flex rounded-2xl border p-1" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          {(["login", "register"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setMode(item);
                setError(null);
              }}
              className="flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition"
              style={
                mode === item
                  ? { background: "var(--surface)", color: "var(--text-primary)", boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }
                  : { color: "var(--text-muted)" }
              }
            >
              {item === "login" ? "Đăng nhập" : "Đăng ký"}
            </button>
          ))}
        </div>

        <div className="mb-5 rounded-2xl border p-4" style={{ background: "var(--primary-light)", borderColor: "var(--border)" }}>
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--primary)" }} />
            <div>
              <p className="font-bold">Sau khi đăng nhập</p>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                Bạn có thể mở {PRODUCT_NAMES.dashboard}, xem cơ hội từ {PRODUCT_NAMES.brokerWorkflow}, theo dõi {PRODUCT_NAMES.art} và dùng
                các công cụ nâng cao khi tài khoản đủ điều kiện.
              </p>
              {selectedPlan && (
                <p className="mt-2 text-xs font-semibold" style={{ color: "var(--primary)" }}>
                  Gói đang chọn: {selectedPlan.toUpperCase()}
                </p>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          disabled={loading}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition disabled:opacity-50"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <span aria-hidden="true" className="text-base">
            G
          </span>
          Tiếp tục với Google
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
            hoặc
          </span>
          <div className="h-px flex-1" style={{ background: "var(--border)" }} />
        </div>

        <form onSubmit={mode === "login" ? handleCredentialLogin : handleRegister}>
          {mode === "register" && (
            <div className="mb-3">
              <label htmlFor="name" className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Họ và tên
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input id="name" type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nguyễn Văn A" className={inputClass} style={inputStyle} />
              </div>
            </div>
          )}

          <div className="mb-3">
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@example.com" required className={inputClass} style={inputStyle} />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "register" ? "Tối thiểu 6 ký tự" : "••••••••"}
                required
                minLength={mode === "register" ? 6 : undefined}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl p-3 text-sm" style={{ background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.20)", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition disabled:opacity-50"
            style={{ background: "var(--primary)", color: "#EBE2CF" }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? `Đăng nhập vào ${BRAND.name}` : `Tạo tài khoản ${BRAND.name}`}
          </button>
        </form>

        <div className="mt-5 rounded-2xl border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <p className="mb-3 text-sm font-bold">Quy trình sử dụng an toàn</p>
          <div className="space-y-2">
            {safeUseSteps.map((step) => (
              <div key={step} className="flex gap-2 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-5 text-center text-xs leading-5" style={{ color: "var(--text-muted)" }}>
          Cần hỗ trợ? Liên hệ ADN Capital qua Telegram/Zalo chính thức. ADN Capital không yêu cầu OTP, mật khẩu giao dịch hoặc mã xác nhận qua chat.
        </p>
      </div>
    </AuthPageShell>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <AuthPageContent />
    </Suspense>
  );
}

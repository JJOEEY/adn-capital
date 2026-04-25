"use client";

import { Suspense, useEffect, useState } from "react";
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

const benefits = [
  {
    icon: LayoutDashboard,
    title: "Dashboard thị trường",
    body: "Theo dõi VNINDEX, thanh khoản, độ rộng thị trường, bản tin sáng, tổng kết cuối ngày và các cơ hội mới trong cùng một màn hình.",
  },
  {
    icon: Bot,
    title: "ADN AI Broker",
    body: "Xem mã cổ phiếu đáng chú ý, vùng giá tham khảo, trạng thái theo dõi và cảnh báo rủi ro trước khi ra quyết định.",
  },
  {
    icon: WalletCards,
    title: "Quy trình có kiểm soát",
    body: "Các thao tác quan trọng luôn có bước kiểm tra và xác nhận rõ ràng. ADN không tự động giao dịch thay nhà đầu tư.",
  },
];

const brokerSteps = [
  "Đăng nhập ADN để mở dashboard và bộ công cụ phân tích.",
  "Theo dõi thị trường, cơ hội và cảnh báo rủi ro trong cùng một tài khoản.",
  "Mọi thao tác nhạy cảm đều cần xác nhận của nhà đầu tư; hệ thống không tự ý thực hiện giao dịch.",
];

function AuthPageShell({ children }: { children: React.ReactNode }) {
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
          <div
            className="absolute -left-20 -top-24 h-64 w-64 rounded-full blur-3xl"
            style={{ background: "rgba(46,77,61,0.16)" }}
          />
          <div
            className="relative rounded-[2rem] border p-6 sm:p-8 lg:p-10"
            style={{
              background: "linear-gradient(145deg, var(--surface), var(--surface-2))",
              borderColor: "var(--border)",
            }}
          >
            <div className="mb-8 flex items-center gap-3">
              <Image src="/brand/favicon.png" alt="ADN Capital" width={56} height={56} className="rounded-2xl" priority />
              <div>
                <p className="text-sm font-bold tracking-[0.28em]" style={{ color: "var(--primary)" }}>
                  ADN CAPITAL
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  AI-powered investment platform
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
              Đăng nhập để mở dashboard ADN Capital
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 sm:text-lg" style={{ color: "var(--text-secondary)" }}>
              Một điểm vào cho dashboard thị trường, ADN AI Broker, ART và các cảnh báo quan trọng. AI hỗ trợ phân tích
              và giải thích, còn quyết định cuối cùng luôn thuộc về nhà đầu tư.
            </p>

            <div className="mt-8 grid gap-3">
              {benefits.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border p-4"
                    style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                  >
                    <div className="flex gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                      >
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
                Xem demo read-only
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

        <motion.section
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="relative"
        >
          {children}
        </motion.section>
      </div>
    </main>
  );
}

function AuthPageSkeleton() {
  return (
    <AuthPageShell>
      <div
        className="rounded-[2rem] border p-6"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
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

  const [mode, setMode] = useState<"login" | "register">(
    searchParams.get("mode") === "register" ? "register" : "login",
  );
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
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Email hoặc mật khẩu không đúng.");
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Đăng ký thất bại.");
        setLoading(false);
        return;
      }

      const loginResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        setError("Đăng ký thành công nhưng đăng nhập tự động lỗi. Vui lòng đăng nhập lại.");
        setMode("login");
        setLoading(false);
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  const inputCls = "w-full rounded-xl py-3 pl-11 pr-4 text-sm outline-none transition focus:ring-2";
  const inputStyle = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    ["--tw-ring-color" as string]: "rgba(46,77,61,0.22)",
  };

  return (
    <AuthPageShell>
      <div
        className="rounded-[2rem] border p-5 shadow-sm sm:p-6"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
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

        <div
          className="mb-5 rounded-2xl border p-4"
          style={{ background: "var(--primary-light)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--primary)" }} />
            <div>
              <p className="font-bold">Sau khi đăng nhập</p>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                Bạn có thể mở dashboard, xem cơ hội từ ADN AI Broker, theo dõi ART và dùng các công cụ nâng cao khi tài khoản đủ điều kiện.
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
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition disabled:opacity-50"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
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
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          <div className="mb-3">
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className={inputCls}
                style={inputStyle}
              />
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "Tối thiểu 6 ký tự" : "••••••••"}
                required
                minLength={mode === "register" ? 6 : undefined}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div
              className="mb-4 rounded-xl p-3 text-sm"
              style={{ background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.20)", color: "var(--danger)" }}
            >
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
            {mode === "login" ? "Đăng nhập vào dashboard" : "Tạo tài khoản ADN"}
          </button>
        </form>

        <div className="mt-5 rounded-2xl border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <p className="mb-3 text-sm font-bold">Quy trình sử dụng an toàn</p>
          <div className="space-y-2">
            {brokerSteps.map((step) => (
              <div key={step} className="flex gap-2 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-5 text-center text-xs leading-5" style={{ color: "var(--text-muted)" }}>
          Cần hỗ trợ? Liên hệ ADN Capital qua Telegram/Zalo chính thức. ADN không yêu cầu OTP, mật khẩu giao dịch hoặc mã xác nhận qua chat.
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

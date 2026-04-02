"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Loader2, Mail, Lock, User } from "lucide-react";

function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.jpg"
            alt="ADN Capital"
            width={64}
            height={64}
            className="rounded-2xl mb-4"
          />
          <h1 className="text-2xl font-black text-white">ADN Capital</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Khổng Minh của VNINDEX
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          {children}
        </div>

        <p className="text-[10px] text-neutral-600 text-center mt-6">
          Powered by <span className="text-emerald-500/70 font-bold">ADN CAPITAL</span>
        </p>
      </motion.div>
    </div>
  );
}

function AuthPageSkeleton() {
  return (
    <AuthPageShell>
      <div className="flex bg-neutral-800/80 border border-neutral-700 p-1 rounded-xl mb-6">
        <div className="flex-1 h-9 rounded-lg bg-neutral-700" />
        <div className="flex-1 h-9 rounded-lg" />
      </div>
      <div className="h-[420px] rounded-xl bg-neutral-800/50 animate-pulse" />
    </AuthPageShell>
  );
}

/**
 * Trang đăng nhập / đăng ký – NextAuth (local + Google).
 */
function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const [mode, setMode] = useState<"login" | "register">(
    searchParams.get("mode") === "register" ? "register" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(searchParams.get("mode") === "register" ? "register" : "login");
  }, [searchParams]);

  // Đã đăng nhập → chuyển về dashboard
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  // ── Đăng nhập bằng email/password ────────────────────────────────────
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
      setError("Email hoặc mật khẩu không đúng");
      setLoading(false);
    } else {
      router.replace("/dashboard");
    }
  };

  // ── Đăng ký tài khoản mới ────────────────────────────────────────────
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
        setError(data.error ?? "Đăng ký thất bại");
        setLoading(false);
        return;
      }

      // Đăng ký thành công → tự động đăng nhập
      const loginResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        setError("Đăng ký OK nhưng đăng nhập tự động lỗi. Vui lòng đăng nhập lại.");
        setMode("login");
        setLoading(false);
      } else {
        router.replace("/dashboard");
      }
    } catch {
      setError("Lỗi kết nối server");
      setLoading(false);
    }
  };

  // ── Đăng nhập bằng Google ────────────────────────────────────────────
  const handleGoogleLogin = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <AuthPageShell>
      {/* Tab Đăng nhập / Đăng ký */}
      <div className="flex bg-neutral-800/80 border border-neutral-700 p-1 rounded-xl mb-6">
        {(["login", "register"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => { setMode(item); setError(null); }}
            className={`flex-1 text-sm py-2 rounded-lg font-medium transition-all ${
              mode === item
                ? "bg-neutral-700 text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {item === "login" ? "Đăng nhập" : "Đăng ký"}
          </button>
        ))}
      </div>

      {/* Nút Google */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-800/80 border border-neutral-700 hover:bg-neutral-800 text-neutral-200 rounded-xl text-sm font-medium transition-all disabled:opacity-50 mb-4"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Tiếp tục với Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-neutral-800" />
        <span className="text-[10px] text-neutral-600 uppercase tracking-wide">hoặc</span>
        <div className="flex-1 h-px bg-neutral-800" />
      </div>

      {/* Form */}
      <form onSubmit={mode === "login" ? handleCredentialLogin : handleRegister}>
        {mode === "register" && (
          <div className="mb-3">
            <label className="block text-xs text-neutral-400 mb-1.5">Họ và tên</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-800/80 border border-neutral-700 text-neutral-100 rounded-xl text-sm outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className="block text-xs text-neutral-400 mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-800/80 border border-neutral-700 text-neutral-100 rounded-xl text-sm outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-neutral-400 mb-1.5">Mật khẩu</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Tối thiểu 6 ký tự" : "••••••••"}
              required
              minLength={mode === "register" ? 6 : undefined}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-800/80 border border-neutral-700 text-neutral-100 rounded-xl text-sm outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
        </div>

        {/* Lỗi */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>
      </form>

      <p className="text-[11px] text-neutral-600 text-center mt-4">
        {mode === "login" ? (
          <>
            Chưa có tài khoản?{" "}
            <button
              type="button"
              onClick={() => { setMode("register"); setError(null); }}
              className="text-emerald-400 hover:text-emerald-300"
            >
              Đăng ký ngay
            </button>
          </>
        ) : (
          <>
            Đã có tài khoản?{" "}
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); }}
              className="text-emerald-400 hover:text-emerald-300"
            >
              Đăng nhập
            </button>
          </>
        )}
      </p>
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

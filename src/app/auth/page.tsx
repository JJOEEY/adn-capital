"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Loader2, Mail, Lock, User } from "lucide-react";

function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--page-surface)" }}>
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
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>ADN Capital</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Khổng Minh của VNINDEX
          </p>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {children}
        </div>

        <p className="text-[12px] text-center mt-6" style={{ color: "var(--text-muted)" }}>
          Powered by <span style={{ color: "var(--primary)", fontWeight: "bold" }}>ADN CAPITAL</span>
        </p>
      </motion.div>
    </div>
  );
}

function AuthPageSkeleton() {
  return (
    <AuthPageShell>
      <div
        className="flex p-1 rounded-xl mb-6"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <div className="flex-1 h-9 rounded-lg" style={{ background: "var(--bg-hover)" }} />
        <div className="flex-1 h-9 rounded-lg" />
      </div>
      <div className="h-[420px] rounded-xl animate-pulse" style={{ background: "var(--surface-2)" }} />
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
      setError("Email hoặc mật khẩu không đúng");
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
        setError(data.error ?? "Đăng ký thất bại");
        setLoading(false);
        return;
      }

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
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Lỗi kết nối server");
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  const inputCls = "w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all";
  const inputStyle = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  };

  return (
    <AuthPageShell>
      {/* Tab Đăng nhập / Đăng ký */}
      <div
        className="flex p-1 rounded-xl mb-6"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {(["login", "register"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => { setMode(item); setError(null); }}
            className={`flex-1 text-sm py-2 rounded-lg font-medium transition-all ${
              mode === item ? "shadow-sm" : ""
            }`}
            style={
              mode === item
                ? { background: "var(--bg-hover)", color: "var(--text-primary)" }
                : { color: "var(--text-muted)" }
            }
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
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all disabled:opacity-50 mb-4 cursor-pointer"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Tiếp tục với Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <span className="text-[12px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>hoặc</span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* Form */}
      <form onSubmit={mode === "login" ? handleCredentialLogin : handleRegister}>
        {mode === "register" && (
          <div className="mb-3">
            <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Họ và tên</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A" className={inputCls} style={inputStyle}
              />
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com" required className={inputCls} style={inputStyle}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Mật khẩu</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Tối thiểu 6 ký tự" : "••••••••"}
              required minLength={mode === "register" ? 6 : undefined} className={inputCls} style={inputStyle}
            />
          </div>
        </div>

        {/* Lỗi */}
        {error && (
          <div
            className="mb-4 p-3 rounded-xl text-xs"
            style={{ background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.20)", color: "var(--danger)" }}
          >
            {error}
          </div>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full py-2.5 font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          style={{ background: "var(--primary)", color: "#EBE2CF" }}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>
      </form>

      <p className="text-[11px] text-center mt-4" style={{ color: "var(--text-muted)" }}>
        {mode === "login" ? (
          <>
            Chưa có tài khoản?{" "}
            <button
              type="button" onClick={() => { setMode("register"); setError(null); }}
              className="hover:underline" style={{ color: "var(--primary)" }}
            >
              Đăng ký ngay
            </button>
          </>
        ) : (
          <>
            Đã có tài khoản?{" "}
            <button
              type="button" onClick={() => { setMode("login"); setError(null); }}
              className="hover:underline" style={{ color: "var(--primary)" }}
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

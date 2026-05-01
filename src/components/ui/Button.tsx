import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "purple" | "yellow";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(180deg, var(--primary-hover), var(--primary))",
    color: "var(--on-primary)",
    borderColor: "transparent",
    boxShadow: "0 14px 34px -22px var(--glow-primary)",
  },
  secondary: { background: "var(--surface-2)", color: "var(--text-secondary)", borderColor: "var(--border)" },
  danger: { background: "rgba(192,57,43,0.10)", color: "var(--danger)", borderColor: "rgba(192,57,43,0.30)" },
  ghost: { background: "transparent", color: "var(--text-muted)", borderColor: "var(--border)" },
  purple: { background: "rgba(168,85,247,0.10)", color: "#a855f7", borderColor: "rgba(168,85,247,0.30)" },
  yellow: { background: "rgba(234,179,8,0.10)", color: "#eab308", borderColor: "rgba(234,179,8,0.30)" },
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-sm px-3 py-2 rounded-lg",
  md: "text-base px-4 py-2.5 rounded-xl font-medium",
  lg: "text-base px-6 py-3 rounded-xl font-medium",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 border transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        sizeClasses[size],
        className
      )}
      style={variantStyles[variant]}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

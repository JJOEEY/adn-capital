import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "purple" | "yellow";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-500 hover:bg-emerald-400 text-black font-semibold border-transparent shadow-emerald-500/20 shadow-md",
  secondary:
    "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700",
  danger:
    "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30",
  ghost:
    "bg-transparent hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border-neutral-800",
  purple:
    "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30",
  yellow:
    "bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
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
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

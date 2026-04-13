import { cn } from "@/lib/utils";

type BadgeVariant = "emerald" | "purple" | "yellow" | "red" | "blue" | "gray";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  emerald: { background: "rgba(22,163,74,0.10)", color: "#16a34a", borderColor: "rgba(22,163,74,0.25)" },
  purple: { background: "rgba(168,85,247,0.10)", color: "#a855f7", borderColor: "rgba(168,85,247,0.25)" },
  yellow: { background: "rgba(234,179,8,0.10)", color: "#eab308", borderColor: "rgba(234,179,8,0.25)" },
  red: { background: "rgba(192,57,43,0.10)", color: "var(--danger)", borderColor: "rgba(192,57,43,0.25)" },
  blue: { background: "rgba(59,130,246,0.10)", color: "#3b82f6", borderColor: "rgba(59,130,246,0.25)" },
  gray: { background: "var(--surface-2)", color: "var(--text-muted)", borderColor: "var(--border)" },
};

export function Badge({ variant = "gray", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border",
        className,
      )}
      style={variantStyles[variant]}
    >
      {children}
    </span>
  );
}

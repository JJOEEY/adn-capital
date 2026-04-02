import { cn } from "@/lib/utils";

type BadgeVariant = "emerald" | "purple" | "yellow" | "red" | "blue" | "gray";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/25",
  yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25",
  red: "bg-red-500/10 text-red-400 border-red-500/25",
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/25",
  gray: "bg-neutral-800 text-neutral-400 border-neutral-700",
};

export function Badge({ variant = "gray", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

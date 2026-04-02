import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
  glass?: boolean;
  glow?: "emerald" | "purple" | "yellow" | "red";
}

export function Card({ className, children, glass, glow }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border",
        glass
          ? "bg-neutral-900/50 backdrop-blur-sm border-neutral-800/50"
          : "bg-neutral-900 border-neutral-800",
        glow === "emerald" && "shadow-emerald-500/10 shadow-lg border-emerald-500/20",
        glow === "purple" && "shadow-purple-500/10 shadow-lg border-purple-500/20",
        glow === "yellow" && "shadow-yellow-500/10 shadow-lg border-yellow-500/20",
        glow === "red" && "shadow-red-500/10 shadow-lg border-red-500/20",
        className
      )}
    >
      {children}
    </div>
  );
}

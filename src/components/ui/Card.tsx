import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-soft", className)}>{children}</section>;
}

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  href?: string;
  children: ReactNode;
};

export function Button({ className, variant = "primary", href, children, ...props }: ButtonProps) {
  const classes = cn(
    "inline-flex min-h-[46px] items-center justify-center rounded-full px-[18px] py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
    variant === "primary" && "bg-action text-white shadow-soft hover:bg-[#14532d]",
    variant === "secondary" && "border border-line bg-white text-[#14532d] hover:bg-[#f3faf4]",
    variant === "danger" && "bg-danger text-white hover:bg-red-700",
    variant === "ghost" && "text-[#14532d] hover:bg-[#dcfce7]",
    className
  );

  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

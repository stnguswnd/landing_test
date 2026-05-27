import { cn } from "@/lib/utils";

const toneClasses = {
  blue: "bg-[#dcfce7] text-[#14532d]",
  green: "bg-[#dcfce7] text-[#14532d]",
  yellow: "bg-yellow-50 text-yellow-800",
  red: "bg-red-50 text-red-700",
  purple: "bg-[#e8f6eb] text-[#14532d]",
  gray: "bg-slate-100 text-slate-700"
};

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: keyof typeof toneClasses }) {
  return <span className={cn("inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold", toneClasses[tone])}>{children}</span>;
}

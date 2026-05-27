import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/lib/auth/actions";

export function StudentLayout({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="student-shell">
      <header className="fixed inset-x-0 top-0 z-[60] border-b border-line bg-white/95 px-4 py-3 backdrop-blur-xl">
        <div className="student-container flex h-[54px] items-center justify-between">
          <Link href="/student/home" className="text-lg font-extrabold tracking-[-0.03em] text-[#14532d]">
            Janetimes Studio
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/student/home" className="rounded-full px-3 py-2 text-sm font-bold text-[#14532d] hover:bg-[#dcfce7]">
              과제 목록
            </Link>
            <span className="hidden rounded-full bg-[#dcfce7] px-3 py-1 text-sm font-bold text-[#14532d] md:inline">{title}</span>
            <form action={logoutAction}>
              <button className="rounded-full border border-line bg-white px-3 py-2 text-sm font-bold text-[#14532d] hover:bg-[#f3faf4]">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="student-container pb-10 pt-6 md:pb-14">{children}</main>
    </div>
  );
}

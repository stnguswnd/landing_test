import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/lib/auth/actions";

const nav = [
  ["대시보드", "/teacher/dashboard"],
  ["반 관리", "/teacher/classes"],
  ["학생 관리", "/teacher/students"],
  ["숙제 관리", "/teacher/assignments"],
  ["계정 설정", "/teacher/settings/account"],
  ["저장소", "/teacher/classes/inactive"],
];

export function TeacherLayout({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex max-w-[1600px] flex-col md:flex-row">
        <aside className="border-b border-line bg-white p-4 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
          <Link href="/teacher/dashboard" className="block text-lg font-bold">
            Janetimes Studio
          </Link>
          <nav className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-1">
            {nav.map(([label, href]) => (
              <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-action">강사 모드</p>
              <h1 className="text-2xl font-bold tracking-normal md:text-3xl">{title}</h1>
            </div>
            <form action={logoutAction}>
              <button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                로그아웃
              </button>
            </form>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

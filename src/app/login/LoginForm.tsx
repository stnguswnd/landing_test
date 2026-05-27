"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function getCookie(name: string) {
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function redirectIfAlreadyAuthenticated() {
  const role = getCookie("homework_role");
  if (role === "teacher") {
    window.location.replace("/teacher/dashboard");
  }
  if (role === "student") {
    window.location.replace("/student/home");
  }
}

export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    redirectIfAlreadyAuthenticated();

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        redirectIfAlreadyAuthenticated();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: String(formData.get("loginId") ?? "").trim(),
          password: String(formData.get("password") ?? ""),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }

      window.location.replace(data.destination ?? "/login");
    });
  }

  return (
    <div className="grid gap-4">
      <form action={submit} className="grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          아이디
          <Input name="loginId" autoComplete="username" placeholder="아이디를 입력하세요" required />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          비밀번호
          <Input name="password" type="password" autoComplete="current-password" placeholder="비밀번호를 입력하세요" required />
        </label>
        {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
        <Button type="submit" className="min-h-12 text-base" disabled={pending}>
          {pending ? "로그인 중..." : "로그인"}
        </Button>
      </form>
    </div>
  );
}

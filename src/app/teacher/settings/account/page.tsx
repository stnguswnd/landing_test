"use client";

import { FormEvent, useEffect, useState } from "react";

import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { Button } from "@/components/ui/Button";

type AccountState = {
  username: string;
  displayName: string;
  email: string;
};

const emptyAccount: AccountState = {
  username: "",
  displayName: "",
  email: "",
};

export default function TeacherAccountSettingsPage() {
  const [account, setAccount] = useState<AccountState>(emptyAccount);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      setIsLoading(true);
      const response = await fetch("/api/teacher/account", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (cancelled) return;

      if (!response.ok) {
        setAccountMessage(data?.error ?? "계정 정보를 불러오지 못했습니다.");
      } else {
        setAccount({
          username: data.username ?? "",
          displayName: data.displayName ?? "",
          email: data.email ?? "",
        });
      }
      setIsLoading(false);
    }

    loadAccount();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingAccount(true);
    setAccountMessage("");

    const response = await fetch("/api/teacher/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setAccountMessage(data?.error ?? "계정 정보를 저장하지 못했습니다.");
    } else {
      setAccount(data);
      setAccountMessage("계정 정보가 저장되었습니다.");
    }
    setIsSavingAccount(false);
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingPassword(true);
    setPasswordMessage("");

    const response = await fetch("/api/teacher/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(passwordForm),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setPasswordMessage(data?.error ?? "비밀번호를 변경하지 못했습니다.");
    } else {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordMessage("비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.");
    }
    setIsSavingPassword(false);
  }

  return (
    <TeacherLayout title="계정 설정">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-ink">기본 정보</h2>
            <p className="mt-1 text-sm text-slate-500">로그인 아이디, 이름, 이메일을 관리합니다.</p>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-500">계정 정보를 불러오는 중입니다.</p>
          ) : (
            <form className="grid gap-4" onSubmit={saveAccount}>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                로그인 아이디
                <input
                  className="min-h-10 rounded-md border border-line px-3 text-sm outline-none focus:border-action focus:ring-2 focus:ring-blue-100"
                  value={account.username}
                  onChange={(event) => setAccount((prev) => ({ ...prev, username: event.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                이름
                <input
                  className="min-h-10 rounded-md border border-line px-3 text-sm outline-none focus:border-action focus:ring-2 focus:ring-blue-100"
                  value={account.displayName}
                  onChange={(event) => setAccount((prev) => ({ ...prev, displayName: event.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                이메일
                <input
                  className="min-h-10 rounded-md border border-line px-3 text-sm outline-none focus:border-action focus:ring-2 focus:ring-blue-100"
                  type="email"
                  value={account.email}
                  onChange={(event) => setAccount((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>

              {accountMessage && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{accountMessage}</p>}

              <div className="flex justify-end">
                <Button type="submit" disabled={isSavingAccount}>
                  {isSavingAccount ? "저장 중..." : "기본 정보 저장"}
                </Button>
              </div>
            </form>
          )}
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-ink">비밀번호 변경</h2>
            <p className="mt-1 text-sm text-slate-500">초기 비밀번호를 받았다면 로그인 후 바로 변경하세요.</p>
          </div>

          <form className="grid gap-4" onSubmit={savePassword}>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              현재 비밀번호
              <input
                className="min-h-10 rounded-md border border-line px-3 text-sm outline-none focus:border-action focus:ring-2 focus:ring-blue-100"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              새 비밀번호
              <input
                className="min-h-10 rounded-md border border-line px-3 text-sm outline-none focus:border-action focus:ring-2 focus:ring-blue-100"
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              새 비밀번호 확인
              <input
                className="min-h-10 rounded-md border border-line px-3 text-sm outline-none focus:border-action focus:ring-2 focus:ring-blue-100"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              />
            </label>

            {passwordMessage && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{passwordMessage}</p>}

            <div className="flex justify-end">
              <Button type="submit" disabled={isSavingPassword}>
                {isSavingPassword ? "변경 중..." : "비밀번호 변경"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </TeacherLayout>
  );
}

"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { signupAction } from "@/lib/auth/actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, {});

  return (
    <form action={formAction} className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        권한
        <Select name="role" defaultValue="student" required>
          <option value="student">학생</option>
          <option value="parent">부모님</option>
        </Select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        이름
        <Input name="displayName" autoComplete="name" placeholder="홍길동" required />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        아이디
        <Input name="username" autoComplete="username" placeholder="my-id" required />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        비밀번호
        <Input name="password" type="password" autoComplete="new-password" minLength={8} placeholder="8자 이상" required />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        학생 로그인 ID
        <Input name="studentLoginId" placeholder="학생/부모님 계정만 입력" />
      </label>
      <p className="text-xs leading-relaxed text-slate-500">
        공개 회원가입은 지원하지 않습니다. 강사 계정은 개발자/관리자가 발급하고, 학생과 부모님 계정은 강사가 앱에서 발급합니다.
      </p>
      {state.error ? <p className="text-sm font-semibold text-danger">{state.error}</p> : null}
      <Button type="submit" className="min-h-12 text-base" disabled={pending}>
        {pending ? "가입 중..." : "회원가입"}
      </Button>
    </form>
  );
}

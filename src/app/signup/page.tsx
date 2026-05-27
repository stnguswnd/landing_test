import Link from "next/link";
import { redirect } from "next/navigation";

import { SignupForm } from "@/app/signup/SignupForm";
import { Card } from "@/components/ui/Card";
import { getCurrentUser, getDestinationForRole } from "@/lib/auth/session";

export default async function SignupPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(getDestinationForRole(user.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <Card className="w-full max-w-md">
        <div className="mb-6">
          <p className="text-sm font-semibold text-action">Janetimes Studio</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">회원가입</h1>
          <p className="mt-2 text-sm text-slate-600">
            권한에 따라 로그인 후 이동하는 화면이 달라집니다.
          </p>
        </div>
        <SignupForm />
        <p className="mt-4 text-center text-sm text-slate-600">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-semibold text-action">
            로그인
          </Link>
        </p>
      </Card>
    </main>
  );
}

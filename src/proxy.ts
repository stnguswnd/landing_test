import { NextResponse, type NextRequest } from "next/server";

const sessionCookieName = "homework_session";
const studentSessionCookieName = "homework_student_session";
const roleCookieName = "homework_role";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionId = request.cookies.get(sessionCookieName)?.value;
  const studentSessionId = request.cookies.get(studentSessionCookieName)?.value;
  const role = request.cookies.get(roleCookieName)?.value;

  if (pathname.startsWith("/login") && (sessionId || studentSessionId)) {
    return NextResponse.redirect(new URL(role === "teacher" ? "/teacher/dashboard" : "/student/home", request.url));
  }

  if (pathname.startsWith("/teacher")) {
    if (!sessionId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (role !== "teacher") {
      return NextResponse.redirect(new URL("/student/home", request.url));
    }
  }

  if (pathname.startsWith("/api/teacher")) {
    if (!sessionId || role !== "teacher") {
      return NextResponse.json({ error: "강사 로그인이 필요합니다." }, { status: 401 });
    }
  }

  if (pathname.startsWith("/student")) {
    if (!sessionId && !studentSessionId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (role === "teacher") {
      return NextResponse.redirect(new URL("/teacher/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/signup", "/teacher/:path*", "/student/:path*", "/api/teacher/:path*"],
};

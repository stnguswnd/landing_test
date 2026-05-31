import { NextResponse, type NextRequest } from "next/server";

const sessionCookieName = "homework_session";
const studentSessionCookieName = "homework_student_session";
const roleCookieName = "homework_role";

function loggedInDestination(sessionId?: string, studentSessionId?: string, role?: string) {
  if (studentSessionId || role === "student") return "/student/home";
  if (sessionId || role === "teacher") return "/teacher/dashboard";
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionId = request.cookies.get(sessionCookieName)?.value;
  const studentSessionId = request.cookies.get(studentSessionCookieName)?.value;
  const role = request.cookies.get(roleCookieName)?.value;
  const destination = loggedInDestination(sessionId, studentSessionId, role);

  if ((pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/signup")) && destination) {
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (pathname.startsWith("/teacher")) {
    if (!sessionId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (studentSessionId || role === "student") {
      return NextResponse.redirect(new URL("/student/home", request.url));
    }
  }

  if (pathname.startsWith("/api/teacher")) {
    if (!sessionId || studentSessionId || role === "student") {
      return NextResponse.json({ error: "강사 로그인이 필요합니다." }, { status: 401 });
    }
  }

  if (pathname.startsWith("/student")) {
    if (!sessionId && !studentSessionId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if ((sessionId && !studentSessionId) || role === "teacher") {
      return NextResponse.redirect(new URL("/teacher/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup", "/teacher/:path*", "/student/:path*", "/api/teacher/:path*"],
};

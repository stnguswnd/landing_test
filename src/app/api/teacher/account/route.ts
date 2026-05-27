import { NextResponse } from "next/server";

import { postgresPool, query } from "@/lib/postgres";
import { requireTeacherSession, TeacherSessionError } from "@/server/teacher/session";

export const runtime = "nodejs";

type AccountRow = {
  username: string;
  display_name: string;
  email: string;
};

function sessionErrorResponse(error: unknown) {
  if (error instanceof TeacherSessionError) {
    return NextResponse.json({ error: "강사 로그인이 필요합니다." }, { status: 401 });
  }
  return null;
}

export async function GET() {
  try {
    const session = await requireTeacherSession();
    const result = await query<AccountRow>(
      `
        select u.username, t.display_name, t.email
        from teachers t
        join app_users u on u.id = t.app_user_id
        where t.id = $1
        limit 1
      `,
      [session.teacherId],
    );
    const account = result.rows[0];

    if (!account) {
      return NextResponse.json({ error: "강사 계정을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      username: account.username,
      displayName: account.display_name,
      email: account.email,
    });
  } catch (error) {
    return sessionErrorResponse(error) ?? NextResponse.json({ error: "계정 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireTeacherSession();
    const body = (await request.json().catch(() => null)) as { username?: string; displayName?: string; email?: string } | null;
    const username = body?.username?.trim();
    const displayName = body?.displayName?.trim();
    const email = body?.email?.trim().toLowerCase();

    if (!username) return NextResponse.json({ error: "로그인 아이디를 입력해주세요." }, { status: 400 });
    if (!displayName) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
    if (!email) return NextResponse.json({ error: "이메일을 입력해주세요." }, { status: 400 });

    const client = await postgresPool.connect();
    try {
      await client.query("begin");

      const teacherResult = await client.query<{ app_user_id: string }>(
        "select app_user_id from teachers where id = $1 limit 1",
        [session.teacherId],
      );
      const appUserId = teacherResult.rows[0]?.app_user_id;
      if (!appUserId) {
        await client.query("rollback");
        return NextResponse.json({ error: "강사 계정을 찾을 수 없습니다." }, { status: 404 });
      }

      const usernameConflict = await client.query("select id from app_users where username = $1 and id <> $2 limit 1", [username, appUserId]);
      if (usernameConflict.rowCount) {
        await client.query("rollback");
        return NextResponse.json({ error: "이미 사용 중인 로그인 아이디입니다." }, { status: 409 });
      }

      const emailConflict = await client.query("select id from teachers where lower(email) = lower($1) and id <> $2 limit 1", [email, session.teacherId]);
      if (emailConflict.rowCount) {
        await client.query("rollback");
        return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
      }

      await client.query("update app_users set username = $1, display_name = $2, updated_at = now() where id = $3", [
        username,
        displayName,
        appUserId,
      ]);
      await client.query("update teachers set email = $1, display_name = $2, updated_at = now() where id = $3", [
        email,
        displayName,
        session.teacherId,
      ]);

      await client.query("commit");
      return NextResponse.json({ username, displayName, email });
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return sessionErrorResponse(error) ?? NextResponse.json({ error: "계정 정보를 저장하지 못했습니다." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { query } from "@/lib/postgres";
import { studentAssignmentRepository } from "@/features/assignments/repositories/studentAssignmentRepository";
import { getStudentCalendarEvents, getStudentTestResults, getStudentUpcomingTests, getStudentVisibleNotices } from "@/lib/dashboardData";
import { getStudentSession } from "@/server/auth/studentSession";

export const runtime = "nodejs";

export async function GET() {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "학생 로그인이 필요합니다." }, { status: 401 });

  const profileResult = await query(
    `
      select s.name, coalesce(array_remove(array_agg(c.name order by c.name), null), array[]::text[]) as class_names
      from students s
      left join class_memberships cm on cm.student_id = s.id
      left join classes c on c.id = cm.class_id and c.teacher_id = s.teacher_id
      where s.id = $1 and s.teacher_id = $2
      group by s.id
    `,
    [session.studentId, session.teacherId],
  );
  const start = "2026-05-01";
  const end = "2026-06-07";
  const [notices, weeklyHomework, calendarEvents, upcomingTests, testResults] = await Promise.all([
    getStudentVisibleNotices(session.studentId, session.teacherId),
    studentAssignmentRepository.getAssignmentsForStudent(session.studentId, session.teacherId),
    getStudentCalendarEvents(session.studentId, session.teacherId, start, end),
    getStudentUpcomingTests(session.studentId, session.teacherId),
    getStudentTestResults(session.studentId, session.teacherId),
  ]);

  return NextResponse.json({
    notices,
    profile: {
      studentId: session.studentId,
      name: profileResult.rows[0]?.name ?? "학생",
      classNames: profileResult.rows[0]?.class_names ?? [],
    },
    weeklyHomework,
    calendarEvents,
    upcomingTests,
    testResults,
  });
}

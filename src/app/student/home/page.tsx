import { redirect } from "next/navigation";

import { StudentLayout } from "@/components/layout/StudentLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { studentAssignmentRepository } from "@/features/assignments/repositories/studentAssignmentRepository";
import { getStudentCalendarEvents, getStudentTestResults, getStudentUpcomingTests, getStudentVisibleNotices } from "@/lib/dashboardData";
import { formatTimeRange } from "@/lib/calendarTypes";
import { assignmentTypeLabel as formatAssignmentTypeLabel } from "@/lib/assignmentTypes";
import { query } from "@/lib/postgres";
import { getStudentSession } from "@/server/auth/studentSession";

import { StudentCalendarClient, type StudentCalendarEvent } from "./StudentCalendarClient";
import { StudentNoticeCarousel } from "./StudentNoticeCarousel";

type AssignmentWithTarget = Awaited<ReturnType<typeof studentAssignmentRepository.getAssignmentsForStudent>>[number] & {
  targetStatus?: string;
};

type StudentProfileRow = {
  name: string;
  class_names: string[];
};

type Notice = {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  targetType?: string;
};

type UpcomingTest = {
  id: string;
  title: string;
  subject: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  scope: string;
};

type TestResult = {
  id: string;
  title: string;
  subject: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  score: number | null;
  result: "PASS" | "NonPASS";
  teacherMemo: string | null;
};

function assignmentTypeLabel(type: string) {
  return formatAssignmentTypeLabel(type);
}

function subjectForAssignment(assignment: AssignmentWithTarget) {
  return assignment.assignmentSubject ?? "Phonics";
}

function homeworkStatus(assignment: AssignmentWithTarget) {
  if (assignment.targetStatus === "reviewed" || assignment.targetStatus === "completed") return "completed";
  if (assignment.targetStatus === "returned") return "returned";
  if (assignment.submittedAt || assignment.targetStatus === "submitted" || assignment.targetStatus === "pending_review") return "pending_review";
  return "incomplete";
}

function homeworkStatusLabel(status: string) {
  if (status === "pending_review") return "검토대기중";
  if (status === "completed") return "숙제완료";
  if (status === "returned") return "반려";
  return "미완료";
}

function homeworkStatusTone(status: string): "green" | "yellow" | "red" | "gray" {
  if (status === "pending_review") return "yellow";
  if (status === "completed") return "green";
  if (status === "returned") return "red";
  return "gray";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(value));
}

async function getStudentProfile(studentId: string, teacherId: string) {
  const result = await query<StudentProfileRow>(
    `
      select
        s.name,
        coalesce(array_remove(array_agg(c.name order by c.name), null), array[]::text[]) as class_names
      from students s
      left join class_memberships cm on cm.student_id = s.id
      left join classes c on c.id = cm.class_id and c.teacher_id = s.teacher_id and c.status = 'active'
      where s.id = $1 and s.teacher_id = $2
      group by s.id
    `,
    [studentId, teacherId],
  );
  return result.rows[0] ?? { name: "학생", class_names: [] };
}

export default async function StudentHomePage() {
  const session = await getStudentSession();

  if (!session) {
    redirect("/login");
  }

  const [assignments, profile, notices, calendarEvents, upcomingTests, testResults] = await Promise.all([
    studentAssignmentRepository.getAssignmentsForStudent(session.studentId, session.teacherId) as Promise<AssignmentWithTarget[]>,
    getStudentProfile(session.studentId, session.teacherId),
    getStudentVisibleNotices(session.studentId, session.teacherId) as Promise<Notice[]>,
    getStudentCalendarEvents(session.studentId, session.teacherId, "2026-05-01", "2026-06-07") as Promise<StudentCalendarEvent[]>,
    getStudentUpcomingTests(session.studentId, session.teacherId) as Promise<UpcomingTest[]>,
    getStudentTestResults(session.studentId, session.teacherId) as Promise<TestResult[]>,
  ]);

  return (
    <StudentLayout title="학생 홈">
      <div className="grid gap-8">
        <StudentTeamHeader studentName={profile.name} classNames={profile.class_names} assignments={assignments} upcomingTest={upcomingTests[0]} />
        <StudentNoticeCarousel notices={notices} />
        <WeeklyHomeworkSection assignments={assignments} />
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <StudentCalendarClient events={calendarEvents} />
          <TestResultSection upcomingTests={upcomingTests} results={testResults} />
        </div>
      </div>
    </StudentLayout>
  );
}

function StudentTeamHeader({
  studentName,
  classNames,
  assignments,
  upcomingTest,
}: {
  studentName: string;
  classNames: string[];
  assignments: AssignmentWithTarget[];
  upcomingTest?: UpcomingTest;
}) {
  const incompleteCount = assignments.filter((assignment) => homeworkStatus(assignment) === "incomplete" || homeworkStatus(assignment) === "returned").length;
  return (
    <section className="student-hero-panel px-5 py-7 text-white md:px-8 md:py-10">
      <div className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
        <div>
          <span className="inline-flex w-fit rounded-full bg-white/18 px-4 py-2 text-sm font-bold text-[#dcfce7] ring-1 ring-white/25">
            {classNames[0] ?? "배정된 반 없음"}
          </span>
          <h1 className="mt-5 max-w-2xl text-[clamp(2.2rem,7vw,4.2rem)] font-bold leading-[1.25] tracking-[-0.04em]">
            {studentName} 학생의 오늘 학습을 확인해요
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#dcfce7] md:text-lg">
            Enjoy & Beyond! janetimes english 에서 즐겁게 성장해보아요
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <HeroMetric label="진행할 숙제" value={`${incompleteCount}개`} />
          <HeroMetric label="전체 과제" value={`${assignments.length}개`} />
          <HeroMetric label="다음 시험" value={upcomingTest ? formatDate(upcomingTest.date) : "예정 없음"} />
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/18 bg-white/12 p-4 backdrop-blur">
      <p className="text-sm font-bold text-[#dcfce7]">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-[-0.03em]">{value}</p>
    </div>
  );
}

function WeeklyHomeworkSection({ assignments }: { assignments: AssignmentWithTarget[] }) {
  const weeklyAssignments = assignments.slice(0, 3);
  return (
    <section id="weekly-homework" className="student-section">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <Badge tone="green">Weekly Homework</Badge>
          <h2 className="mt-3 text-[clamp(1.9rem,3.8vw,3rem)] font-bold leading-[1.3]">이번주 숙제</h2>
          <p className="mt-2 text-base leading-7 text-[#5b655d]">이번 주에 해야 할 숙제를 확인하고 제출해 주세요.</p>
        </div>
      </div>
      {weeklyAssignments.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">이번주 숙제가 없습니다.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {weeklyAssignments.map((assignment) => (
            <HomeworkSubjectCard key={assignment.id} assignment={assignment} />
          ))}
        </div>
      )}
    </section>
  );
}

function HomeworkSubjectCard({ assignment }: { assignment: AssignmentWithTarget }) {
  const status = homeworkStatus(assignment);
  const item = assignment.items[0];
  const needsResubmit = assignment.targetStatus === "returned";
  const hasSubmitted = Boolean(assignment.submittedAt);
  const href = hasSubmitted && !needsResubmit ? `/student/assignments/${assignment.id}/complete` : `/student/assignments/${assignment.id}`;
  const buttonLabel = needsResubmit ? "다시 제출하기" : hasSubmitted ? "제출 내용 보기" : "숙제하기";
  const passageTitle = item?.title && item.title !== assignment.title ? item.title : "";

  return (
    <Card className="flex min-h-[300px] flex-col !p-2 sm:min-h-[340px]">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="blue">{subjectForAssignment(assignment)}</Badge>
          <Badge>{assignmentTypeLabel(assignment.assignmentType)}</Badge>
        </div>
        {assignment.dueAt && <Badge tone="yellow">마감 {formatDateTime(assignment.dueAt)}</Badge>}
      </div>
      <div className="mt-4 flex-1 sm:mt-5">
        <h3 className="text-base font-bold leading-[1.35] sm:text-2xl">{assignment.title}</h3>
        {passageTitle && (
          <div className="mt-2 rounded-[14px] border border-line bg-[#f3faf4] px-2.5 py-2 text-xs font-semibold text-[#5b655d] sm:mt-3 sm:px-3 sm:text-sm">
            {passageTitle}
          </div>
        )}
      </div>
      <div className="mt-4 rounded-[18px] bg-paper p-1 sm:mt-5 sm:p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold sm:text-sm">숙제 상태</span>
          <Badge tone={homeworkStatusTone(status)}>{homeworkStatusLabel(status)}</Badge>
        </div>
        {(status === "completed" || status === "returned") && assignment.teacherComment && (
          <p className="mt-2 text-sm leading-6 text-slate-700">선생님 메모: {assignment.teacherComment}</p>
        )}
        {assignment.submittedAt && <p className="mt-2 text-xs font-semibold text-slate-500">제출 {formatDateTime(assignment.submittedAt)}</p>}
      </div>
      <Button href={href} className="mt-4 min-h-10 w-full px-3 text-xs sm:min-h-12 sm:text-sm">
        {buttonLabel}
      </Button>
    </Card>
  );
}

function TestResultSection({ upcomingTests, results }: { upcomingTests: UpcomingTest[]; results: TestResult[] }) {
  return (
    <section className="student-section">
      <Badge tone="green">Tests</Badge>
      <h2 className="mb-5 mt-3 text-[clamp(1.9rem,3.8vw,3rem)] font-bold leading-[1.3]">시험 결과</h2>
      <div className="grid gap-4">
        <UpcomingTestCard test={upcomingTests[0]} />
        <TestHistoryList results={results} />
      </div>
    </section>
  );
}

function UpcomingTestCard({ test }: { test?: UpcomingTest }) {
  return (
    <Card>
      <h3 className="text-lg font-bold">다가오는 시험</h3>
      {!test ? (
        <p className="mt-3 text-sm text-slate-500">예정된 시험이 없습니다.</p>
      ) : (
        <div className="mt-4 rounded-[18px] bg-[#f3faf4] p-4">
          <Badge tone="blue">{test.subject}</Badge>
          <h4 className="mt-3 text-lg font-extrabold">{test.title}</h4>
          <p className="mt-1 text-sm font-semibold text-[#5b655d]">{formatDate(test.date)} · {formatTimeRange(test.startTime, test.endTime)}</p>
          <p className="mt-2 text-sm text-[#5b655d]">범위: {test.scope || "-"}</p>
        </div>
      )}
    </Card>
  );
}

function TestHistoryList({ results }: { results: TestResult[] }) {
  return (
    <Card>
      <h3 className="text-lg font-bold">시험 히스토리</h3>
      {results.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">아직 시험 결과가 없습니다.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {results.map((result) => (
            <article key={result.id} className="rounded-[18px] border border-line bg-[#f7fbf6] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold">{result.title}</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {result.subject} · {formatDate(result.date)} · {formatTimeRange(result.startTime, result.endTime)}
                  </p>
                </div>
                <div className="text-right">
                  <Badge tone={result.result === "PASS" ? "green" : "red"}>{result.result}</Badge>
                  <p className="mt-2 text-lg font-extrabold">{result.score ?? "-"}점</p>
                </div>
              </div>
              {result.teacherMemo && <p className="mt-3 rounded-md bg-slate-50 p-2 text-sm text-slate-600">선생님 메모: {result.teacherMemo}</p>}
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

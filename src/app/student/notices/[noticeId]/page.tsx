import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { StudentLayout } from "@/components/layout/StudentLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getStudentVisibleNotice, getStudentVisibleNotices } from "@/lib/dashboardData";
import { getStudentSession } from "@/server/auth/studentSession";

type StudentNotice = NonNullable<Awaited<ReturnType<typeof getStudentVisibleNotice>>>;

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function targetLabel(targetType?: string) {
  if (targetType === "all") return "전체 공지";
  if (targetType === "student") return "개별 공지";
  return "반 공지";
}

export default async function StudentNoticeDetailPage({ params }: { params: Promise<{ noticeId: string }> }) {
  const [{ noticeId }, session] = await Promise.all([params, getStudentSession()]);
  if (!session) redirect("/");

  const [notice, notices] = await Promise.all([
    getStudentVisibleNotice(session.studentId, session.teacherId, noticeId),
    getStudentVisibleNotices(session.studentId, session.teacherId),
  ]);
  if (!notice) notFound();
  const otherNotices = notices.filter((item) => item.id !== notice.id).slice(0, 4);

  return (
    <StudentLayout title="공지사항">
      <div className="mb-4">
        <Button href="/student/home#notice" variant="secondary" className="min-h-10 px-4 text-sm">
          ← 공지사항으로
        </Button>
      </div>

      <article className="grid gap-5">
        <Card className="overflow-hidden p-0">
          {notice.imageUrl && <img src={notice.imageUrl} alt="" className="max-h-[460px] w-full object-cover" />}
          <div className="p-5 md:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={notice.targetType === "all" ? "blue" : "green"}>{targetLabel(notice.targetType)}</Badge>
              <span className="text-sm font-bold text-[#5b655d]">{formatDateTime(notice.publishedAt ?? notice.createdAt)}</span>
            </div>

            <h1 className="mt-4 text-[clamp(2rem,4.5vw,3.4rem)] font-extrabold leading-[1.25] text-ink">{notice.title}</h1>
            <div className="mt-6 whitespace-pre-wrap text-lg leading-9 text-[#354238]">{notice.content}</div>
          </div>
        </Card>

        {otherNotices.length > 0 && <OtherNotices notices={otherNotices} />}
      </article>
    </StudentLayout>
  );
}

function OtherNotices({ notices }: { notices: StudentNotice[] }) {
  return (
    <section className="pt-3">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <Badge tone="green">Notice</Badge>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-ink">다른 공지사항</h2>
        </div>
        <Button href="/student/home#notice" variant="ghost" className="min-h-10 px-4 text-sm">
          전체 보기
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {notices.map((notice) => (
          <Link
            key={notice.id}
            href={`/student/notices/${notice.id}`}
            className="group rounded-[18px] border border-line bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-[#178341]/30"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-bold text-[#5b655d]">{formatDateTime(notice.publishedAt ?? notice.createdAt)}</p>
              <Badge tone={notice.targetType === "all" ? "blue" : "green"}>{targetLabel(notice.targetType)}</Badge>
            </div>
            <h3 className="mt-3 truncate text-lg font-extrabold group-hover:text-[#14532d]">{notice.title}</h3>
            <p className="mt-2 line-clamp-2 leading-7 text-[#5b655d]">{notice.content}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

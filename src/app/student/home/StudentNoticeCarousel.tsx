"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export type StudentNotice = {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  targetType?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export function StudentNoticeCarousel({ notices }: { notices: StudentNotice[] }) {
  const [index, setIndex] = useState(0);
  const visibleNotices = notices.length <= 2 ? notices : [notices[index], notices[(index + 1) % notices.length]];

  function move(delta: number) {
    if (notices.length === 0) return;
    setIndex((value) => (value + delta + notices.length) % notices.length);
  }

  return (
    <section className="student-section">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <Badge tone="green">Notice</Badge>
          <h2 className="mt-3 text-[clamp(1.9rem,3.8vw,3rem)] font-bold leading-[1.3] text-ink">공지사항</h2>
        </div>
        <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-sm font-bold text-[#14532d]">{notices.length}개</span>
      </div>

      {notices.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">등록된 공지사항이 없습니다.</p>
        </Card>
      ) : (
        <Card className="p-4 md:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleNotices.map((notice) => (
              <article key={`${notice.id}-${index}`} className="grid min-h-[210px] overflow-hidden rounded-[18px] border border-line bg-white md:grid-cols-[190px_1fr]">
                {notice.imageUrl ? (
                  <img src={notice.imageUrl} alt="" className="h-44 w-full object-cover md:h-full" />
                ) : (
                  <div className="grid h-40 place-items-center bg-[#e8f6eb] text-sm font-bold text-[#14532d] md:h-full">Notice</div>
                )}

                <div className="flex min-w-0 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-bold text-[#5b655d]">{formatDate(notice.createdAt)}</p>
                    <Badge tone={notice.targetType === "all" ? "blue" : "green"}>{notice.targetType === "all" ? "전체" : "반"}</Badge>
                  </div>
                  <h2 className="mt-2 truncate text-lg font-bold">{notice.title}</h2>
                  <p className="mt-2 line-clamp-3 leading-7 text-[#5b655d]">{notice.content}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1">
              {notices.map((notice, dotIndex) => (
                <button
                  key={notice.id}
                  type="button"
                  aria-label={`${dotIndex + 1}번째 공지 보기`}
                  onClick={() => setIndex(dotIndex)}
                  className={`h-2 rounded-full transition-all ${dotIndex === index ? "w-6 bg-action" : "w-2 bg-[#d8e9dc]"}`}
                />
              ))}
            </div>
            {notices.length > 2 && (
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => move(-1)}>
                  이전
                </Button>
                <Button type="button" variant="secondary" onClick={() => move(1)}>
                  다음
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}

import { notFound, redirect } from "next/navigation";

import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { getTeacherSession } from "@/server/teacher/session";
import { getTeacherSubmissionDetail } from "@/server/teacher/submissionDetail";
import { SubmissionReviewPanel } from "./SubmissionReviewPanel";

export default async function SubmissionDetailPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const session = await getTeacherSession();
  if (!session) redirect("/login");

  const { submissionId } = await params;
  const detail = await getTeacherSubmissionDetail(session.teacherId, submissionId);
  if (!detail) notFound();

  return (
    <TeacherLayout title="제출 상세">
      <SubmissionReviewPanel detail={detail} />
    </TeacherLayout>
  );
}

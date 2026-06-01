import { notFound, redirect } from "next/navigation";

import { StudentLayout } from "@/components/layout/StudentLayout";
import { normalizeAssignmentType } from "@/lib/assignmentTypes";
import { studentAssignmentRepository } from "@/features/assignments/repositories/studentAssignmentRepository";
import { getStudentSession } from "@/server/auth/studentSession";
import type { Assignment } from "@/types/assignment";
import { ListeningHomework } from "./ListeningHomework";
import { MultiPartHomework } from "./MultiPartHomework";
import { PhotoSubmissionHomework } from "./PhotoSubmissionHomework";
import { QuizHomework } from "./QuizHomework";
import { RlRecordingHomework } from "./RlRecordingHomework";
import { VocabularyExampleHomework } from "./VocabularyExampleHomework";
import { VocabularyRecordingHomework } from "./VocabularyRecordingHomework";
import { WritingHomework } from "./WritingHomework";

function HomeworkByType({ assignment }: { assignment: Assignment }) {
  const assignmentType = normalizeAssignmentType(assignment.assignmentType);
  const isPhotoSubmission = assignmentType === "photo_submission" || assignment.items.some((item) => item.itemType === "photo_submission");

  if (isPhotoSubmission) return <PhotoSubmissionHomework assignment={{ ...assignment, assignmentType: "photo_submission" }} />;
  if (assignmentType === "listening") return <ListeningHomework assignment={{ ...assignment, assignmentType }} />;
  if (assignmentType === "writing") return <WritingHomework assignment={{ ...assignment, assignmentType }} />;
  if (assignmentType === "vocabulary_example") return <VocabularyExampleHomework assignment={{ ...assignment, assignmentType }} />;
  if (assignmentType === "vocabulary_recording") return <VocabularyRecordingHomework assignment={{ ...assignment, assignmentType }} />;
  return <RlRecordingHomework assignment={{ ...assignment, assignmentType }} />;
}

function layoutTitle(assignment: Assignment) {
  const assignmentType = normalizeAssignmentType(assignment.assignmentType);
  if (assignmentType === "photo_submission") return "사진 제출 숙제";
  if (assignmentType === "listening") return "리스닝 숙제";
  if (assignmentType === "writing") return "라이팅 숙제";
  if (assignmentType === "vocabulary_example") return "단어장 예문 숙제";
  if (assignmentType === "vocabulary_recording") return "단어장 녹음 숙제";
  if (assignmentType === "quiz") return "퀴즈 숙제";
  return "듣고녹음하기 숙제";
}

export default async function StudentAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const [{ assignmentId }, session] = await Promise.all([params, getStudentSession()]);

  if (!session) redirect("/login");

  const assignment = await studentAssignmentRepository.getAssignmentForStudent(session.studentId, session.teacherId, assignmentId);
  if (!assignment) notFound();

  const activeParts = (assignment.parts ?? []).filter((part) => part.status === "active");

  return (
    <StudentLayout title={layoutTitle(assignment)}>
      {activeParts.length > 1
        ? <MultiPartHomework assignment={assignment} />
        : activeParts[0]?.partType === "quiz"
          ? <QuizHomework assignment={assignment} part={activeParts[0]} />
          : <HomeworkByType assignment={assignment} />}
    </StudentLayout>
  );
}

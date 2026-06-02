import { notFound, redirect } from "next/navigation";

import { StudentLayout } from "@/components/layout/StudentLayout";
import { normalizeAssignmentType } from "@/lib/assignmentTypes";
import { studentAssignmentRepository } from "@/features/assignments/repositories/studentAssignmentRepository";
import type { AssignmentType } from "@/lib/assignmentTypes";
import { getStudentSession } from "@/server/auth/studentSession";
import type { Assignment } from "@/types/assignment";
import { ListeningHomework } from "./ListeningHomework";
import { MultiPartHomework } from "./MultiPartHomework";
import { PhotoSubmissionHomework } from "./PhotoSubmissionHomework";
import { RlRecordingHomework } from "./RlRecordingHomework";
import { VocabularyExampleHomework } from "./VocabularyExampleHomework";
import { VocabularyRecordingHomework } from "./VocabularyRecordingHomework";
import { WritingHomework } from "./WritingHomework";

function HomeworkByType({ assignment }: { assignment: Assignment }) {
  const assignmentType = effectiveAssignmentType(assignment);
  const isPhotoSubmission = assignmentType === "photo_submission" || assignment.items.some((item) => item.itemType === "photo_submission");

  if (isPhotoSubmission) return <PhotoSubmissionHomework assignment={{ ...assignment, assignmentType: "photo_submission" }} />;
  if (assignmentType === "listening") return <ListeningHomework assignment={{ ...assignment, assignmentType }} />;
  if (assignmentType === "writing") return <WritingHomework assignment={{ ...assignment, assignmentType }} />;
  if (assignmentType === "vocabulary_example") return <VocabularyExampleHomework assignment={{ ...assignment, assignmentType }} />;
  if (assignmentType === "vocabulary_recording") return <VocabularyRecordingHomework assignment={{ ...assignment, assignmentType }} />;
  return <RlRecordingHomework assignment={{ ...assignment, assignmentType }} />;
}

function layoutTitle(assignment: Assignment) {
  const assignmentType = effectiveAssignmentType(assignment);
  if (assignmentType === "photo_submission") return "사진 제출 숙제";
  if (assignmentType === "listening") return "리스닝 숙제";
  if (assignmentType === "writing") return "라이팅 숙제";
  if (assignmentType === "vocabulary_example") return "단어장 예문 숙제";
  if (assignmentType === "vocabulary_recording") return "단어장 녹음 숙제";
  if (assignmentType === "quiz") return "퀴즈 숙제";
  return "듣고녹음하기 숙제";
}

function effectiveAssignmentType(assignment: Assignment): AssignmentType {
  const activeContentParts = (assignment.parts ?? []).filter((part) => part.status === "active" && part.partType !== "instruction");
  if (activeContentParts.length === 1) {
    const partType = activeContentParts[0].partType;
    if (partType === "listening") return "listening";
    if (partType === "writing") return "writing";
    if (partType === "photo_submission") return "photo_submission";
    if (partType === "quiz") return "quiz";
    if (partType === "vocabulary_example") return "vocabulary_example";
    if (partType === "vocabulary_recording") return "vocabulary_recording";
    return "listening_recording";
  }

  const itemType = assignment.items[0]?.itemType;
  if (itemType === "listening") return "listening";
  if (itemType === "writing_prompt") return "writing";
  if (itemType === "photo_submission") return "photo_submission";
  if (itemType === "quiz_prompt") return "quiz";
  if (itemType === "vocabulary_example") return "vocabulary_example";
  if (itemType === "vocabulary_recording") return "vocabulary_recording";
  return normalizeAssignmentType(assignment.assignmentType);
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
      {activeParts.length > 0
        ? <MultiPartHomework assignment={assignment} />
        : <HomeworkByType assignment={assignment} />}
    </StudentLayout>
  );
}

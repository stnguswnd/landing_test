import { notFound, redirect } from "next/navigation";

import { StudentLayout } from "@/components/layout/StudentLayout";
import { getActiveAssignmentParts, getCanonicalAssignmentType, isMultipartAssignment } from "@/features/assignments/assignmentType";
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
  const assignmentType = getCanonicalAssignmentType(assignment);
  const activeParts = getActiveAssignmentParts(assignment.parts);

  if (assignmentType === "photo_submission") return <PhotoSubmissionHomework assignment={{ ...assignment, assignmentType }} />;
  if (assignmentType === "listening") return <ListeningHomework assignment={{ ...assignment, assignmentType }} />;
  if (assignmentType === "writing") return <WritingHomework assignment={{ ...assignment, assignmentType }} />;
  if (assignmentType === "vocabulary_example") return <VocabularyExampleHomework assignment={{ ...assignment, assignmentType }} />;
  if (assignmentType === "vocabulary_recording") return <VocabularyRecordingHomework assignment={{ ...assignment, assignmentType }} />;
  if (assignmentType === "quiz") {
    const quizPart = activeParts.find((part) => part.partType === "quiz");
    return quizPart ? <QuizHomework assignment={{ ...assignment, assignmentType }} part={quizPart} /> : null;
  }
  return <RlRecordingHomework assignment={{ ...assignment, assignmentType }} />;
}

function layoutTitle(assignment: Assignment) {
  const assignmentType = getCanonicalAssignmentType(assignment);
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

  return (
    <StudentLayout title={layoutTitle(assignment)}>
      {isMultipartAssignment(assignment)
        ? <MultiPartHomework assignment={assignment} />
        : <HomeworkByType assignment={assignment} />}
    </StudentLayout>
  );
}

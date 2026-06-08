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

function assignmentWithSinglePartContent(assignment: Assignment): Assignment {
  const part = getActiveAssignmentParts(assignment.parts).find((activePart) => activePart.partType !== "instruction");
  const baseItem = assignment.items[0];

  if (!part || !baseItem) return assignment;

  const image = (part.attachments ?? []).find((attachment) => attachment.attachmentType === "image");
  const audio = (part.attachments ?? []).find((attachment) => attachment.attachmentType === "audio");

  return {
    ...assignment,
    title: part.title || assignment.title,
    description: part.instruction || assignment.description,
    imageUrl: image?.fileUrl ?? assignment.imageUrl,
    vocabularyItems: part.vocabularyItems?.length ? part.vocabularyItems : assignment.vocabularyItems,
    items: [{
      ...baseItem,
      title: part.title || baseItem.title,
      passageText: part.scriptText || baseItem.passageText,
      audioUrl: audio?.fileUrl || baseItem.audioUrl,
      audioFileName: audio?.fileName || baseItem.audioFileName,
      writingMode: part.writingMode ?? baseItem.writingMode,
      writingUnit: part.writingUnit ?? baseItem.writingUnit,
      writingHint: part.writingHint ?? baseItem.writingHint,
      writingExample: part.writingExample ?? baseItem.writingExample,
    }],
  };
}

function HomeworkByType({ assignment }: { assignment: Assignment }) {
  const effectiveAssignment = assignmentWithSinglePartContent(assignment);
  const assignmentType = getCanonicalAssignmentType(effectiveAssignment);
  const activeParts = getActiveAssignmentParts(effectiveAssignment.parts);

  if (assignmentType === "photo_submission") return <PhotoSubmissionHomework assignment={{ ...effectiveAssignment, assignmentType }} />;
  if (assignmentType === "listening") return <ListeningHomework assignment={{ ...effectiveAssignment, assignmentType }} />;
  if (assignmentType === "writing") return <WritingHomework assignment={{ ...effectiveAssignment, assignmentType }} />;
  if (assignmentType === "vocabulary_example") return <VocabularyExampleHomework assignment={{ ...effectiveAssignment, assignmentType }} />;
  if (assignmentType === "vocabulary_recording") return <VocabularyRecordingHomework assignment={{ ...effectiveAssignment, assignmentType }} />;
  if (assignmentType === "quiz") {
    const quizPart = activeParts.find((part) => part.partType === "quiz");
    return quizPart ? <QuizHomework assignment={{ ...effectiveAssignment, assignmentType }} part={quizPart} /> : null;
  }
  return <RlRecordingHomework assignment={{ ...effectiveAssignment, assignmentType }} />;
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

  if (!session) redirect("/");

  const assignment = await studentAssignmentRepository.getAssignmentForStudent(session.studentId, session.teacherId, assignmentId);
  if (!assignment) notFound();
  if (getCanonicalAssignmentType(assignment) === "quiz" && assignment.submittedAt && assignment.targetStatus !== "returned") {
    redirect(`/student/assignments/${assignment.id}/complete`);
  }

  return (
    <StudentLayout title={layoutTitle(assignment)}>
      {isMultipartAssignment(assignment)
        ? <MultiPartHomework assignment={assignment} />
        : <HomeworkByType assignment={assignment} />}
    </StudentLayout>
  );
}

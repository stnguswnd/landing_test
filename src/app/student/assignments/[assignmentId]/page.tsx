import { notFound, redirect } from "next/navigation";

import { StudentLayout } from "@/components/layout/StudentLayout";
import { studentAssignmentRepository } from "@/features/assignments/repositories/studentAssignmentRepository";
import { normalizeAssignmentType } from "@/lib/assignmentTypes";
import { getStudentSession } from "@/server/auth/studentSession";
import { ListeningHomework } from "./ListeningHomework";
import { RlRecordingHomework } from "./RlRecordingHomework";
import { VocabularyExampleHomework } from "./VocabularyExampleHomework";
import { VocabularyRecordingHomework } from "./VocabularyRecordingHomework";
import { WritingHomework } from "./WritingHomework";

export default async function StudentAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const [{ assignmentId }, session] = await Promise.all([params, getStudentSession()]);

  if (!session) redirect("/login");

  const assignment = await studentAssignmentRepository.getAssignmentForStudent(session.studentId, session.teacherId, assignmentId);
  if (!assignment) notFound();

  const assignmentType = normalizeAssignmentType(assignment.assignmentType);

  if (assignmentType === "listening") {
    return (
      <StudentLayout title="리스닝 숙제">
        <ListeningHomework assignment={{ ...assignment, assignmentType }} />
      </StudentLayout>
    );
  }

  if (assignmentType === "writing") {
    return (
      <StudentLayout title="라이팅 숙제">
        <WritingHomework assignment={{ ...assignment, assignmentType }} />
      </StudentLayout>
    );
  }

  if (assignmentType === "vocabulary_example") {
    return (
      <StudentLayout title="단어장 예문 숙제">
        <VocabularyExampleHomework assignment={{ ...assignment, assignmentType }} />
      </StudentLayout>
    );
  }

  if (assignmentType === "vocabulary_recording") {
    return (
      <StudentLayout title="단어장 녹음 숙제">
        <VocabularyRecordingHomework assignment={{ ...assignment, assignmentType }} />
      </StudentLayout>
    );
  }

  return (
    <StudentLayout title="RL 녹음 숙제">
      <RlRecordingHomework assignment={{ ...assignment, assignmentType }} />
    </StudentLayout>
  );
}

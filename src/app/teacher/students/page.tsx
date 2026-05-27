import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { StudentManagementView } from "@/features/student-management/components/StudentManagementView";

export default function StudentsPage() {
  return (
    <TeacherLayout title="학생관리">
      <StudentManagementView initialStudents={[]} />
    </TeacherLayout>
  );
}

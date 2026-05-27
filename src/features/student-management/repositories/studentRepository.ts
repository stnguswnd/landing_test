import type {
  CreateManagedStudentInput,
  ManagedStudent,
  StudentLearningHistory,
  UpdateManagedStudentInput,
} from "@/features/student-management/types/studentManagement";

function apiUrl(path: string) {
  if (typeof window !== "undefined") return path;
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000"}${path}`;
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? fallbackMessage);
  return data as T;
}

function createStudentId(input?: string) {
  return input?.trim() || `student_${Date.now()}`;
}

export const studentRepository = {
  async getStudents() {
    const response = await fetch(apiUrl("/api/teacher/students"), { cache: "no-store" });
    return readJson<ManagedStudent[]>(response, "학생 목록을 불러오지 못했습니다.");
  },
  async getStudentById(studentId: string) {
    const response = await fetch(apiUrl(`/api/teacher/students/${studentId}`), { cache: "no-store" });
    if (response.status === 404) return null;
    return readJson<ManagedStudent>(response, "학생 정보를 불러오지 못했습니다.");
  },
  async createStudent(input: CreateManagedStudentInput) {
    const response = await fetch(apiUrl("/api/teacher/students"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        studentLoginId: createStudentId(input.studentId),
        password: input.password ?? "12345678",
        schoolName: input.schoolName,
        grade: input.grade,
        classIds: input.classIds ?? (input.classId ? [input.classId] : []),
        memo: input.memo,
      }),
    });
    return readJson<ManagedStudent>(response, "학생 생성 중 오류가 발생했습니다.");
  },
  async updateStudent(studentId: string, input: UpdateManagedStudentInput, students: ManagedStudent[]) {
    const response = await fetch(apiUrl(`/api/teacher/students/${studentId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const updated = await readJson<ManagedStudent>(response, "학생 수정 중 오류가 발생했습니다.");
    return students.map((student) => (student.id === studentId ? updated : student));
  },
  async deleteStudent(studentId: string, students: ManagedStudent[]) {
    const response = await fetch(apiUrl(`/api/teacher/students/${studentId}`), { method: "DELETE" });
    const updated = await readJson<ManagedStudent>(response, "학생 비활성화 중 오류가 발생했습니다.");
    return students.map((student) => (student.id === studentId ? updated : student));
  },
  async getLearningHistory(studentId: string) {
    const response = await fetch(apiUrl(`/api/teacher/students/${studentId}/history`), { cache: "no-store" });
    return readJson<StudentLearningHistory[]>(response, "학생 학습 이력을 불러오지 못했습니다.");
  },
};

export const studentAvatars = ["robot", "boy-blonde", "girl-brown", "boy-dark", "girl-black", "boy-orange", "girl-red"];
export const gradeOptions = ["미취학", "초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "기타"];

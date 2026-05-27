export type StudentStatus = "active" | "inactive";

export type ManagedStudent = {
  id: string;
  studentId: string;
  studentLoginId?: string;
  password?: string;
  name: string;
  schoolName?: string;
  grade?: string;
  classIds: string[];
  classNames: string[];
  avatarKey: string;
  memo?: string;
  parentId?: string;
  parentPassword?: string;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
};

export type StudentLearningHistory = {
  id: string;
  studentId: string;
  date: string;
  assignmentTitle: string;
  assignmentType: "listening_recording" | "listening" | "writing" | "vocabulary_example" | "vocabulary_recording";
  className?: string;
  submitStatus: "submitted" | "not_submitted" | "late";
  score?: number | null;
  reviewStatus: "pending" | "reviewed" | "none";
  detailHref?: string;
};

export type StudentManagementTab = "detail" | "learning";

export type CreateManagedStudentInput = {
  studentId?: string;
  password?: string;
  name: string;
  schoolName?: string;
  grade?: string;
  classId?: string;
  classIds?: string[];
  className?: string;
  avatarKey?: string;
  memo?: string;
  parentId?: string;
  parentPassword?: string;
};

export type UpdateManagedStudentInput = Partial<
  Pick<ManagedStudent, "password" | "name" | "schoolName" | "grade" | "avatarKey" | "memo" | "parentId" | "parentPassword" | "status" | "classIds">
>;

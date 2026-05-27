export type Student = {
  id: string;
  teacherId: string;
  name: string;
  studentLoginId: string;
  accessCode?: string;
  classIds: string[];
  status: "active" | "inactive";
  memo?: string;
  createdAt: string;
};

export type Class = {
  id: string;
  teacherId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  logoStoragePath?: string;
  logoFileName?: string;
  status: "active" | "archived";
  studentCount: number;
  createdAt: string;
};

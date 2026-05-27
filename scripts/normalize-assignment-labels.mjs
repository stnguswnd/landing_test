import { readFile, writeFile } from "node:fs/promises";

const replacements = [
  ["src/app/teacher/assignments/page.tsx", "typeLabel"],
  ["src/app/student/home/page.tsx", "assignmentTypeLabel"],
  ["src/app/student/assignments/[assignmentId]/page.tsx", "assignmentTypeLabel"],
  ["src/app/teacher/students/[studentId]/page.tsx", "assignmentTypeLabel"],
  ["src/features/student-management/components/StudentManagementView.tsx", "assignmentTypeLabel"],
  ["src/features/class-calendar/repositories/classCalendarRepository.ts", "homeworkTypeLabel"],
];

for (const [path, fnName] of replacements) {
  let source = await readFile(path, "utf8");
  if (!source.includes("@/lib/assignmentTypes")) {
    const importLine = fnName === "homeworkTypeLabel"
      ? 'import { assignmentTypeLabel } from "@/lib/assignmentTypes";\n'
      : 'import { assignmentTypeLabel as formatAssignmentTypeLabel } from "@/lib/assignmentTypes";\n';
    source = source.replace(/((?:import .+;\r?\n)+)/, `$1${importLine}`);
  }
  const replacement = fnName === "homeworkTypeLabel"
    ? `function ${fnName}(type: string) {\n  return assignmentTypeLabel(type);\n}`
    : `function ${fnName}(type: string) {\n  return formatAssignmentTypeLabel(type);\n}`;
  source = source.replace(new RegExp(`function ${fnName}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`), replacement);
  await writeFile(path, source);
}

"use client";

import type { Assignment } from "@/types/assignment";
import { QuizPartPlayer } from "./QuizPartPlayer";

export function QuizHomework({
  assignment,
  part,
}: {
  assignment: Assignment;
  part: NonNullable<Assignment["parts"]>[number];
}) {
  return <QuizPartPlayer assignment={assignment} part={part} partIndex={0} partCount={1} />;
}

import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Assignment } from "@/types/assignment";

function kindLabel(kind?: "general" | "grading" | "other") {
  if (kind === "grading") return "채점";
  if (kind === "other") return "기타";
  return "안내";
}

export function MaterialHomework({ assignment }: { assignment: Assignment }) {
  const parts = (assignment.parts ?? []).filter((part) => part.status === "active" && part.partType === "instruction");
  return <div className="grid gap-4">{parts.map((part) => {
    const images = (part.attachments ?? []).filter((item) => item.attachmentType === "image");
    const audios = (part.attachments ?? []).filter((item) => item.attachmentType === "audio");
    return <Card key={part.id}>
      <div className="flex flex-wrap gap-2">
        <Badge tone="blue">{assignment.assignmentSubject ?? assignment.classId ?? "내 반"}</Badge>
        <Badge>{kindLabel(part.instructionKind)}</Badge>
      </div>
      <h2 className="mt-3 text-xl font-bold">{part.title || assignment.title}</h2>
      {part.instruction && <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{part.instruction}</p>}
      {part.scriptText && <p className="mt-4 whitespace-pre-wrap rounded-md bg-paper p-4 leading-7">{part.scriptText}</p>}
      {images.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{images.map((item) => item.fileUrl ? <img key={item.id} src={item.fileUrl} alt={item.fileName ?? "자료 이미지"} className="w-full rounded-lg border border-line" /> : null)}</div>}
      {audios.map((item) => item.fileUrl ? <AudioPlayer key={item.id} className="mt-4" src={item.fileUrl} preload="metadata" /> : null)}
    </Card>;
  })}</div>;
}

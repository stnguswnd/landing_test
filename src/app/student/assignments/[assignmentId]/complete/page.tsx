import { redirect } from "next/navigation";

import { StudentLayout } from "@/components/layout/StudentLayout";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { studentAssignmentRepository } from "@/features/assignments/repositories/studentAssignmentRepository";
import { assignmentTypeLabel, normalizeAssignmentType } from "@/lib/assignmentTypes";
import { formatDateTime, formatDue } from "@/lib/format";
import { getStudentSession } from "@/server/auth/studentSession";
import type { Assignment, AssignmentSubmissionPart } from "@/types/assignment";
import { HomeworkListBackLink } from "../HomeworkListBackLink";

function statusLabel(status?: string) {
  if (status === "reviewed" || status === "completed") return "완료";
  if (status === "returned") return "반려";
  if (status === "late") return "지각 제출";
  if (status === "submitted") return "검토 대기";
  return "제출 완료";
}

function completionCopy(type: string) {
  const normalized = normalizeAssignmentType(type);
  if (normalized === "listening") {
    return {
      title: "리스닝 숙제를 완료했어요.",
      body: "선생님에게 숙제를 완료했다고 전달되었어요.",
    };
  }
  if (normalized === "writing") {
    return {
      title: "라이팅 숙제를 제출했어요.",
      body: "선생님이 글과 AI 첨삭 내용을 확인한 뒤 피드백을 줄 거예요.",
    };
  }
  if (normalized === "vocabulary_example") {
    return {
      title: "단어장 예문 숙제를 제출했어요.",
      body: "선생님이 예문과 AI 첨삭 내용을 확인한 뒤 피드백을 줄 거예요.",
    };
  }
  if (normalized === "vocabulary_recording") {
    return {
      title: "단어장 녹음 숙제를 제출했어요.",
      body: "선생님이 녹음 파일을 확인한 뒤 완료 또는 미완료 상태를 알려줄 거예요.",
    };
  }
  return {
    title: "제출이 완료되었어요.",
    body: "선생님이 녹음 파일을 확인한 뒤 완료 또는 미완료 상태를 알려줄 거예요.",
  };
}

function partTypeLabel(type?: string) {
  if (type === "listening") return "리스닝";
  if (type === "recording") return "녹음 제출";
  if (type === "writing") return "라이팅";
  if (type === "photo_submission") return "사진 제출";
  if (type === "quiz") return "퀴즈";
  if (type === "vocabulary_example") return "단어 예문";
  if (type === "vocabulary_recording") return "단어 녹음";
  return "Part";
}

function QuizResultView({
  submissionPart,
  assignmentPart,
}: {
  submissionPart: AssignmentSubmissionPart;
  assignmentPart?: NonNullable<Assignment["parts"]>[number];
}) {
  const answers = submissionPart.quizAnswers ?? [];
  const questions = assignmentPart?.quizQuestions ?? [];
  const correctCount = answers.filter((answer) => answer.isCorrect).length;

  return (
    <div className="mt-4 grid gap-3">
      <div className="rounded-lg bg-green-50 p-4 text-lg font-extrabold text-green-700">
        총 {questions.length || answers.length}문제 중 {correctCount}개 정답
      </div>
      {questions.map((question, index) => {
        const answer = answers.find((item) => item.questionId === question.id);
        const selected = question.choices.find((choice) => choice.id === answer?.selectedChoiceId);
        const correct = question.choices.find((choice) => choice.isCorrect);
        const isCorrect = answer?.isCorrect === true;
        const reason = question.explanation;
        return (
          <article key={question.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">Q{index + 1}</Badge>
              <Badge tone={isCorrect ? "green" : "yellow"}>{isCorrect ? "정답" : "오답"}</Badge>
            </div>
            <p className="mt-3 text-lg font-bold">{question.questionText}</p>
            <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
              <p>내 답: {selected ? `${selected.choiceLabel}. ${selected.choiceText}` : "-"}</p>
              {!isCorrect && <p>정답: {correct ? `${correct.choiceLabel}. ${correct.choiceText}` : "-"}</p>}
              {reason && (
                <p className={`rounded-md p-3 ${isCorrect ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  정답 이유: {reason}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MultiPartSubmissionView({
  parts,
  assignmentParts,
}: {
  parts: AssignmentSubmissionPart[];
  assignmentParts: Assignment["parts"];
}) {
  return (
    <div className="grid gap-4">
      {parts.map((part, index) => {
        const images = (part.attachments ?? []).filter((attachment) => attachment.attachmentType === "image");
        const audios = (part.attachments ?? []).filter((attachment) => attachment.attachmentType === "audio");
        return (
          <Card key={part.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">Part {index + 1}</Badge>
              <Badge tone="green">{partTypeLabel(part.partType)}</Badge>
            </div>
            <h2 className="mt-3 text-lg font-bold">{part.title || `Part ${index + 1}`}</h2>
            {part.partType === "quiz" && (
              <QuizResultView submissionPart={part} assignmentPart={assignmentParts?.find((assignmentPart) => assignmentPart.id === part.assignmentPartId)} />
            )}
            {part.scriptText && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-paper p-4 leading-7">{part.scriptText}</p>}

            {(part.originalAnswerText || part.answerText || part.aiCorrectedText) && (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {part.originalAnswerText && (
                  <div className="rounded-lg border border-line p-4">
                    <p className="font-bold">처음 작성한 내용</p>
                    <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{part.originalAnswerText}</p>
                  </div>
                )}
                {part.aiCorrectedText && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <p className="font-bold text-action">AI 첨삭</p>
                    <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{part.aiCorrectedText}</p>
                  </div>
                )}
                {part.answerText && (
                  <div className="rounded-lg border border-green-100 bg-green-50 p-4">
                    <p className="font-bold text-green-800">제출 내용</p>
                    <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{part.answerText}</p>
                  </div>
                )}
              </div>
            )}

            {part.aiFeedback && (
              <div className="mt-4 rounded-lg bg-paper p-4">
                <p className="font-bold">AI 피드백</p>
                <p className="mt-2 whitespace-pre-wrap leading-7">{part.aiFeedback}</p>
                {part.aiGrammarNotes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6"><strong>문법 교정사항</strong><br />{part.aiGrammarNotes}</p>}
              </div>
            )}

            {images.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((image) => (
                  <a key={image.id} href={image.fileUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-line bg-slate-50">
                    <img src={image.fileUrl} alt={image.fileName ?? "제출 사진"} className="aspect-[4/3] w-full object-cover" />
                    <p className="truncate px-3 py-2 text-xs font-semibold text-slate-600">{image.fileName ?? "-"}</p>
                  </a>
                ))}
              </div>
            )}

            {(part.recordingUrl || audios.length > 0) && (
              <div className="mt-4 grid gap-3">
                {part.recordingUrl && (
                  <div>
                    <p className="mb-2 text-sm font-bold text-slate-600">녹음 파일</p>
                    <AudioPlayer src={part.recordingUrl} preload="metadata" />
                  </div>
                )}
                {audios.map((audio) => (
                  <div key={audio.id}>
                    <p className="mb-2 text-sm font-bold text-slate-600">{audio.fileName ?? "오디오 파일"}</p>
                    {audio.fileUrl && <AudioPlayer src={audio.fileUrl} preload="metadata" />}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default async function CompletePage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const [{ assignmentId }, session] = await Promise.all([params, getStudentSession()]);
  if (!session) redirect("/");

  const assignment = await studentAssignmentRepository.getAssignmentForStudent(session.studentId, session.teacherId, assignmentId);
  if (!assignment) redirect("/student/home");

  const item = assignment.items[0];
  const type = normalizeAssignmentType(assignment.assignmentType);
  const copy = completionCopy(type);
  const submittedAt = assignment.submittedAt;
  const isLate = Boolean(submittedAt && assignment.dueAt && new Date(submittedAt).getTime() > new Date(assignment.dueAt).getTime());
  const submittedParts = assignment.submissionParts ?? [];
  const isMultiPartSubmission = submittedParts.length > 0;

  return (
    <StudentLayout title="제출 내용">
      <HomeworkListBackLink />
      <div className="grid gap-4">
        <Card className="text-center shadow-soft">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-green-50 text-4xl font-bold text-green-700">✓</div>
          <h1 className="mt-5 text-2xl font-bold">{copy.title}</h1>
          <p className="mt-2 text-slate-600">{copy.body}</p>
          <h2 className="mt-5 text-lg font-bold">{assignment.title}</h2>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge tone="blue">{assignment.assignmentSubject ?? "Phonics"}</Badge>
            <Badge tone="green">{assignmentTypeLabel(type)}</Badge>
            <Badge tone={assignment.targetStatus === "returned" ? "yellow" : "green"}>{statusLabel(assignment.targetStatus)}</Badge>
            {isLate && <Badge tone="yellow">지각 제출</Badge>}
            {assignment.dueAt && <Badge tone="yellow">마감 {formatDue(assignment.dueAt)}</Badge>}
          </div>
          <div className="mt-5 rounded-lg bg-paper p-3 text-sm">
            {type === "listening" ? "완료 일시" : "제출 일시"}: {submittedAt ? formatDateTime(submittedAt) : "제출 정보를 불러오는 중입니다."}
          </div>
          {assignment.teacherComment && (
            <div className="mt-4 rounded-lg border border-line bg-white p-4 text-left text-sm">
              <p className="font-bold">선생님 피드백</p>
              <p className="mt-2 text-slate-700">{assignment.teacherComment}</p>
            </div>
          )}
        </Card>

        {isMultiPartSubmission && <MultiPartSubmissionView parts={submittedParts} assignmentParts={assignment.parts ?? []} />}

        {!isMultiPartSubmission && type === "listening_recording" && (
          <>
            {item?.audioUrl && (
              <Card>
                <h2 className="font-bold">원본 MP3 다시 듣기</h2>
                <AudioPlayer className="mt-4" src={item.audioUrl} preload="metadata" />
              </Card>
            )}
            <Card>
              <h2 className="font-bold">내 녹음 다시 듣기</h2>
              {item?.recordingUrl ? (
                <AudioPlayer className="mt-4" src={item.recordingUrl} preload="metadata" />
              ) : (
                <p className="mt-3 text-sm text-slate-500">저장된 녹음 파일을 아직 불러오지 못했습니다.</p>
              )}
            </Card>
          </>
        )}

        {!isMultiPartSubmission && type === "vocabulary_recording" && (
          <>
            <Card>
              <h2 className="font-bold">단어장</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(assignment.vocabularyItems ?? []).map((word) => (
                  <div key={word.id} className="grid grid-cols-2 rounded-md border border-line">
                    <span className="border-r border-line px-3 py-2 font-bold">{word.word}</span>
                    <span className="px-3 py-2">{word.meaning}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="font-bold">내 녹음 다시 듣기</h2>
              {item?.recordingUrl ? (
                <AudioPlayer className="mt-4" src={item.recordingUrl} preload="metadata" />
              ) : (
                <p className="mt-3 text-sm text-slate-500">저장된 녹음 파일을 아직 불러오지 못했습니다.</p>
              )}
            </Card>
          </>
        )}

        {!isMultiPartSubmission && type === "listening" && item?.audioUrl && (
          <Card>
            <h2 className="font-bold">원본 MP3 다시 듣기</h2>
            <AudioPlayer className="mt-4" src={item.audioUrl} preload="metadata" />
          </Card>
        )}

        {!isMultiPartSubmission && type === "writing" && (
          <Card>
            <h2 className="text-lg font-bold">라이팅 제출 내용</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-line p-4">
                <p className="font-bold">학생 원문</p>
                <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{item?.answerText ?? "제출 원문을 불러오지 못했습니다."}</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="font-bold text-action">AI 첨삭문</p>
                <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{item?.aiCorrectedText ?? "-"}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-paper p-4">
              <p className="font-bold">AI 피드백</p>
              <p className="mt-2 whitespace-pre-wrap leading-7">{item?.aiFeedback ?? "-"}</p>
              {item?.aiGrammarNotes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6"><strong>문법 교정사항</strong><br />{item.aiGrammarNotes}</p>}
              {item?.aiExpressionNotes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6"><strong>알면 좋은 표현</strong><br />{item.aiExpressionNotes}</p>}
            </div>
          </Card>
        )}

        {!isMultiPartSubmission && type === "vocabulary_example" && (
          <Card>
            <h2 className="text-lg font-bold">단어장 예문 제출 내용</h2>
            <div className="mt-4 grid gap-3">
              {(assignment.vocabularyItems ?? []).map((word, index) => {
                const answer = assignment.submissionVocabularyItems?.find((item) => item.assignmentVocabularyItemId === word.id);
                return (
                  <article key={word.id} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{index + 1}</Badge>
                      <strong>{word.word}</strong>
                      <span className="text-slate-500">{word.meaning}</span>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <p className="rounded-md bg-slate-50 p-3 text-sm"><strong>처음 문장</strong><br />{answer?.originalAnswerText ?? "-"}</p>
                      <p className="rounded-md bg-blue-50 p-3 text-sm"><strong>AI 첨삭</strong><br />{answer?.aiCorrectedText ?? "-"}</p>
                      <p className="rounded-md bg-green-50 p-3 text-sm"><strong>다시 쓴 글</strong><br />{answer?.revisedAnswerText ?? "-"}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Button href="/student/home#weekly-homework" variant="secondary" className="min-h-12">과제 목록으로</Button>
          {(type !== "quiz" || assignment.targetStatus === "returned") && <Button href={`/student/assignments/${assignmentId}?resubmit=1`} className="min-h-12">다시 제출하기</Button>}
        </div>
      </div>
    </StudentLayout>
  );
}

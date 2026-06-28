import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { requireStudentSession } from "@/server/auth/studentSession";

export const runtime = "nodejs";

type WritingFeedbackResponse = {
  correctedText: string;
  feedback: string;
  grammarNotes: string[];
  expressionNotes: string[];
  raw?: unknown;
  isFallback?: boolean;
};

const MIN_ANSWER_LENGTH = 8;
const MAX_ANSWER_LENGTH = 6000;
const requestHistory = new Map<string, number>();
const RATE_LIMIT_MS = 8000;
const WRITING_FEEDBACK_SYSTEM_PROMPT = [
  "You are a warm but precise English writing teacher who teaches Korean elementary students.",
  "Assume the student is learning English grammar from a Korean-language perspective, so explain grammar concepts in clear Korean at an elementary level.",
  "Correct the student's English writing while keeping the student's original idea and level.",
  "Do not make the writing too advanced. Prefer simple, natural elementary-level English.",
  "Correct grammar, word order, capitalization, punctuation, articles, prepositions, verb tense, subject-verb agreement, pronouns, singular/plural nouns, be-verbs, countable vs uncountable nouns, and adjective/adverb use when relevant.",
  "Pay special attention to English grammar points Korean learners commonly miss because Korean works differently.",
  "When the student's article choice is missing or incorrect, explain why the correction uses a/an/the or no article.",
  "When explaining articles, distinguish indefinite articles a/an from the definite article the in Korean: a/an introduces one non-specific countable noun, while the points to a specific noun already known from context.",
  "For a/an, explain the sound-based choice when relevant: use a before consonant sounds and an before vowel sounds.",
  "For singular countable common nouns, use an appropriate article or determiner unless the noun is plural, uncountable, or a proper noun.",
  "Do not claim that a singular countable common noun can normally stand alone without an article.",
  "If a target prompt, instruction, hint, example, or picture context is provided, use it to understand the student's intent, but do not invent unrelated content.",
  "Write feedback, grammarNotes, and expressionNotes in Korean only.",
  "Do not write English explanation sentences in feedback, grammarNotes, or expressionNotes.",
  "English may appear only as corrected writing or as short quoted vocabulary/expression labels.",
  "Avoid repeating the same explanation in feedback and grammarNotes. Put the main correction in feedback, and put grammar rules in grammarNotes.",
  "grammarNotes must include the most relevant one or two grammar points, not every possible issue.",
  "expressionNotes may include one or two useful natural expressions, but explain them in Korean.",
  "Return only strict JSON with correctedText:string, feedback:string, grammarNotes:string[], expressionNotes:string[].",
].join(" ");

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|;|•|-/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function fallbackFeedback(answerText: string, raw?: unknown): WritingFeedbackResponse {
  return {
    correctedText: answerText.trim(),
    feedback: "AI 첨삭을 불러오는 중 문제가 있었어요. 그래도 글의 구조와 표현을 다시 확인해보면 좋아요.",
    grammarNotes: [
      "문장을 대문자로 시작하고 마침표로 끝냈는지 확인해보세요.",
      "시제와 주어/동사가 자연스럽게 이어지는지 다시 읽어보세요.",
    ],
    expressionNotes: [
      "사진을 설명할 때는 보이는 것을 먼저 말하고, 이유를 덧붙이면 글이 자연스러워져요.",
      "생각을 말할 때는 이유를 함께 쓰면 더 완성된 문장이 됩니다.",
    ],
    raw,
    isFallback: true,
  };
}

function normalizeAiResult(value: unknown, answerText: string): WritingFeedbackResponse {
  if (!value || typeof value !== "object") return fallbackFeedback(answerText, value);
  const parsed = value as Record<string, unknown>;
  const correctedText = typeof parsed.correctedText === "string" && parsed.correctedText.trim()
    ? parsed.correctedText.trim()
    : answerText.trim();
  const feedback = typeof parsed.feedback === "string" && parsed.feedback.trim()
    ? parsed.feedback.trim()
    : "전체적으로 잘 썼어요. 문장을 조금 더 자연스럽게 다듬어보세요.";
  const grammarNotes = toStringArray(parsed.grammarNotes);
  const expressionNotes = toStringArray(parsed.expressionNotes);

  return {
    correctedText,
    feedback,
    grammarNotes: grammarNotes.length ? grammarNotes : ["문법과 문장 부호를 한 번 더 확인해보세요."],
    expressionNotes: expressionNotes.length ? expressionNotes : ["because, and, but 같은 연결어를 사용해보세요."],
    raw: value,
    isFallback: false,
  };
}

function parseAiJson(text: string, answerText: string): WritingFeedbackResponse {
  try {
    return normalizeAiResult(JSON.parse(text), answerText);
  } catch {
    return fallbackFeedback(answerText, text);
  }
}

async function recordFeedbackAttempt({
  assignmentId,
  assignmentItemId,
  studentId,
}: {
  assignmentId: string;
  assignmentItemId: string;
  studentId: string;
}) {
  await postgresPool.query(
    `
      insert into student_ai_feedback_attempts (
        id, assignment_id, student_id, assignment_item_id, feedback_type
      )
      values ($1, $2, $3, $4, 'writing')
    `,
    [`ai-feedback-attempt-${randomUUID()}`, assignmentId, studentId, assignmentItemId],
  );
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireStudentSession();
  } catch {
    return NextResponse.json({ error: "학생 로그인이 필요합니다." }, { status: 401 });
  }

  const now = Date.now();
  const lastRequestAt = requestHistory.get(session.studentId) ?? 0;
  if (now - lastRequestAt < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "AI 첨삭 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const assignmentId = String(body.assignmentId ?? "").trim();
  const assignmentItemId = String(body.assignmentItemId ?? "").trim();
  const answerText = String(body.answerText ?? "").trim();
  const writingMode = String(body.writingMode ?? "");
  const writingUnit = String(body.writingUnit ?? "");
  const promptText = String(body.promptText ?? "");
  const writingInstructions = String(body.writingInstructions ?? "");
  const writingHint = String(body.writingHint ?? "");
  const writingExample = String(body.writingExample ?? "");

  if (!assignmentId || !assignmentItemId) {
    return NextResponse.json({ error: "AI 첨삭 요청 정보가 부족합니다." }, { status: 400 });
  }
  if (!answerText) {
    return NextResponse.json({ error: "첨삭할 글을 입력해주세요." }, { status: 400 });
  }
  if (answerText.length < MIN_ANSWER_LENGTH) {
    return NextResponse.json({ error: "AI 첨삭을 받으려면 조금 더 길게 작성해주세요." }, { status: 400 });
  }
  if (answerText.length > MAX_ANSWER_LENGTH) {
    return NextResponse.json({ error: "글이 너무 깁니다. 조금 줄인 뒤 다시 시도해주세요." }, { status: 400 });
  }

  requestHistory.set(session.studentId, now);

  try {
    await recordFeedbackAttempt({ assignmentId, assignmentItemId, studentId: session.studentId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "AI 첨삭 요청을 기록하지 못했습니다." }, { status: 500 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(fallbackFeedback(answerText));
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_WRITING_MODEL || "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: WRITING_FEEDBACK_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Correct the student's English writing and explain the main grammar/expression issues in Korean.",
              writingContext: {
                writingMode,
                writingUnit,
                promptText,
                writingInstructions,
                writingHint,
                writingExample,
              },
              studentWriting: answerText,
              outputRules: {
                correctedText: "A corrected English version that preserves the student's idea and level.",
                feedback: "Korean-only concise explanation of the main correction. Do not use English explanatory sentences.",
                grammarNotes: "Korean-only notes. Choose the most relevant one or two grammar points, especially common Korean-learner errors such as articles, singular/plural, be-verbs, tense, word order, prepositions, and punctuation.",
                expressionNotes: "Korean-only notes with one or two useful natural-expression suggestions when helpful.",
              },
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return NextResponse.json(fallbackFeedback(answerText, { status: response.status, errorBody }));
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(fallbackFeedback(answerText, data));
    }
    return NextResponse.json(parseAiJson(content, answerText));
  } catch (error) {
    return NextResponse.json(fallbackFeedback(answerText, error instanceof Error ? error.message : error));
  }
}

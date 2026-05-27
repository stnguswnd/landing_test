import { NextResponse } from "next/server";

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
      "I can see...",
      "It looks like...",
      "I think ... because ...",
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
  const answerText = String(body.answerText ?? "").trim();
  const writingMode = String(body.writingMode ?? "");
  const writingUnit = String(body.writingUnit ?? "");
  const promptText = String(body.promptText ?? "");
  const writingInstructions = String(body.writingInstructions ?? "");
  const writingHint = String(body.writingHint ?? "");
  const writingExample = String(body.writingExample ?? "");

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
            content:
              "You are a kind English writing teacher for elementary students. Correct the writing without making it too advanced. Return strict JSON with correctedText:string, feedback:string, grammarNotes:string[], expressionNotes:string[].",
          },
          {
            role: "user",
            content: JSON.stringify({ writingMode, writingUnit, promptText, writingInstructions, writingHint, writingExample, answerText }),
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

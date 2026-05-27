import { NextResponse } from "next/server";

import { requireStudentSession } from "@/server/auth/studentSession";

export const runtime = "nodejs";

const requestHistory = new Map<string, number>();
const RATE_LIMIT_MS = 2500;

function fallback(sentence: string, raw?: unknown) {
  return {
    correctedText: sentence.trim(),
    feedback: "AI 첨삭을 불러오는 중 문제가 있었어요. 문장의 첫 글자, 시제, 마침표를 다시 확인해보세요.",
    grammarNotes: "문장이 자연스러운지 다시 읽어보세요.",
    raw,
    isFallback: true,
  };
}

function normalize(value: unknown, sentence: string) {
  if (!value || typeof value !== "object") return fallback(sentence, value);
  const parsed = value as Record<string, unknown>;
  return {
    correctedText: typeof parsed.correctedText === "string" && parsed.correctedText.trim() ? parsed.correctedText.trim() : sentence.trim(),
    feedback: typeof parsed.feedback === "string" && parsed.feedback.trim() ? parsed.feedback.trim() : "좋아요. 문법과 표현을 한 번 더 확인해보세요.",
    grammarNotes: typeof parsed.grammarNotes === "string" && parsed.grammarNotes.trim() ? parsed.grammarNotes.trim() : "",
    raw: value,
    isFallback: false,
  };
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireStudentSession();
  } catch {
    return NextResponse.json({ error: "학생 로그인이 필요합니다." }, { status: 401 });
  }

  const now = Date.now();
  const last = requestHistory.get(session.studentId) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "AI 첨삭 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const word = String(body.word ?? "").trim();
  const meaning = String(body.meaning ?? "").trim();
  const sentence = String(body.sentence ?? "").trim();

  if (!sentence) return NextResponse.json({ error: "첨삭할 문장을 입력해주세요." }, { status: 400 });
  if (sentence.length > 500) return NextResponse.json({ error: "문장이 너무 깁니다. 500자 이하로 작성해주세요." }, { status: 400 });

  requestHistory.set(session.studentId, now);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json(fallback(sentence));

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
              "You are a kind English teacher for elementary students. Correct one English sentence using the target vocabulary naturally. Return strict JSON with correctedText:string, feedback:string, grammarNotes:string.",
          },
          {
            role: "user",
            content: JSON.stringify({ word, meaning, sentence }),
          },
        ],
      }),
    });

    if (!response.ok) return NextResponse.json(fallback(sentence, { status: response.status }));
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return NextResponse.json(fallback(sentence, data));
    try {
      return NextResponse.json(normalize(JSON.parse(content), sentence));
    } catch {
      return NextResponse.json(fallback(sentence, content));
    }
  } catch (error) {
    return NextResponse.json(fallback(sentence, error instanceof Error ? error.message : error));
  }
}

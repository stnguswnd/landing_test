import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { requireStudentSession } from "@/server/auth/studentSession";

export const runtime = "nodejs";

const requestHistory = new Map<string, number>();
const RATE_LIMIT_MS = 2500;
const MAX_FEEDBACK_ATTEMPTS = 3;
const VOCABULARY_FEEDBACK_SYSTEM_PROMPT = [
  "You are an English teacher helping Korean elementary students revise one vocabulary expression.",
  "The student's input may be a single word, a short phrase, or a full sentence.",
  "Your job is to identify what is wrong in the student's English expression and help the student rewrite only that expression correctly.",
  "Keep the correction close to the student's original input and intent.",
  "Do not invent a new sentence, new situation, or extra context that the student did not write.",
  "If the input is only a word or phrase, correctedText must stay as a word or phrase, not a full sentence.",
  "Do not make the sentence too advanced. Prefer simple, natural elementary-level English.",
  "Check grammar, word order, capitalization, punctuation, article/preposition use, verb tense, subject-verb agreement, and whether the target word is used with the right meaning.",
  "If the target vocabulary word appears in the student's input, focus the correction on that word and its surrounding expression.",
  "If the target vocabulary word does not appear, do not force it into the correction. Explain in feedback that the target word is missing.",
  "Write feedback and grammarNotes in Korean. Be specific about the mistake and how to fix it.",
  "Do not only praise the student. If there is an error, clearly explain the main error.",
  "If the expression is already correct, say that there is no major error and suggest one small way to make it more natural.",
  "Return only strict JSON with correctedText:string, feedback:string, grammarNotes:string.",
].join(" ");

function fallback(sentence: string, raw?: unknown) {
  return {
    correctedText: sentence.trim(),
    feedback: "AI 첨삭을 불러오는 중 문제가 있었어요. 목표 단어를 알맞은 뜻으로 썼는지, 표현이 자연스러운지 다시 확인해보세요.",
    grammarNotes: "단어만 썼다면 철자와 뜻을, 문장을 썼다면 어순과 시제, 전치사를 다시 확인해보세요.",
    raw,
    isFallback: true,
  };
}

function normalize(value: unknown, sentence: string) {
  if (!value || typeof value !== "object") return fallback(sentence, value);
  const parsed = value as Record<string, unknown>;
  return {
    correctedText: typeof parsed.correctedText === "string" && parsed.correctedText.trim() ? parsed.correctedText.trim() : sentence.trim(),
    feedback: typeof parsed.feedback === "string" && parsed.feedback.trim() ? parsed.feedback.trim() : "좋아요. 단어의 뜻과 표현이 자연스러운지 한 번 더 확인해보세요.",
    grammarNotes: typeof parsed.grammarNotes === "string" && parsed.grammarNotes.trim() ? parsed.grammarNotes.trim() : "단어만 썼다면 철자와 뜻을, 문장을 썼다면 어순과 시제, 마침표를 다시 확인해보세요.",
    raw: value,
    isFallback: false,
  };
}

async function reserveFeedbackAttempt({
  assignmentId,
  vocabularyItemId,
  studentId,
}: {
  assignmentId: string;
  vocabularyItemId: string;
  studentId: string;
}) {
  const client = await postgresPool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ attempt_count: number }>(
      `
        select count(*)::int as attempt_count
        from student_ai_feedback_attempts safa
        where safa.assignment_id = $1
          and safa.student_id = $2
          and safa.assignment_vocabulary_item_id = $3
          and safa.feedback_type = 'vocabulary_example'
          and safa.created_at > coalesce(
            (
              select sub.submitted_at
              from submissions sub
              where sub.assignment_id = $1
                and sub.student_id = $2
              limit 1
            ),
            '-infinity'::timestamptz
          )
      `,
      [assignmentId, studentId, vocabularyItemId],
    );
    const attemptCount = result.rows[0]?.attempt_count ?? 0;
    if (attemptCount >= MAX_FEEDBACK_ATTEMPTS) {
      await client.query("rollback");
      return { ok: false };
    }
    await client.query(
      `
        insert into student_ai_feedback_attempts (
          id, assignment_id, student_id, assignment_vocabulary_item_id, feedback_type
        )
        values ($1, $2, $3, $4, 'vocabulary_example')
      `,
      [`ai-feedback-attempt-${randomUUID()}`, assignmentId, studentId, vocabularyItemId],
    );
    await client.query("commit");
    return { ok: true };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
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
  const last = requestHistory.get(session.studentId) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "AI 첨삭 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const assignmentId = String(body.assignmentId ?? "").trim();
  const vocabularyItemId = String(body.assignmentVocabularyItemId ?? "").trim();
  const word = String(body.word ?? "").trim();
  const meaning = String(body.meaning ?? "").trim();
  const sentence = String(body.sentence ?? "").trim();

  if (!assignmentId || !vocabularyItemId) return NextResponse.json({ error: "AI 첨삭 요청 정보가 부족합니다." }, { status: 400 });
  if (!sentence) return NextResponse.json({ error: "첨삭할 문장을 입력해주세요." }, { status: 400 });
  if (sentence.length > 500) return NextResponse.json({ error: "문장이 너무 깁니다. 500자 이하로 작성해주세요." }, { status: 400 });

  requestHistory.set(session.studentId, now);

  try {
    const attempt = await reserveFeedbackAttempt({ assignmentId, vocabularyItemId, studentId: session.studentId });
    if (!attempt.ok) {
      return NextResponse.json({ error: "AI 첨삭은 제출 1회당 최대 3번까지 받을 수 있습니다.", remainingAttempts: 0 }, { status: 429 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "AI 첨삭 횟수를 확인하지 못했습니다." }, { status: 500 });
  }

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
            content: VOCABULARY_FEEDBACK_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Correct the student's vocabulary word, phrase, or sentence without inventing new context.",
              targetVocabulary: {
                word,
                koreanMeaning: meaning,
              },
              studentInput: sentence,
              outputRules: {
                correctedText: "Correct only the student's input. Preserve its scope: word stays word, phrase stays phrase, sentence stays sentence.",
                feedback: "Korean explanation for the student. Mention the main mistake and what improved.",
                grammarNotes: "Korean notes focused on concrete grammar/expression fixes.",
              },
            }),
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

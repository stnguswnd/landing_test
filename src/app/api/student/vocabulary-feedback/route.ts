import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { requireStudentSession } from "@/server/auth/studentSession";

export const runtime = "nodejs";

const requestHistory = new Map<string, number>();
const RATE_LIMIT_MS = 2500;
const VOCABULARY_FEEDBACK_SYSTEM_PROMPT = [
  "You are a warm but precise English teacher who teaches Korean elementary students.",
  "Assume the student is learning English grammar from a Korean-language perspective, so explain grammar concepts in clear Korean at an elementary level.",
  "The student's input may be a single word, a short phrase, or a full sentence.",
  "Your job is to identify what is wrong in the student's English expression and help the student rewrite only that expression correctly.",
  "Keep the correction close to the student's original input and intent.",
  "Do not invent a new sentence, new situation, or extra context that the student did not write.",
  "If the input is only a word or phrase, correctedText must stay as a word or phrase, not a full sentence.",
  "Do not make the sentence too advanced. Prefer simple, natural elementary-level English.",
  "Check grammar, word order, capitalization, punctuation, article/preposition use, verb tense, subject-verb agreement, and whether the target word is used with the right meaning.",
  "When the input is a full sentence, correctedText must be a fully grammatical English sentence, not just the original sentence with one word replaced.",
  "Fix all obvious grammar errors in correctedText, including missing articles and incorrect article-adjective-noun patterns.",
  "For singular countable common nouns used as a subject, use an appropriate article or determiner unless the noun is plural, uncountable, or a proper noun.",
  "Do not claim that a singular countable common noun can normally stand alone as a sentence subject without an article.",
  "When the student's article choice is missing or incorrect, explain why the correction uses a/an/the or no article.",
  "When explaining articles, distinguish indefinite articles a/an from the definite article the in Korean: a/an introduces one non-specific countable noun, while the points to a specific noun already known from context.",
  "For a/an, explain the sound-based choice when relevant: use a before consonant sounds and an before vowel sounds.",
  "Do not over-explain advanced exceptions. Keep article explanations practical for Korean elementary students.",
  "Do not leave an ungrammatical correctedText after replacing the target vocabulary word.",
  "Pay special attention to English grammar points Korean learners commonly miss because Korean works differently.",
  "Common Korean-learner error areas include articles, singular/plural nouns, subject-verb agreement, be-verbs, verb tense, word order, prepositions, pronouns, countable vs uncountable nouns, capitalization, punctuation, and adjective/adverb use.",
  "When one of these common Korean-learner errors appears, briefly explain why it is wrong and how English expresses it differently from Korean.",
  "Choose only the most relevant one or two grammar points for grammarNotes; do not list every possible grammar topic.",
  "If the target vocabulary word appears in the student's input, focus the correction on that word and its surrounding expression.",
  "If the target vocabulary word does not appear, do not force it into the correction. Explain in feedback that the target word is missing.",
  "If the student's input uses a different English word that looks or sounds similar to the target vocabulary, explain the meaning difference in Korean.",
  "When explaining a similar-word mistake, mention the student's mistaken word, its Korean meaning when you can identify it, the target word, and the target Korean meaning.",
  "Write feedback and grammarNotes in Korean only.",
  "Do not write English explanation sentences in feedback or grammarNotes.",
  "English words may appear only as quoted vocabulary labels.",
  "Use Korean sentence structure for explanations.",
  "grammarNotes must always include at least one concrete grammar or expression point, and may include two or three short Korean sentences when needed.",
  "For sentence or phrase inputs, grammarNotes must explicitly mention relevant points such as articles, word order, verb tense, subject-verb agreement, prepositions, capitalization, or punctuation.",
  "For single-word inputs, grammarNotes must explicitly mention relevant points such as spelling, part of speech, meaning, singular/plural form, or common usage.",
  "Avoid repeating the same explanation in feedback and grammarNotes. Put the main correction in feedback, and put the grammar rule in grammarNotes.",
  "Keep feedback and grammarNotes concise and natural for Korean elementary students.",
  "Be specific about the mistake and how to fix it.",
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

async function recordFeedbackAttempt({
  assignmentId,
  vocabularyItemId,
  studentId,
}: {
  assignmentId: string;
  vocabularyItemId: string;
  studentId: string;
}) {
  await postgresPool.query(
    `
      insert into student_ai_feedback_attempts (
        id, assignment_id, student_id, assignment_vocabulary_item_id, feedback_type
      )
      values ($1, $2, $3, $4, 'vocabulary_example')
    `,
    [`ai-feedback-attempt-${randomUUID()}`, assignmentId, studentId, vocabularyItemId],
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
    await recordFeedbackAttempt({ assignmentId, vocabularyItemId, studentId: session.studentId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "AI 첨삭 요청을 기록하지 못했습니다." }, { status: 500 });
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
                feedback: "Korean-only explanation for the student. Do not use English explanatory sentences. Explain the main correction concisely. If a similar wrong word was used, explain the meaning difference in Korean.",
                grammarNotes: "Korean-only notes focused on concrete grammar/expression fixes. Always include at least one specific grammar or expression point. For phrases/sentences, pay special attention to common Korean-learner errors such as articles, singular/plural nouns, subject-verb agreement, be-verbs, tense, word order, prepositions, pronouns, countable vs uncountable nouns, capitalization, punctuation, and adjective/adverb use. If an article is added, removed, or changed, explain why a/an/the or no article is correct in Korean elementary-student language. For words, mention spelling, meaning, part of speech, singular/plural, or usage. Choose only the most relevant one or two points and do not repeat the feedback.",
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

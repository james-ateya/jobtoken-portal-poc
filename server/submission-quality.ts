import type { SupabaseClient } from "@supabase/supabase-js";

export type QualityReport = {
  ai_probability: number;
  relevance_score: number;
  spelling_grammar_score: number;
  effort_score: number;
  flags: string[];
  recommendation: "pass" | "review" | "fail";
  summary: string;
};

export type PlagiarismResult = {
  is_plagiarized: boolean;
  similarity_score: number;
  most_similar_index: number | null;
};

export function isQualityCheckEnabled(): boolean {
  const v = (process.env.GEMINI_QUALITY_CHECK_ENABLED || "").toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

async function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your-gemini-api-key") return null;
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey: key });
}

const RATE_WINDOW_MS = 60_000;
const MAX_RPM = 14;
let rateSlots: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  rateSlots = rateSlots.filter((t) => now - t < RATE_WINDOW_MS);
  if (rateSlots.length >= MAX_RPM) return true;
  rateSlots.push(now);
  return false;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const braces = text.match(/\{[\s\S]*\}/);
  return braces ? braces[0] : text;
}

function clamp(n: unknown, min = 0, max = 100): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(min, Math.min(max, v));
}

function normalizeRecommendation(r: unknown): "pass" | "review" | "fail" {
  const s = String(r || "").toLowerCase();
  if (s === "pass") return "pass";
  if (s === "fail") return "fail";
  return "review";
}

export async function analyzeSubmission(
  promptInstructions: string,
  answerText: string
): Promise<QualityReport> {
  const ai = await getGeminiClient();
  if (!ai) throw new Error("Gemini API key not configured. Add a valid GEMINI_API_KEY to your environment.");
  if (isRateLimited()) throw new Error("Gemini rate limit reached — try again in a minute");

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `You are a submission quality analyzer for a job-token platform where seekers answer prompts to earn rewards. Analyze the submitted answer against the prompt instructions and return a JSON object.

PROMPT INSTRUCTIONS:
${promptInstructions}

SUBMITTED ANSWER:
${answerText}

Return ONLY valid JSON (no markdown fencing) with these fields:
{
  "ai_probability": <0-100 integer, likelihood this was AI-generated>,
  "relevance_score": <0-100 integer, how well it addresses the prompt>,
  "spelling_grammar_score": <0-100 integer, language quality>,
  "effort_score": <0-100 integer, genuine effort vs filler/gibberish>,
  "flags": [<list of short concern strings, e.g. "likely AI-generated", "off-topic", "copy-paste filler">],
  "recommendation": "pass" | "review" | "fail",
  "summary": "<1-2 sentence explanation>"
}`,
    });
  } catch (err: any) {
    if (err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Gemini API quota exceeded. Wait a minute and try again, or verify your API key at https://aistudio.google.com/apikey");
    }
    throw err;
  }

  const raw = extractJson(response.text ?? "{}");
  const parsed = JSON.parse(raw);

  return {
    ai_probability: clamp(parsed.ai_probability),
    relevance_score: clamp(parsed.relevance_score),
    spelling_grammar_score: clamp(parsed.spelling_grammar_score),
    effort_score: clamp(parsed.effort_score),
    flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : [],
    recommendation: normalizeRecommendation(parsed.recommendation),
    summary: String(parsed.summary || ""),
  };
}

export async function checkPlagiarism(
  answerText: string,
  otherAnswers: string[]
): Promise<PlagiarismResult> {
  if (otherAnswers.length === 0) {
    return { is_plagiarized: false, similarity_score: 0, most_similar_index: null };
  }

  const ai = await getGeminiClient();
  if (!ai) throw new Error("Gemini API key not configured");
  if (isRateLimited()) throw new Error("Gemini rate limit reached — try later");

  const answersBlock = otherAnswers
    .slice(0, 10)
    .map((a, i) => `[${i}]: ${a.slice(0, 500)}`)
    .join("\n\n");

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Compare the MAIN ANSWER against the OTHER ANSWERS submitted for the same prompt. Check for plagiarism or near-identical copying.

Return ONLY valid JSON (no markdown fencing):
{
  "is_plagiarized": <boolean>,
  "similarity_score": <0-100 integer>,
  "most_similar_index": <integer index or null>
}

MAIN ANSWER:
${answerText.slice(0, 1000)}

OTHER ANSWERS:
${answersBlock}`,
    });
  } catch (err: any) {
    if (err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Gemini API quota exceeded. Wait a minute and try again, or verify your API key at https://aistudio.google.com/apikey");
    }
    throw err;
  }

  const raw = extractJson(response.text ?? "{}");
  const parsed = JSON.parse(raw);

  return {
    is_plagiarized: Boolean(parsed.is_plagiarized),
    similarity_score: clamp(parsed.similarity_score),
    most_similar_index:
      typeof parsed.most_similar_index === "number" ? parsed.most_similar_index : null,
  };
}

/**
 * Run quality analysis and store the report on the submission row.
 * Intended to be called fire-and-forget after a successful submission.
 */
export async function analyzeAndStoreReport(
  supabaseAdmin: SupabaseClient,
  submissionId: string,
  promptInstructions: string,
  answerText: string,
  promptId: string
): Promise<void> {
  const report = await analyzeSubmission(promptInstructions, answerText);

  const { data: others } = await supabaseAdmin
    .from("prompt_submissions")
    .select("answer_text")
    .eq("prompt_id", promptId)
    .neq("id", submissionId)
    .limit(10);

  if (others && others.length > 0) {
    try {
      const plagiarism = await checkPlagiarism(
        answerText,
        others.map((o: { answer_text: string }) => o.answer_text)
      );
      if (plagiarism.is_plagiarized) {
        report.flags.push(`plagiarism detected (${plagiarism.similarity_score}% similar)`);
        if (report.recommendation === "pass") report.recommendation = "review";
      }
      (report as any).plagiarism = plagiarism;
    } catch (e) {
      console.error("plagiarism check failed:", e);
    }
  }

  await supabaseAdmin
    .from("prompt_submissions")
    .update({
      quality_report: report,
      quality_checked_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
}

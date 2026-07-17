import type { SupabaseClient } from "@supabase/supabase-js";
import { getPromptTierId, getTierEconomics } from "./reward-cap.js";

export type QualityReport = {
  ai_probability: number;
  relevance_score: number;
  spelling_grammar_score: number;
  effort_score: number;
  flags: string[];
  recommendation: "pass" | "review" | "fail";
  summary: string;
  improvement_tips: string[];
  suggested_grading_note: string;
  confidence: number;
  economics_hint: string | null;
  plagiarism?: PlagiarismResult;
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

const FREE_TIER_RPM = 5;
const FREE_TIER_RPD = 1500;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

let minuteSlots: number[] = [];
let daySlots: number[] = [];

function pruneSlots() {
  const now = Date.now();
  minuteSlots = minuteSlots.filter((t) => now - t < MINUTE_MS);
  daySlots = daySlots.filter((t) => now - t < DAY_MS);
}

function isRateLimited(): boolean {
  pruneSlots();
  if (minuteSlots.length >= FREE_TIER_RPM || daySlots.length >= FREE_TIER_RPD) return true;
  const now = Date.now();
  minuteSlots.push(now);
  daySlots.push(now);
  return false;
}

export function getGeminiQuotaStatus() {
  pruneSlots();
  const now = Date.now();
  const usedRpm = minuteSlots.length;
  const usedRpd = daySlots.length;
  const oldestMinuteSlot = minuteSlots.length > 0 ? minuteSlots[0] : null;
  const cooldownMs =
    usedRpm >= FREE_TIER_RPM && oldestMinuteSlot
      ? Math.max(0, MINUTE_MS - (now - oldestMinuteSlot))
      : 0;

  return {
    rpm: { used: usedRpm, limit: FREE_TIER_RPM },
    rpd: { used: usedRpd, limit: FREE_TIER_RPD },
    cooldown_ms: cooldownMs,
    available: usedRpm < FREE_TIER_RPM && usedRpd < FREE_TIER_RPD,
  };
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

type FairnessContext = {
  seekerPassed: number;
  seekerFailed: number;
  seekerGraded: number;
  isReturning: boolean;
  promptPassRate: number | null;
  promptGraded: number;
  tierTargetPassRate: number;
  tierId: string;
};

export async function analyzeSubmission(
  promptInstructions: string,
  answerText: string,
  fairness?: FairnessContext | null
): Promise<QualityReport> {
  const ai = await getGeminiClient();
  if (!ai) throw new Error("Gemini API key not configured. Add a valid GEMINI_API_KEY to your environment.");
  if (isRateLimited()) throw new Error("Gemini rate limit reached — try again in a minute");

  const fairnessBlock = fairness
    ? `
SEEKER HISTORY (for fairness context only — grade the answer on merit):
- Graded answers: ${fairness.seekerGraded} (passed ${fairness.seekerPassed}, failed ${fairness.seekerFailed})
- Returning seeker: ${fairness.isReturning ? "yes" : "no"}
- This prompt pass rate so far: ${
        fairness.promptPassRate == null
          ? "n/a (no graded answers yet)"
          : `${(fairness.promptPassRate * 100).toFixed(0)}% of ${fairness.promptGraded} graded`
      }
- Tier target pass rate: ${(fairness.tierTargetPassRate * 100).toFixed(0)}% (${fairness.tierId})

FAIRNESS RULES:
- Do not punish or favor the seeker because of past grades.
- Grade this answer on quality vs the prompt.
- If failing, always explain how to improve (concrete, kind, actionable).
- If returning seeker with prior passes and issues are minor/borderline, prefer "review" over harsh "fail".
`
    : "";

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are a submission quality analyzer for a job-token platform where seekers (often university students) answer prompts to earn rewards. Admins use your output as guidance only — they confirm the final grade.

PROMPT INSTRUCTIONS:
${promptInstructions}

SUBMITTED ANSWER:
${answerText}
${fairnessBlock}
Return ONLY valid JSON (no markdown fencing) with these fields:
{
  "ai_probability": <0-100 integer, likelihood this was AI-generated>,
  "relevance_score": <0-100 integer, how well it addresses the prompt>,
  "spelling_grammar_score": <0-100 integer, language quality>,
  "effort_score": <0-100 integer, genuine effort vs filler/gibberish>,
  "flags": [<list of short concern strings, e.g. "likely AI-generated", "off-topic", "copy-paste filler">],
  "recommendation": "pass" | "review" | "fail",
  "summary": "<1-2 sentence explanation for the admin>",
  "confidence": <0-100 integer, how confident you are in the recommendation>,
  "improvement_tips": [<2-4 short concrete tips for the seeker if not a clear pass; empty array if strong pass>],
  "suggested_grading_note": "<ready-to-send feedback note to the seeker; on fail/review include what to improve; on pass congratulate briefly and note strengths>"
}`,
    });
  } catch (err: any) {
    if (err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error(
        "Gemini API quota exceeded. Wait a minute and try again, or verify your API key at https://aistudio.google.com/apikey"
      );
    }
    throw err;
  }

  const raw = extractJson(response.text ?? "{}");
  const parsed = JSON.parse(raw);
  const tips = Array.isArray(parsed.improvement_tips)
    ? parsed.improvement_tips.map(String).filter(Boolean).slice(0, 6)
    : [];

  return {
    ai_probability: clamp(parsed.ai_probability),
    relevance_score: clamp(parsed.relevance_score),
    spelling_grammar_score: clamp(parsed.spelling_grammar_score),
    effort_score: clamp(parsed.effort_score),
    flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : [],
    recommendation: normalizeRecommendation(parsed.recommendation),
    summary: String(parsed.summary || ""),
    improvement_tips: tips,
    suggested_grading_note: String(parsed.suggested_grading_note || parsed.summary || "").trim(),
    confidence: clamp(parsed.confidence ?? 60),
    economics_hint: null,
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
      model: "gemini-3.5-flash",
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

async function loadFairnessContext(
  supabaseAdmin: SupabaseClient,
  userId: string,
  promptId: string,
  submitCostTokens: number
): Promise<FairnessContext> {
  const econ = getTierEconomics(submitCostTokens);
  const tierId = getPromptTierId(submitCostTokens);

  const { data: seekerRows } = await supabaseAdmin
    .from("prompt_submissions")
    .select("grade_status")
    .eq("user_id", userId)
    .in("grade_status", ["pass", "fail"])
    .order("graded_at", { ascending: false })
    .limit(10);

  const seekerPassed = (seekerRows ?? []).filter((r) => r.grade_status === "pass").length;
  const seekerFailed = (seekerRows ?? []).filter((r) => r.grade_status === "fail").length;
  const seekerGraded = seekerPassed + seekerFailed;

  const { data: promptRows } = await supabaseAdmin
    .from("prompt_submissions")
    .select("grade_status")
    .eq("prompt_id", promptId)
    .in("grade_status", ["pass", "fail"]);

  const promptPassed = (promptRows ?? []).filter((r) => r.grade_status === "pass").length;
  const promptGraded = (promptRows ?? []).filter((r) =>
    r.grade_status === "pass" || r.grade_status === "fail"
  ).length;
  const promptPassRate = promptGraded > 0 ? promptPassed / promptGraded : null;

  return {
    seekerPassed,
    seekerFailed,
    seekerGraded,
    isReturning: seekerGraded > 0,
    promptPassRate,
    promptGraded,
    tierTargetPassRate: econ.targetPassRate,
    tierId,
  };
}

function applyEconomicsGuidance(report: QualityReport, fairness: FairnessContext): void {
  const rate = fairness.promptPassRate;
  if (rate == null) {
    report.economics_hint = `No graded answers yet on this prompt. Tier target pass rate: ${(fairness.tierTargetPassRate * 100).toFixed(0)}% (${fairness.tierId}).`;
    return;
  }

  const pct = (rate * 100).toFixed(0);
  const targetPct = (fairness.tierTargetPassRate * 100).toFixed(0);

  if (rate > fairness.tierTargetPassRate) {
    report.economics_hint = `Prompt pass rate is ${pct}% (above ${targetPct}% ${fairness.tierId} target). Look carefully before another pass.`;
    if (report.recommendation === "pass" && report.confidence < 80) {
      report.recommendation = "review";
      report.flags = [...report.flags, "pass-rate above tier target — confirm carefully"];
      report.summary = `${report.summary} [Economics: pass rate hot — suggestion downgraded to review.]`.trim();
    }
  } else if (rate < fairness.tierTargetPassRate * 0.7) {
    report.economics_hint = `Prompt pass rate is ${pct}% (below ${targetPct}% ${fairness.tierId} target). Still grade on merit; do not pass weak work to fill the rate.`;
  } else {
    report.economics_hint = `Prompt pass rate is ${pct}% (near ${targetPct}% ${fairness.tierId} target).`;
  }
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
  const { data: sub } = await supabaseAdmin
    .from("prompt_submissions")
    .select("user_id")
    .eq("id", submissionId)
    .maybeSingle();

  const { data: prompt } = await supabaseAdmin
    .from("prompts")
    .select("submit_cost_tokens")
    .eq("id", promptId)
    .maybeSingle();

  const submitCost = Number(prompt?.submit_cost_tokens) || 1;
  const userId = sub?.user_id as string | undefined;

  let fairness: FairnessContext | null = null;
  if (userId) {
    try {
      fairness = await loadFairnessContext(supabaseAdmin, userId, promptId, submitCost);
    } catch (e) {
      console.error("fairness context failed:", e);
    }
  }

  const report = await analyzeSubmission(promptInstructions, answerText, fairness);

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
        if (!report.improvement_tips.length) {
          report.improvement_tips = [
            "Write your answer in your own words — do not copy another submission.",
            "Address each part of the prompt with original examples or reasoning.",
          ];
        }
        if (!report.suggested_grading_note) {
          report.suggested_grading_note =
            "Your answer appears too similar to another submission. Please rewrite in your own words and resubmit only if allowed.";
        }
      }
      report.plagiarism = plagiarism;
    } catch (e) {
      console.error("plagiarism check failed:", e);
    }
  }

  if (fairness) applyEconomicsGuidance(report, fairness);

  if (
    (report.recommendation === "fail" || report.recommendation === "review") &&
    !report.suggested_grading_note &&
    report.improvement_tips.length
  ) {
    report.suggested_grading_note = `Thanks for submitting. To improve:\n${report.improvement_tips
      .map((t, i) => `${i + 1}. ${t}`)
      .join("\n")}`;
  }

  await supabaseAdmin
    .from("prompt_submissions")
    .update({
      quality_report: report,
      quality_checked_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
}

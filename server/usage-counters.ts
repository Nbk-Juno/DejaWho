import { sql } from "drizzle-orm";
import { usageCounters, type UsageCounter } from "@shared/schema";
import { db } from "./db";
import { AiPolicyError } from "./ai-policy";

export type MonthlyAiOperation = "voice_transcriptions" | "tts_calls" | "parse_calls" | "search_calls";

export const AI_MONTHLY_LIMITS: Record<MonthlyAiOperation, number> = {
  voice_transcriptions: monthlyLimitFromEnv("AI_MONTHLY_VOICE_TRANSCRIPTION_LIMIT", 100),
  tts_calls: monthlyLimitFromEnv("AI_MONTHLY_TTS_LIMIT", 200),
  parse_calls: monthlyLimitFromEnv("AI_MONTHLY_PARSE_LIMIT", 200),
  search_calls: monthlyLimitFromEnv("AI_MONTHLY_SEARCH_LIMIT", 500),
};

export type MonthlyUsageSummary = {
  yearMonth: string;
  resetDate: string;
  voiceTranscriptions: { count: number; cap: number };
  ttsCalls: { count: number; cap: number };
  parseCalls: { count: number; cap: number };
  searchCalls: { count: number; cap: number };
};

const OPERATION_COLUMNS = {
  voice_transcriptions: sql.raw("voice_transcriptions"),
  tts_calls: sql.raw("tts_calls"),
  parse_calls: sql.raw("parse_calls"),
  search_calls: sql.raw("search_calls"),
} as const;

function monthlyLimitFromEnv(name: string, fallback: number): number {
  const configured = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : fallback;
}

export function monthlyLimitFor(operation: MonthlyAiOperation): number {
  if (operation === "voice_transcriptions") {
    return monthlyLimitFromEnv("AI_MONTHLY_VOICE_TRANSCRIPTION_LIMIT", AI_MONTHLY_LIMITS.voice_transcriptions);
  }
  if (operation === "tts_calls") {
    return monthlyLimitFromEnv("AI_MONTHLY_TTS_LIMIT", AI_MONTHLY_LIMITS.tts_calls);
  }
  if (operation === "parse_calls") {
    return monthlyLimitFromEnv("AI_MONTHLY_PARSE_LIMIT", AI_MONTHLY_LIMITS.parse_calls);
  }
  return monthlyLimitFromEnv("AI_MONTHLY_SEARCH_LIMIT", AI_MONTHLY_LIMITS.search_calls);
}

export function currentYearMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function nextMonthlyResetDate(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

export async function getMonthlyUsage(
  userId: string,
  yearMonth = currentYearMonth(),
): Promise<UsageCounter | undefined> {
  const [row] = await db
    .select()
    .from(usageCounters)
    .where(sql`${usageCounters.userId} = ${userId} AND ${usageCounters.yearMonth} = ${yearMonth}`)
    .limit(1);
  return row;
}

export async function getMonthlyUsageSummary(userId: string): Promise<MonthlyUsageSummary> {
  const yearMonth = currentYearMonth();
  const usage = await getMonthlyUsage(userId, yearMonth);

  return {
    yearMonth,
    resetDate: nextMonthlyResetDate(),
    voiceTranscriptions: {
      count: usage?.voiceTranscriptions ?? 0,
      cap: monthlyLimitFor("voice_transcriptions"),
    },
    ttsCalls: {
      count: usage?.ttsCalls ?? 0,
      cap: monthlyLimitFor("tts_calls"),
    },
    parseCalls: {
      count: usage?.parseCalls ?? 0,
      cap: monthlyLimitFor("parse_calls"),
    },
    searchCalls: {
      count: usage?.searchCalls ?? 0,
      cap: monthlyLimitFor("search_calls"),
    },
  };
}

export async function reserveMonthlyAiCall(
  userId: string,
  operation: MonthlyAiOperation,
  yearMonth = currentYearMonth(),
): Promise<void> {
  const column = OPERATION_COLUMNS[operation];
  const limit = monthlyLimitFor(operation);
  const rows = await db.execute(sql`
    INSERT INTO usage_counters (user_id, year_month, ${column})
    VALUES (${userId}, ${yearMonth}, 1)
    ON CONFLICT (user_id, year_month) DO UPDATE
    SET ${column} = usage_counters.${column} + 1,
        updated_at = now()
    WHERE usage_counters.${column} < ${limit}
    RETURNING user_id
  `);

  if (Array.isArray(rows) && rows.length > 0) {
    return;
  }

  throw new AiPolicyError(
    "You've reached your monthly AI usage limit. Contact support if you need more room.",
    429,
    "ai_monthly_limit_reached",
  );
}

export async function rollbackMonthlyAiCall(
  userId: string,
  operation: MonthlyAiOperation,
  yearMonth = currentYearMonth(),
): Promise<void> {
  const column = OPERATION_COLUMNS[operation];
  await db.execute(sql`
    UPDATE usage_counters
    SET ${column} = GREATEST(${column} - 1, 0),
        updated_at = now()
    WHERE user_id = ${userId}
      AND year_month = ${yearMonth}
  `);
}

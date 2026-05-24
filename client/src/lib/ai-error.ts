import { ApiError } from "./queryClient";
import { queryClient } from "./queryClient";

type UsageSummary = { resetDate?: string };

/**
 * Format an error from an AI-backed API call into a toast title.
 *
 * - 429 with `ai_monthly_limit_reached` → quota message with the reset date
 *   (read from the cached /api/me/usage response when available)
 * - Offline (navigator.onLine === false OR network-style errors) → clear "offline" copy
 * - Anything else → the provided fallback
 */
export function formatAiErrorTitle(err: unknown, fallback: string): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You're offline — try again when you reconnect.";
  }

  if (err instanceof ApiError) {
    if (err.status === 429 && err.code === "ai_monthly_limit_reached") {
      const usage = queryClient.getQueryData<UsageSummary>(["/api/me/usage"]);
      const reset = usage?.resetDate
        ? new Date(`${usage.resetDate}T00:00:00Z`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : null;
      return reset
        ? `You've hit this month's AI limit (resets ${reset}).`
        : "You've hit this month's AI limit.";
    }
    if (err.status === 413 && err.code === "ai_input_too_large") {
      return "That's a bit too long for one recording — try shorter.";
    }
  }

  // Network-style errors thrown by fetch (e.g., DNS, connection refused).
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return "You're offline — try again when you reconnect.";
  }

  return fallback;
}

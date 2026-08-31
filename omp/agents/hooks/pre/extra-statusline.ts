/**
 * Extra statusline to show information the default status can't/won't show.
 *
 * - approximate session cost
 * - Claude usage, mirrors the extra-$ logic from statusline.sh.
 * - Codex usage
 * - Count "fuck"s
 */
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import type { UsageLimit, UsageReport } from "@oh-my-pi/pi-ai";
import { homedir } from "node:os";
import { join } from "node:path";
type MetricsFn = (text: string) => { yelling: number; profanity: number; anguish: number; negation: number; repetition: number; blame: number };
// Static subpath imports of @oh-my-pi/omp-stats fail from the hook directory
// (Bun 1.4.0 "Unexpected" on wildcard exports). Resolve from the bun global
// store where the package actually lives, then dynamic-import the absolute path.
const _bunGlobal = join(process.env.BUN_INSTALL ?? join(homedir(), ".bun"), "install", "global");
const computeUserMessageMetrics = ((await import(
  Bun.resolveSync("@oh-my-pi/omp-stats/user-metrics", _bunGlobal)
)) as { computeUserMessageMetrics: MetricsFn }).computeUserMessageMetrics;

interface Cache<T> {
  value: T;
  at: number;
}

let usageCache: Cache<UsageReport[]> | null = null;
const TTL = 5 * 60 * 1000; // 5 minutes

async function fetchUsageReports(ctx: ExtensionContext): Promise<UsageReport[]> {
  const now = Date.now();
  if (usageCache && now - usageCache.at < TTL) return usageCache.value;

  try {
    const reports = await ctx.modelRegistry.authStorage.fetchUsageReports();
    if (reports) {
      usageCache = { value: reports, at: Date.now() };
      return reports;
    }
  } catch {}

  return usageCache?.value ?? [];
}

type ProviderIdentity = { accountId?: string; email?: string; orgId?: string };

function reportMatchesActiveAccount(report: UsageReport, identity: ProviderIdentity | undefined): boolean {
  if (!identity) return true;
  const metadata = report.metadata ?? {};
  if (identity.accountId && metadata.accountId !== identity.accountId) return false;
  if (identity.email && metadata.email !== identity.email) return false;
  if (identity.orgId && metadata.orgId !== identity.orgId) return false;
  return true;
}

function getReportForProvider(
  ctx: ExtensionContext,
  reports: UsageReport[],
  provider: string,
): UsageReport | undefined {
  const identity = ctx.modelRegistry.authStorage.getOAuthAccountIdentity(
    provider,
    ctx.sessionManager.getSessionId(),
  );
  return reports.find(
    report => report.provider === provider && reportMatchesActiveAccount(report, identity),
  );
}

function getActiveReport(ctx: ExtensionContext, reports: UsageReport[]): UsageReport | undefined {
  // Documentation: this was the original behavior, showing only the active model's provider.
  const provider = ctx.model?.provider;
  return provider ? getReportForProvider(ctx, reports, provider) : undefined;
}

const SHOW_ALL_PROVIDER_QUOTAS = true;
const QUOTA_PROVIDERS = ["anthropic", "openai-codex"] as const;

function getQuotaReports(ctx: ExtensionContext, reports: UsageReport[]): UsageReport[] {
  // Hardcoded on: keep both provider quotas visible when the model changes.
  if (SHOW_ALL_PROVIDER_QUOTAS) {
    return QUOTA_PROVIDERS.flatMap(provider => {
      const report = getReportForProvider(ctx, reports, provider);
      return report ? [report] : [];
    });
  }

  // Documentation: restore active-provider-only behavior by changing the constant above.
  const report = getActiveReport(ctx, reports);
  return report ? [report] : [];
}

function getUsagePercent(limit: UsageLimit): number | undefined {
  const fraction = limit.amount.usedFraction;
  if (typeof fraction === "number" && Number.isFinite(fraction)) return fraction * 100;
  if (limit.amount.unit === "percent" && typeof limit.amount.used === "number") {
    return Number.isFinite(limit.amount.used) ? limit.amount.used : undefined;
  }
  if (
    typeof limit.amount.used === "number" &&
    typeof limit.amount.limit === "number" &&
    Number.isFinite(limit.amount.used) &&
    Number.isFinite(limit.amount.limit) &&
    limit.amount.limit > 0
  ) {
    return (limit.amount.used / limit.amount.limit) * 100;
  }
  return undefined;
}

function formatDuration(msDelta: number): string {
  const mins = Math.max(0, Math.round(msDelta / 60_000));
  const days = Math.floor(mins / 1_440);
  const hours = Math.floor((mins % 1_440) / 60);
  const minutes = mins % 60;
  if (days > 0) return hours > 0 ? `${days}d${hours}h` : `${days}d`;
  return hours > 0 ? `${hours}h${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

function formatReset(resetAt: number | undefined): string {
  return resetAt === undefined ? "" : ` (${formatDuration(resetAt - Date.now())})`;
}
function formatResetDate(resetAt: number | undefined): string {
  return resetAt === undefined
    ? ""
    : ` ${new Date(resetAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}`;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

const claudeQuota = {
  format(report: UsageReport): string | undefined {
    const extra = report.limits.find(
      limit => limit.id === "anthropic:extra" || limit.scope.windowId === "extra",
    );
    if (!extra || typeof extra.amount.used !== "number" || !Number.isFinite(extra.amount.used)) {
      return undefined;
    }
    const used = extra.amount.used.toFixed(2);
    if (typeof extra.amount.limit === "number" && Number.isFinite(extra.amount.limit)) {
      const resetAt = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        1,
      ).getTime();
      return `Claude $${used}/$${Math.round(extra.amount.limit)}${formatResetDate(resetAt)}`;
    }
    return `Claude $${used}`;
  },
};

const codexQuota = {
  getWindowId(limit: UsageLimit): "5h" | "7d" | undefined {
    const windowId = limit.window?.id ?? limit.scope.windowId;
    if (windowId === "5h" || windowId === "7d") return windowId;
    const durationMs = limit.window?.durationMs;
    if (typeof durationMs !== "number") return undefined;
    if (Math.abs(durationMs - 5 * 3_600_000) <= 60_000) return "5h";
    if (Math.abs(durationMs - 7 * 86_400_000) <= 60_000) return "7d";
    return undefined;
  },

  getCreditUsage(report: UsageReport): { used: string; limit: string; resetAt?: number } | undefined {
    const raw = getRecord(report.raw);
    const spendControl = getRecord(raw?.spend_control);
    const individualLimit = getRecord(spendControl?.individual_limit);
    const used = individualLimit?.used;
    const limit = individualLimit?.limit;
    if (
      (typeof used !== "number" && typeof used !== "string") ||
      (typeof limit !== "number" && typeof limit !== "string") ||
      !String(used).trim() ||
      !String(limit).trim()
    ) {
      return undefined;
    }
    const resetAtValue = Number(individualLimit?.reset_at);
    const resetAfterSeconds = Number(individualLimit?.reset_after_seconds);
    const resetAt =
      Number.isFinite(resetAtValue) && resetAtValue > 0
        ? resetAtValue * 1000
        : Number.isFinite(resetAfterSeconds) && resetAfterSeconds > 0
          ? Date.now() + resetAfterSeconds * 1000
          : undefined;
    return { used: String(used), limit: String(limit), resetAt };
  },

  getCreditsBalance(report: UsageReport): string | undefined {
    const raw = getRecord(report.raw);
    const credits = getRecord(raw?.credits);
    const balance = credits?.balance;
    if (typeof balance === "number" && Number.isFinite(balance)) return String(balance);
    if (typeof balance === "string" && balance.trim()) return balance;
    return undefined;
  },

  formatCredits(value: string): string {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? String(Math.max(0, Math.floor(parsed))) : value;
  },

  formatCreditUsage(usage: { used: string; limit: string; resetAt?: number }): string {
    return `${codexQuota.formatCredits(usage.used)}/${codexQuota.formatCredits(usage.limit)}${formatResetDate(usage.resetAt)}`;
  },

  format(report: UsageReport): string | undefined {
    const windows: Partial<Record<"5h" | "7d", UsageLimit>> = {};
    for (const limit of report.limits) {
      const windowId = codexQuota.getWindowId(limit);
      if (windowId && !windows[windowId]) windows[windowId] = limit;
    }

    const parts: string[] = [];
    for (const windowId of ["5h", "7d"] as const) {
      const limit = windows[windowId];
      if (!limit) continue;
      const percent = getUsagePercent(limit);
      if (percent === undefined) continue;
      const label = windowId === "7d" ? "wk" : "5h";
      const resetAt = limit.window?.resetsAt;
      parts.push(`${label} ${Math.round(Math.min(Math.max(percent, 0), 100))}%${formatReset(resetAt)}`);
    }
    const creditUsage = codexQuota.getCreditUsage(report);
    const credits = codexQuota.getCreditsBalance(report);
    if (creditUsage !== undefined) parts.push(codexQuota.formatCreditUsage(creditUsage));
    else if (credits !== undefined) parts.push(codexQuota.formatCredits(credits));
    return parts.length ? `Codex ${parts.join(" ")}` : undefined;
  },
};

function formatQuota(report: UsageReport | undefined): string | undefined {
  if (!report) return undefined;
  if (report.provider === "anthropic") return claudeQuota.format(report);
  if (report.provider === "openai-codex") return codexQuota.format(report);
  return undefined;
}

export default function (pi: ExtensionAPI): void {
  let sig = { yelling: 0, profanity: 0, anguish: 0, negation: 0, repetition: 0, blame: 0 };

  async function update(ctx: ExtensionContext): Promise<void> {
    if (!ctx.hasUI) return;
    const { cost } = ctx.sessionManager.getUsageStatistics();
    const reports = await fetchUsageReports(ctx);
    const parts: string[] = [];

    parts.push(`$${cost.toFixed(3)}`);

    for (const report of getQuotaReports(ctx, reports)) {
      const quota = formatQuota(report);
      if (quota) parts.push(quota);
    }

    const signals: string[] = [];
    if (sig.yelling)    signals.push(`CAPS:${sig.yelling}`);
    if (sig.profanity)  signals.push(`fucks:${sig.profanity}`);
    if (sig.anguish)    signals.push(`ugh:${sig.anguish}`);
    if (sig.negation)   signals.push(`neg:${sig.negation}`);
    if (sig.repetition) signals.push(`rep:${sig.repetition}`);
    if (sig.blame)      signals.push(`blame:${sig.blame}`);
    if (signals.length) parts.push(signals.join(" "));

    ctx.ui.setStatus("extra", parts.join(" | "));
  }

  pi.on("session_start", async (_event, ctx) => update(ctx));
  pi.on("turn_start", async (_event, ctx) => update(ctx));
  pi.on("turn_end", async (_event, ctx) => update(ctx));
  pi.on("input", async (event, ctx) => {
    const m = computeUserMessageMetrics(event.text);
    const delta = m.yelling + m.profanity + m.anguish + m.negation + m.repetition + m.blame;
    if (delta > 0) {
      sig.yelling    += m.yelling;
      sig.profanity  += m.profanity;
      sig.anguish    += m.anguish;
      sig.negation   += m.negation;
      sig.repetition += m.repetition;
      sig.blame      += m.blame;
      await update(ctx);
    }
  });
}

/**
 * WIP to show information the default status line can't show.
 *
 * - Enterprise Claude usages, mirrors the extra-$ logic from statusline.sh.
 * - Count "fuck"s
 */
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { Database } from "bun:sqlite";
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

interface ExtraUsage {
  is_enabled: boolean;
  monthly_limit: number; // credits — divide by 100 for USD
  used_credits: number; // credits — divide by 100 for USD
}

let cached: { extra: ExtraUsage | null; at: number } | null = null;
const TTL = 5 * 60 * 1000; // 5 minutes

async function getOAuthToken(): Promise<string | null> {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return process.env.CLAUDE_CODE_OAUTH_TOKEN;

  // OMP stores its Anthropic OAuth token in agent.db
  try {
    const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".omp", "agent");
    const db = new Database(join(agentDir, "agent.db"), { readonly: true });
    const row = db
      .query<{ data: string }, []>(
        "SELECT data FROM auth_credentials WHERE provider='anthropic' AND credential_type='oauth' AND disabled_cause IS NULL ORDER BY updated_at DESC LIMIT 1",
      )
      .get();
    db.close();
    if (row) {
      const token = JSON.parse(row.data)?.access;
      if (typeof token === "string" && token) return token;
    }
  } catch {}

  // Claude Code keychain fallback
  try {
    const raw = await Bun.$`security find-generic-password -s "Claude Code-credentials" -w`
      .quiet()
      .text();
    const token = JSON.parse(raw.trim())?.claudeAiOauth?.accessToken;
    if (typeof token === "string" && token) return token;
  } catch {}

  // Claude Code credentials file fallback
  try {
    const data = await Bun.file(join(homedir(), ".claude", ".credentials.json")).json();
    const token = data?.claudeAiOauth?.accessToken;
    if (typeof token === "string" && token) return token;
  } catch {}

  return null;
}

async function fetchExtraUsage(): Promise<ExtraUsage | null> {
  const now = Date.now();
  if (cached && now - cached.at < TTL) return cached.extra;

  const token = await getOAuthToken();
  if (!token) return null;

  try {
    const resp = await fetch("https://api.anthropic.com/api/oauth/usage", {
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
        "User-Agent": "claude-code/2.1.34",
      },
    });
    if (!resp.ok) return null;
    const body = await resp.json();
    const extra: ExtraUsage | null = body?.extra_usage ?? null;
    cached = { extra, at: now };
    return extra;
  } catch {
    return null;
  }
}

export default function (pi: ExtensionAPI): void {
  let sig = { yelling: 0, profanity: 0, anguish: 0, negation: 0, repetition: 0, blame: 0 };

  async function update(ctx: ExtensionContext): Promise<void> {
    if (!ctx.hasUI) return;
    const { cost } = ctx.sessionManager.getUsageStatistics();
    const extra = await fetchExtraUsage();
    const parts: string[] = [];

    parts.push(`$${cost.toFixed(4)}`);

    if (extra?.is_enabled && extra.used_credits > 0) {
      const used = (extra.used_credits / 100).toFixed(2);
      const limit = Math.round(extra.monthly_limit / 100);
      const now = new Date();
      const reset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        .toLocaleDateString("en-US", { month: "short", day: "numeric" })
        .toUpperCase();
      parts.push(`$${used}/$${limit} ${reset}`);
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

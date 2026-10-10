import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { computeUserMessageMetrics } from "../lib/user-metrics";

const COMMIT = /(?:^|[;&|]\s*)git\s+commit\b/;

type Part = { type: string; text?: string; id?: string; name?: string; arguments?: { command?: unknown } };
type Message = {
  role: string;
  content: string | Part[];
  toolCallId?: string;
  isError?: boolean;
  usage?: { input: number; output: number; cost: { total: number } };
};

function trailer(ctx: ExtensionContext): string {
  const messages = ctx.sessionManager
    .getBranch()
    .flatMap((entry) => (entry.type === "message" ? [entry.message as Message] : []));

  const commitCallIds = new Set(
    messages.flatMap((m) =>
      m.role === "assistant" && Array.isArray(m.content)
        ? m.content
            .filter(
              (p) =>
                p.type === "toolCall" &&
                p.name === "bash" &&
                typeof p.arguments?.command === "string" &&
                COMMIT.test(p.arguments.command),
            )
            .map((p) => p.id)
        : [],
    ),
  );
  const lastCommit = messages.findLastIndex(
    (m) => m.role === "toolResult" && !m.isError && commitCallIds.has(m.toolCallId),
  );

  let input = 0;
  let output = 0;
  let cost = 0;
  let prompts = 0;
  let signaledPrompts = 0;
  for (const m of messages.slice(lastCommit + 1)) {
    if (m.role === "assistant" && m.usage) {
      input += m.usage.input;
      output += m.usage.output;
      cost += m.usage.cost.total;
    } else if (m.role === "user") {
      prompts++;
      const text =
        typeof m.content === "string"
          ? m.content
          : m.content.map((p) => (p.type === "text" ? p.text : "")).join("\n");
      const s = computeUserMessageMetrics(text);
      if (s.yelling + s.profanity + s.anguish + s.negation + s.repetition + s.blame > 0) {
        signaledPrompts++;
      }
    }
  }

  const parts = [
    `model=${ctx.model?.id ?? "unknown"}`,
    `prompts=${prompts}`,
    `cost=${cost.toFixed(2)}`,
    `tokens=${input}/${output}`,
  ];
  if (prompts) parts.push(`poop=${(signaledPrompts / prompts).toFixed(2)}`);
  return `Agent-Usage: ${parts.join(" ")}`;
}

export default function commitUsage(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash" || typeof event.input.command !== "string") return;
    // TODO: on --amend, sum this usage into the existing Agent-Usage trailer instead of skipping it.
    const unquoted = event.input.command.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, "");
    if (!COMMIT.test(event.input.command) || /\bgit\s+commit\b[^;&|]*\s--amend\b/.test(unquoted)) return;
    const command = event.input.command.replace(
      COMMIT,
      (match) => `${match} --trailer '${trailer(ctx)}'`,
    );
    return { input: { ...event.input, command } };
  });
}

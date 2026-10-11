import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { computeUserMessageMetrics } from "../lib/user-metrics";

const COMMIT = /(?:^|[;&|]\s*)git\s+(?:-c\s+\S+\s+)*commit\b/;
const AMEND = /\bgit\s+(?:-c\s+\S+\s+)*commit\b[^;&|]*\s--amend\b/;
const REPLACE = "-c trailer.Agent-Usage.ifexists=replace";
const OLD_TRAILER = /\s+--trailer(?:=|\s+)(['"])Agent-Usage:.*?\1/g;
const NOTE =
  "[commit-usage] A hook added the --trailer 'Agent-Usage: …' argument to this git commit command. The values come from omp session usage data. Do not add, change, or remove this trailer yourself; the hook adds it again on every commit and amend.";

type Part = { type: string; text?: string; id?: string; name?: string; arguments?: { command?: unknown } };
type Message = {
  role: string;
  content: string | Part[];
  toolCallId?: string;
  isError?: boolean;
  usage?: { input: number; output: number; cost: { total: number } };
};

type Usage = { prompts: number; signaled: number; cost: number; input: number; output: number };

function sessionUsage(ctx: ExtensionContext): Usage {
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

  return { prompts, signaled: signaledPrompts, cost, input, output };
}

function headUsage(cwd: string): Usage {
  const { stdout } = Bun.spawnSync(
    ["git", "log", "-1", "--format=%(trailers:key=Agent-Usage,valueonly,unfold)"],
    { cwd },
  );
  const fields = Object.fromEntries(
    stdout
      .toString()
      .trim()
      .split(/\s+/)
      .map((field) => field.split("=")),
  );
  const [input, output] = (fields.tokens ?? "0/0").split("/").map(Number);
  const prompts = Number(fields.prompts ?? 0);
  return {
    prompts,
    signaled: Math.round(Number(fields.poop ?? 0) * prompts),
    cost: Number(fields.cost ?? 0),
    input,
    output,
  };
}

function trailer(model: string, u: Usage): string {
  const parts = [
    `model=${model}`,
    `prompts=${u.prompts}`,
    `cost=${u.cost.toFixed(2)}`,
    `tokens=${u.input}/${u.output}`,
  ];
  if (u.prompts) parts.push(`poop=${(u.signaled / u.prompts).toFixed(2)}`);
  return `Agent-Usage: ${parts.join(" ")}`;
}

function commandEnd(command: string, start: number): number {
  let quote = "";
  for (let i = start; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = "";
      else if (c === "\\" && quote === '"') i++;
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "\\") i++;
    else if (";&|\n".includes(c)) return i;
  }
  return command.length;
}

export default function commitUsage(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash" || typeof event.input.command !== "string") return;
    const unquoted = event.input.command.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, "");
    if (!COMMIT.test(event.input.command)) return;
    const stripped = event.input.command.replace(OLD_TRAILER, "");
    const match = COMMIT.exec(stripped);
    if (!match) return;
    let usage = sessionUsage(ctx);
    let prefix = match[0];
    if (AMEND.test(unquoted)) {
      const old = headUsage(ctx.cwd);
      usage = {
        prompts: old.prompts + usage.prompts,
        signaled: old.signaled + usage.signaled,
        cost: old.cost + usage.cost,
        input: old.input + usage.input,
        output: old.output + usage.output,
      };
      if (!prefix.includes(REPLACE)) prefix = prefix.replace(/git\s+/, `git ${REPLACE} `);
    }
    const rest = stripped.slice(match.index + match[0].length);
    const end = commandEnd(rest, 0);
    const segment = `${stripped.slice(0, match.index)}${prefix}${rest.slice(0, end)}`;
    const head = segment.trimEnd();
    const tail = segment.slice(head.length) + rest.slice(end);
    const command = `${head} --trailer '${trailer(ctx.model?.id ?? "unknown", usage)}'${tail}`;
    return { input: { ...event.input, command } };
  });

  pi.on("tool_result", async (event) => {
    if (event.toolName !== "bash" || typeof event.input.command !== "string") return;
    if (!event.input.command.includes("--trailer 'Agent-Usage:")) return;
    return { content: [...event.content, { type: "text", text: NOTE }] };
  });
}

import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { computeUserMessageMetrics } from "../lib/user-metrics";

const COMMIT = /(?:^|[;&|]\s*)git\s+commit\b/;

export default function commitUsage(pi: ExtensionAPI): void {
  let baseline = { cost: 0, input: 0, output: 0 };
  let prompts = 0;
  let signaledPrompts = 0;

  function trailer(ctx: ExtensionContext): string {
    const { cost, input, output } = ctx.sessionManager.getUsageStatistics();
    const tokens = `${input - baseline.input}/${output - baseline.output}`;
    const parts = [
      `model=${ctx.model?.id ?? "unknown"}`,
      `prompts=${prompts}`,
      `cost=${(cost - baseline.cost).toFixed(2)}`,
      `tokens=${tokens}`,
    ];
    if (prompts) parts.push(`poop=${(signaledPrompts / prompts).toFixed(2)}`);
    return `Agent-Usage: ${parts.join(" ")}`;
  }

  pi.on("input", async (event) => {
    prompts++;
    const m = computeUserMessageMetrics(event.text);
    if (m.yelling + m.profanity + m.anguish + m.negation + m.repetition + m.blame > 0) {
      signaledPrompts++;
    }
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash" || typeof event.input.command !== "string") return;
    if (!COMMIT.test(event.input.command)) return;
    const command = event.input.command.replace(
      COMMIT,
      (match) => `${match} --trailer '${trailer(ctx)}'`,
    );
    return { input: { ...event.input, command } };
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "bash" || event.isError) return;
    if (typeof event.input.command !== "string" || !COMMIT.test(event.input.command)) return;
    const { cost, input, output } = ctx.sessionManager.getUsageStatistics();
    baseline = { cost, input, output };
    prompts = 0;
    signaledPrompts = 0;
  });
}

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const MARKER = "[commit-guide]";
const GUIDE = `${MARKER} Commit message rules:

Subject line:
1. If a tool generated the change, the subject line is the command executed (e.g. \`ruff --fix\`, \`make reports\`).
2. If the commit is mainly about one symbol, argument, or config option, put its exact name near the start, so that a reader who scans \`git log --oneline\` can find the commit that changed it.
3. Aim for under 72 characters.

Body:
4. 5 lines or fewer. You can use Markdown.
5. Write the intent and the outcome. Do not summarize or list the changed code.
6. Write down architectural decisions. Say where the user corrected you.
7. If you verified the change, write how you verified it (e.g. the command or test you ran) and the result.
8. If you ran benchmarks, write the before and after numbers and the command you ran.

Before you commit:
9. If this change fixes your earlier commit, amend that commit. Do not make an "oops" commit.`;

const ADD = /(?:^|[;&|]\s*)git\s+add\b/;
const COMMIT = /(?:^|[;&|]\s*)git\s+commit\b/;

type Part = {
  type: string;
  text?: string;
  name?: string;
  arguments?: { command?: unknown };
};

export default function commitGuide(pi: ExtensionAPI): void {
  let pending = false;

  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return;
    const cmd =
      typeof event.input.command === "string" ? event.input.command : "";
    if (COMMIT.test(cmd)) {
      pending = false;
      return;
    }
    if (!ADD.test(cmd) || pending) return;
    pending = true;
    return { additionalContext: GUIDE };
  });

  pi.on("context", async (event) => {
    const lastCommit = event.messages.findLastIndex(
      (m) =>
        m.role === "assistant" &&
        Array.isArray(m.content) &&
        (m.content as Part[]).some(
          (part) =>
            part.type === "toolCall" &&
            part.name === "bash" &&
            typeof part.arguments?.command === "string" &&
            COMMIT.test(part.arguments.command),
        ),
    );
    if (lastCommit < 0) return;

    let changed = false;
    const messages = event.messages.map((m, i) => {
      if (i > lastCommit || !Array.isArray(m.content)) return m;
      const content = (m.content as Part[]).map((part) => {
        if (part.type !== "text" || !part.text?.includes(MARKER)) return part;
        changed = true;
        return { ...part, text: "[commit guide elided]" };
      });
      return { ...m, content };
    });
    return changed ? { messages } : undefined;
  });
}

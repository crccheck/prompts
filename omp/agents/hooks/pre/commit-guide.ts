import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const MARKER = "[commit-guide]";
const GUIDE = `${MARKER} Commit message rules. Apply every section that matches.

All commits (default: the project squashes commits):
1. Write WHY, not WHAT. The diff shows what changed. Write only what the diff cannot show, and only enough for the next LLM pass to continue. Do not reword or format.
2. If a tool generated the change, the subject line is the command executed (e.g. \`ruff --fix\`, \`make reports\`).
3. If the commit is mainly about one symbol, argument, or config option, put its exact name near the start of the subject line, so that a reader who scans \`git log --oneline\` can find the commit that changed it.
4. Aim for a subject line under 72 characters.
5. Body: write why you made the change, what is left, and what is broken or unverified. Write architectural decisions. Say where the user corrected you. Never summarize or list the changed code.
6. Amend (\`git commit --amend\`) instead of making a new commit if all are true: you made HEAD in this session, HEAD is not pushed, and this change corrects or completes HEAD (same task, a bug in it, a missed file, a test or lint fix for it). Make a new commit only for a new task.

WIP commit (only if the user asked for "wip"):
7. Add the prefix \`wip: \` to the subject line.

Merge-commit projects (only if the repo prompt says the project does not squash):
8. Summary: the intent and the outcome, in 3 lines or fewer. Stop when the why is written. Do not summarize or list the changed code.
9. Verification: only if you verified the change, add a few lines with the command or test you ran and the result.
10. Benchmarks: only if you ran benchmarks, add a few lines with the before and after numbers and the command you ran.
11. Never add a section with nothing to report. Wrap lines at 72 characters, but do not break URLs. You can use Markdown.`;

const ADD = /(?:^|[;&|]\s*)git\s+add\b/;
const COMMIT = /(?:^|[;&|]\s*)git\s+(?:-c\s+\S+\s+)*commit\b/;

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
        return { ...part, text: "[commit guide elided: a hook gave commit-message rules here and removed them after the commit]" };
      });
      return { ...m, content };
    });
    return changed ? { messages } : undefined;
  });
}

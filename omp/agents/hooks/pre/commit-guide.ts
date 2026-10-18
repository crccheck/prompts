import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const MARKER = "[commit-guide]";
const GUIDE = `${MARKER} Commit message rules. Apply every section that matches.

All commits (default: the project squashes commits):
1. Write WHY, not WHAT. The diff shows what changed. Write only what the diff cannot show, and only enough for the next LLM pass to continue. Do not reword or format.
2. If a tool generated the change, the subject line is the command executed (e.g. \`ruff --fix\`, \`make reports\`).
3. If the commit is mainly about one symbol, argument, or config option, put its exact name near the start of the subject line, so that a reader who scans \`git log --oneline\` can find the commit that changed it.
4. Aim for a subject line under 72 characters.
5. Body: only facts about the project that stay true after this session ends: why the change was made, and design decisions a future reader of the code needs. The commit message is project history, not a report to the user. Never put in it: a summary of the conversation, your doubts or opinions, open questions, what the user said or corrected, how you tested it, tasks for the user, what is left to do, or caveats you would tell the user in chat (those go in your chat reply). Never summarize or list the changed code. Test each body line: "Is this a fact about the code or the change that a maintainer needs in a year?" If not, delete it.
6. Amend (\`git commit --amend\`) instead of making a new commit if all are true: you made HEAD in this session, HEAD is not pushed, and this change corrects or completes HEAD (same task, a bug in it, a missed file, a test or lint fix for it). Make a new commit only for a new task.

Subject prefix (decided only by the user's exact words in this request):
7. If the user said "commit wip": start the subject with \`wip: \`.
   If the user said "commit with <type>": use \`<type>: subject\`.
   If the user said "commit with <type/scope>": use \`<type>(<scope>): subject\`.
   Otherwise: use a plain sentence subject. The subject MUST NOT contain a prefix: no "word:" or "word(scope):" start, no made-up type or label of any kind, and no colon in the first words. Only the user's exact words above allow a prefix. Do not capitalize the first word.

Merge-commit projects (only if the repo prompt says the project does not squash):
8. Summary: the intent and the outcome, in 3 lines or fewer. Stop when the why is written. Do not summarize or list the changed code.
9. Verification: only if you ran a command or test, add one line with the command and the result. Put it in its own paragraph, after a blank line. Do not describe manual or exploratory testing.
10. Benchmarks: only if you ran benchmarks, add a few lines with the before and after numbers and the command you ran. Put it in its own paragraph, after a blank line.
11. Separate the Summary, Verification, and Benchmarks sections with a blank line. Never run them together in one paragraph. Never add a section with nothing to report. Wrap lines at 72 characters, but do not break URLs. You can use Markdown.`;

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

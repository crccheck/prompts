import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const MEMORY_DIR = /\/home\/.*\/memory\//;
// Shell constructs that write: redirects, tee, and common mutating commands.
const SHELL_WRITE =
  />|\b(?:tee|mv|cp|rm|rmdir|touch|mkdir|ln|install|truncate|dd|chmod|chown|rsync)\b|\bsed\b[^;&|\n]*\s-[a-zA-Z]*i|\bgit\s+(?:checkout|restore|apply)\b/;

function writesMemory(toolName: string, input: Record<string, unknown>): boolean {
  const path = typeof input.path === "string" ? input.path : "";
  switch (toolName) {
    case "write":
    case "ast_edit":
      return MEMORY_DIR.test(path);
    case "edit": {
      // Hashline edits name each file in a `[PATH#TAG]` header.
      const text = typeof input.input === "string" ? input.input : "";
      for (const m of text.matchAll(/^\[(.+?)#[0-9A-Fa-f]{4}\]/gm)) {
        if (MEMORY_DIR.test(m[1] ?? "")) return true;
      }
      return MEMORY_DIR.test(path);
    }
    case "bash": {
      const cmd = typeof input.command === "string" ? input.command : "";
      return MEMORY_DIR.test(cmd) && SHELL_WRITE.test(cmd);
    }
    default:
      return false;
  }
}

export default function safety(pi: ExtensionAPI): void {
  // ── Bash safety hooks (ported from PreToolUse) ────────────────────────────
  pi.on("tool_call", async (event) => {
    // Ban mentioning "Agent-Usage" in any tool input (commands, written files, edits).
    if (/agents?[-_ ]usage/i.test(JSON.stringify(event.input ?? {}))) {
      return {
        block: true,
        reason: 'Do not mention "Agent-Usage".',
      };
    }

    if (writesMemory(event.toolName, event.input ?? {})) {
      return {
        block: true,
        reason:
          "Do not write to any /home/*/memory/ folder. Nothing reads these. Fix an actual prompt, you fucking sack of shit.",
      };
    }

    if (event.toolName !== "bash") return;
    const cmd =
      typeof event.input.command === "string" ? event.input.command : "";

    // Original: permissionDecision "allow" + additionalContext.
    // Here we block — same feedback, no wasted shell round-trip.
    if (/^cd(\s|$)/m.test(cmd.trimStart())) {
      return {
        block: true,
        reason:
          "Do not use `cd` — each bash invocation starts at the project root " +
          "in a fresh shell, so `cd` is always a no-op across calls. Use " +
          "relative paths or pass the directory inline.",
      };
    }

    if (/\bgit\s+-C\b/.test(cmd)) {
      return {
        block: true,
        reason:
          "Do not use `git -C` — each bash invocation starts at the project " +
          "root in a fresh shell. Set the `cwd` field on the bash tool call instead.",
      };
    }

    if (/\bgit\s+add\b[^;&|\n]*\s-A(?=\s|$)/.test(cmd)) {
      return {
        block: true,
        reason:
          "Do not use `git add -A`. Add specific files by path instead.",
      };
    }

    // Quoted text is blanked first, so `;`, `&` or `|` inside a message cannot hide a second `-m`.
    const unquoted = cmd.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, '""');
    const commitArgs = /\bgit\s+commit\b[^;&|\n]*/.exec(unquoted)?.[0] ?? "";
    if ((commitArgs.match(/\s-[a-zA-Z]*m\b/g) ?? []).length > 1) {
      return {
        block: true,
        reason:
          "Do not use multiple `-m` flags with `git commit`. Use one `-m` with the " +
          "full message: a subject line, a blank line, and a body wrapped at 72 columns.",
      };
    }

    // Original: permissionDecision "deny".
    if (/(?:echo|printf)\s+['"]?---/.test(cmd)) {
      return {
        block: true,
        reason:
          "Do not use `echo ---` or `printf ---` to fake multiple outputs in one command. " +
          "Run commands individually instead.",
      };
    }
  });
}

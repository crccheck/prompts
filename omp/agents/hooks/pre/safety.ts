import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export default function safety(pi: ExtensionAPI): void {
  // ── Bash safety hooks (ported from PreToolUse) ────────────────────────────
  pi.on("tool_call", async (event) => {
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

    if (/\bgit\s+commit\b[^;&|\n]*\s-[a-zA-Z]*m\b[^;&|\n]*\s-[a-zA-Z]*m\b/.test(cmd)) {
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

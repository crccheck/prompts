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
          "relative paths or pass the directory inline (e.g. `git -C /path …`).",
      };
    }

    // Original: permissionDecision "deny".
    if (/echo\s+['"]?---/.test(cmd)) {
      return {
        block: true,
        reason:
          "Do not use `echo ---` to fake multiple outputs in one command. " +
          "Run commands individually instead.",
      };
    }
  });
}

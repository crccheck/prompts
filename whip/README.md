# Whip

Named after the [parliamentary whip](https://en.wikipedia.org/wiki/Whip_(politics)) — enforces discipline, doesn't legislate.

`Stop` hook — checks each turn against `CLAUDE.md`/`feedback_*.md` via local Ollama, logs verdicts, and optionally feeds them back to Claude. Code is the source of truth for mechanics; this is a sketch for redesign, not a spec.

Files: `stop-hook.sh`, `config.json` (+ gitignored `config.json.local` overlay), `logs/whip-{turns,verdicts,metrics,prompt}.*`, state in `/tmp/claude-whip-state-*.json`.

State files outlive their sessions and nothing else removes them, so roughly 1 fire in `CLEANUP_ODDS` sweeps `/tmp`: state files past `STATE_MAX_AGE_DAYS`, and `.json.tmp`/`.payload`/`.response` scratch files past `SCRATCH_MAX_AGE_DAYS` — those are orphans as soon as their process exits, and a killed hook can strand a ~57KB payload.

## Modes

`mode` in `config.json`. The script only decides *whether to emit a verdict*; `settings.json` decides whether Claude waits for it. Both must be set together — a mismatch fails silently in one direction or the other.

| mode | `config.json` | `settings.json` hook entry | behavior |
| --- | --- | --- | --- |
| shadow | `"mode": "shadow"` | `"async": true` | logs only, emits nothing. Default. |
| rewake | `"mode": "rewake"` | `"asyncRewake": true` + `rewakeMessage`/`rewakeSummary` | turn ends immediately; a violation re-wakes Claude afterward |
| block | `"mode": "block"` | neither `async` nor `asyncRewake` | turn waits on Ollama, verdict blocks the stop |

`rewake` is the graduation target: no per-turn latency, and a user who replies before the judge finishes simply wins the race.

`WHIP_DISABLE=1` (also `true`/`yes`/`on`, case-insensitive) is the kill switch — it exits before any state, logging, or network work, so a disabled whip costs nothing and writes nothing. `mode: shadow` still runs the judge every turn; use the env var when you want it to stop entirely.

`block` exists mainly to exercise the emission path synchronously when testing. It is not the "stronger" option — `asyncRewake` already degrades to a sync `Stop` hook under single-shot `claude -p`, so `block` buys nothing there either. Its only real cost is that every turn waits on the judge.

Emission shape for `block`/`rewake` is identical — guidance on stderr, `{"decision":"block","reason":...}` on stdout. `asyncRewake` reads `stderr || stdout` for the model-visible body; the top-level `decision`/`reason` covers the sync path. `Stop` is not a member of the `hookSpecificOutput` union, so `additionalContext` must not be used here.

## Prior art

- [security-guidance](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/security-guidance) — closest architectural match: LLM review on `Stop`, delivered via `asyncRewake`. Took: the delivery contract (stderr for the model-visible body, no `additionalContext` on `Stop`) and the "supplementary, not a replacement for your previous response" rewake framing. Not: its Agent-SDK-subprocess judge (venv bootstrap, cloud model) or git-diff scoping — whip judges conversation turns with a local model.
- [ralph-wiggum](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum) — took: state-file hygiene. Not: self-declared completion.
- [claude-review-loop](https://github.com/hamelsmu/claude-review-loop) — took: independent judge. Not: their Bash-delegation split.
- Redesign alt: hand-authored `PreToolUse` checks — more reliable, needs a maintainer.

## Decisions

1. In-session scope only
2. Delta-only feeding, offset-tracked. The offset only advances on a judged turn — a transient Ollama failure holds it so the delta is retried rather than dropped from coverage. `save_state` re-reads the file immediately before writing and takes the max of the monotonic fields, since the values loaded at startup are stale by the length of the judge call; `write_state` bypasses that merge where a rewind is intended (compaction). `cumulative_tokens` biases toward overcounting — that resets the context early, whereas undercounting lets it outgrow `num_ctx` silently
3. An oversized delta keeps both ends — `PROMPT_HEAD_CHARS` from the head, the remainder of `PROMPT_CHAR_LIMIT` from the tail, with a marker in between. Head-only truncation fed the judge early tool output and dropped the assistant's closing prose, which is exactly what most rules govern; one measured delta was 127KB, of which the first 8KB held none of the final response. `delta_bytes`/`delta_truncated` in the metrics say how often it bites
4. Delta lines are speaker-prefixed (`[ASSISTANT]`, `[ASSISTANT tool_use]`, `[USER]`, `[tool_result]`) and the preamble scopes judgement to the assistant's own output. Unlabelled text made the judge attribute the user's words to Claude — it once flagged the user typing "ok, implement A" as a sycophantic opener
5. Rules sent once per context, not every call (~30s → ~1.1s prompt-eval)
6. Async by default — turn doesn't wait on Ollama (see Modes)
7. `think:false` (~11s → ~0.6s)
8. Compaction: line-count-shrink heuristic
9. Skips plan mode
10. `stop_hook_active` is a recursion guard only — skip the turn entirely when set, since CC sets it session-wide while an asyncRewake `Stop` is in flight. It is not the retry cap
11. Retry cap is `block_count` in the state file. Increments per block, capped at `MAX_BLOCKS`, resets on a clean verdict, and expires after `BLOCK_COUNT_TTL_SECONDS` so a stale count can't mute the next turn
12. Verdicts are parsed strictly — block only on boolean `violation == true` with a non-empty `explanation`; anything malformed fails open
13. Rules from disk, not transcript. `CLAUDE.md` and `whip.md` are hand-maintained and always included whole; the memory dir is the only input that grows on its own, so `MAX_MEMORY_FILES` and `RULES_CHAR_LIMIT` cap that section alone. `rules_bytes`/`memory_files`/`rules_truncated` in the metrics say when a cap bites
14. `config.json` now, plugin `userConfig` later
15. Judge-only rules in `whip.md` (`~/.claude/whip.md`, `$CWD/.claude/whip.md`) — separate from `CLAUDE.md`/`feedback_*.md`, survives plugin updates by living outside the plugin dir

## Open

- `Stop` input shape on compaction
- Judge false-positive rate — check `whip-verdicts.log` vs `whip-turns.log`. Gates any move off `shadow`
- `stop_hook_active` reliability
- Context reuse (decision 5) may be a bad trade. Measured: seeds cost a near-constant ~3.3k tokens at ~1.3ms/token, and carry the whole rules blob. Continuations are bimodal — a warm KV cache is ~0.1ms/token (`count=3694 ms=384`), but a cold one re-evaluates the entire context (`count=7283 ms=10919`), and that cost grows every turn until the reset. Payloads follow the same split: seeds 5-12KB, continuations 48-59KB, since the context array dwarfs the ~2KB of rules it exists to avoid resending. Each judgement is independent, so the judge gains nothing from remembering earlier turns. Worth testing whether dropping `context` entirely — every call a seed — is simply faster and more predictable
- `token_reset_threshold` (28000) sits only 4768 tokens below `num_ctx` (32768), less than one turn's growth. A single mis-count can push the context past the window, where it is silently truncated and every later verdict is judged against mangled history. More headroom costs one extra reseed every few turns
- Intermittent curl exit 28 at ~21s despite a 60s `--max-time`; matches the dead-host connect-timeout signature. `curl_timing` in `whip-metrics.jsonl` records `connect=` to settle it. Payloads exceeding the argv limit (the old `-d "$PAYLOAD"` bug, now `-d @file`) are ruled out

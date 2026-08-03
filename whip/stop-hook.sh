#!/bin/bash
# Shadow-mode Stop hook: checks each turn's delta against CLAUDE.md + feedback
# memory via a local Ollama model, logging turn/verdict pairs. Never blocks.
# Fails open on any error (missing files, unreachable Ollama, corrupt state).

# Master kill switch. Exits before any state, logging, or network work, so a
# disabled whip costs nothing and leaves no trace. `mode: shadow` still runs
# the judge - use this when you want it to stop entirely.
# Prior art: security-guidance SECURITY_GUIDANCE_DISABLE.
case "$(printf '%s' "${WHIP_DISABLE:-}" | tr '[:upper:]' '[:lower:]')" in
  1|true|yes|on) exit 0 ;;
esac

DEFAULT_MODEL="qwen3.6"
DEFAULT_THINK=false
DEFAULT_NUM_CTX=32768
DEFAULT_OLLAMA_URL="http://localhost:11434/api/generate"
DEFAULT_CURL_TIMEOUT=20
DEFAULT_TOKEN_RESET_THRESHOLD=28000
DEFAULT_MODE="shadow"
# Keep both ends of an oversized delta. The user's request sits at the head and
# the assistant's closing prose at the tail; the bulk in between is tool output,
# which is the least rule-relevant part. Taking only the head fed the judge
# early tool results and dropped the very text most rules govern.
PROMPT_CHAR_LIMIT=8000
PROMPT_HEAD_CHARS=2500
MAX_BLOCKS=2

# CLAUDE.md and whip.md are hand-maintained and always included whole. The
# memory dir is the only input that grows on its own, so the caps apply there.
# Prior art: security-guidance MAX_DIFF_FILES.
MAX_MEMORY_FILES=20
RULES_CHAR_LIMIT=24000

# State files outlive their sessions; nothing else ever removes them. Swept on
# roughly 1 in N fires rather than every fire, since it is pure housekeeping.
# Scratch files (.json.tmp/.payload/.response) are orphans the moment their
# process exits, so they go sooner - a killed hook can strand a ~57KB payload.
# Prior art: security-guidance cleanup_old_state_files, run on ~10% of fires.
CLEANUP_ODDS=10
STATE_MAX_AGE_DAYS=7
SCRATCH_MAX_AGE_DAYS=1

# block_count expires so a stale count from an earlier turn can't suppress
# feedback on the next one. A rewake cycle (block -> Claude fixes -> Stop
# fires again) runs well inside this window.
# Prior art: security-guidance STOP_LOOP_STATE_TTL_SEC, also 120s.
BLOCK_COUNT_TTL_SECONDS=120

# On Windows, PATH resolution for the async-spawned hook process can land on
# a curl.exe that fails to exec (observed: exit 126, repeatable). Prefer the
# Git-for-Windows copy directly when present; falls through to plain `curl`
# on Mac/Linux where this path doesn't exist.
if [ -x "/c/Program Files/Git/mingw64/bin/curl.exe" ]; then
  CURL_BIN="/c/Program Files/Git/mingw64/bin/curl.exe"
else
  CURL_BIN="curl"
fi

SYSTEM_PREAMBLE="You are reviewing one turn of an AI coding assistant's work against a fixed list of standing rules and past-mistake memories (below).

The transcript is line-prefixed by speaker. Judge ONLY lines marked [ASSISTANT] or [ASSISTANT tool_use] - those are the assistant's own output. Lines marked [USER] are the human's words and [tool_result] is program output; both are context only and can never be a violation. The rules govern how the assistant writes and acts, not how the user writes.

Decide if the assistant's output violates any rule. Do not reason in the output - decide first, then report. Respond with ONLY a JSON object: {\"violation\": true or false, \"rule\": \"short name of violated rule or empty string\", \"explanation\": \"one sentence naming what the assistant did, empty string if no violation\"}. If you are unsure, answer false."

START_NS=$(date +%s%N)
STAGE="init"
LOG_DIR="$HOME/Sync/prompts/whip/logs"
mkdir -p "$LOG_DIR"
METRICS_LOG="$LOG_DIR/whip-metrics.jsonl"

log_metrics() {
  local end_ns duration_ms
  end_ns=$(date +%s%N)
  duration_ms=$(( (end_ns - START_NS) / 1000000 ))
  local ollama_total_ms=null ollama_load_ms=null ollama_prompt_eval_ms=null ollama_eval_ms=null p_count=null e_count=null
  if [ -n "${RESPONSE:-}" ]; then
    ollama_total_ms=$(echo "$RESPONSE" | jq -r '((.total_duration // 0) / 1000000 | floor)' 2>/dev/null)
    ollama_load_ms=$(echo "$RESPONSE" | jq -r '((.load_duration // 0) / 1000000 | floor)' 2>/dev/null)
    ollama_prompt_eval_ms=$(echo "$RESPONSE" | jq -r '((.prompt_eval_duration // 0) / 1000000 | floor)' 2>/dev/null)
    ollama_eval_ms=$(echo "$RESPONSE" | jq -r '((.eval_duration // 0) / 1000000 | floor)' 2>/dev/null)
    p_count=$(echo "$RESPONSE" | jq -r '.prompt_eval_count // 0' 2>/dev/null)
    e_count=$(echo "$RESPONSE" | jq -r '.eval_count // 0' 2>/dev/null)
  fi
  for v in ollama_total_ms ollama_load_ms ollama_prompt_eval_ms ollama_eval_ms p_count e_count; do
    case "${!v}" in ''|*[!0-9]*) printf -v "$v" 'null' ;; esac
  done
  jq -nc \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg session "${SESSION_ID:-}" \
    --arg stage "$STAGE" \
    --argjson duration_ms "$duration_ms" \
    --argjson ollama_total_ms "$ollama_total_ms" \
    --argjson ollama_load_ms "$ollama_load_ms" \
    --argjson ollama_prompt_eval_ms "$ollama_prompt_eval_ms" \
    --argjson ollama_eval_ms "$ollama_eval_ms" \
    --argjson prompt_eval_count "$p_count" \
    --argjson eval_count "$e_count" \
    --argjson payload_bytes "${PAYLOAD_BYTES:-null}" \
    --arg payload_kind "${PAYLOAD_KIND:-}" \
    --arg curl_timeout "${CURL_TIMEOUT:-}" \
    --arg curl_timing "${CURL_TIMING:-}" \
    --argjson rules_bytes "${RULES_BYTES:-null}" \
    --argjson memory_files "${MEMORY_FILES_USED:-null}" \
    --argjson rules_truncated "${RULES_TRUNCATED:-0}" \
    --argjson delta_bytes "${DELTA_BYTES:-null}" \
    --argjson delta_truncated "${DELTA_TRUNCATED:-0}" \
    '{ts:$ts, session_id:$session, stage:$stage, duration_ms:$duration_ms, ollama_total_ms:$ollama_total_ms, ollama_load_ms:$ollama_load_ms, ollama_prompt_eval_ms:$ollama_prompt_eval_ms, ollama_eval_ms:$ollama_eval_ms, prompt_eval_count:$prompt_eval_count, eval_count:$eval_count, payload_bytes:$payload_bytes, payload_kind:$payload_kind, curl_timeout:$curl_timeout, curl_timing:$curl_timing, rules_bytes:$rules_bytes, memory_files:$memory_files, rules_truncated:$rules_truncated, delta_bytes:$delta_bytes, delta_truncated:$delta_truncated}' \
    >> "$METRICS_LOG" 2>/dev/null
}
trap log_metrics EXIT

HOOK_INPUT=$(cat)
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty')
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty')
PERMISSION_MODE=$(echo "$HOOK_INPUT" | jq -r '.permission_mode // empty')
STOP_HOOK_ACTIVE=$(echo "$HOOK_INPUT" | jq -r '.stop_hook_active // false')

if [ -z "$SESSION_ID" ]; then STAGE="no_session_id"; exit 0; fi
if [ -z "$TRANSCRIPT_PATH" ]; then STAGE="no_transcript_path"; exit 0; fi
if [ ! -f "$TRANSCRIPT_PATH" ]; then STAGE="transcript_missing"; exit 0; fi
if [ "$PERMISSION_MODE" = "plan" ]; then STAGE="plan_mode_skip"; exit 0; fi

# Claude Code sets this session-wide while an asyncRewake Stop is in flight,
# so judging here risks recursing on our own rewake turn. Used only as a
# recursion guard - the retry cap is block_count.
# Prior art: security-guidance handle_stop_hook, which guards on this first.
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then STAGE="stop_hook_active_skip"; exit 0; fi

if [ "$((RANDOM % CLEANUP_ODDS))" -eq 0 ]; then
  find /tmp -maxdepth 1 -name 'claude-whip-state-*.json' -mtime +"$STATE_MAX_AGE_DAYS" -delete 2>/dev/null
  find /tmp -maxdepth 1 -name 'claude-whip-state-*.json.*' -mtime +"$SCRATCH_MAX_AGE_DAYS" -delete 2>/dev/null
fi

STATE_FILE="/tmp/claude-whip-state-${SESSION_ID}.json"
TURNS_LOG="$LOG_DIR/whip-turns.log"
VERDICTS_LOG="$LOG_DIR/whip-verdicts.log"
PROMPT_LOG="$LOG_DIR/whip-prompt.log"

CONFIG_FILE="$HOME/Sync/prompts/whip/config.json"
if [ -f "$CONFIG_FILE" ] && jq -e . "$CONFIG_FILE" >/dev/null 2>&1; then
  CONFIG=$(cat "$CONFIG_FILE")
else
  CONFIG='{}'
fi
CONFIG_LOCAL_FILE="$HOME/Sync/prompts/whip/config.json.local"
if [ -f "$CONFIG_LOCAL_FILE" ] && jq -e . "$CONFIG_LOCAL_FILE" >/dev/null 2>&1; then
  CONFIG=$(echo "$CONFIG" | jq -s '.[0] * .[1]' - "$CONFIG_LOCAL_FILE")
fi
MODEL=$(echo "$CONFIG" | jq -r --arg d "$DEFAULT_MODEL" '.model // $d')
THINK=$(echo "$CONFIG" | jq -r --argjson d "$DEFAULT_THINK" 'if .think == false then false else $d end')
NUM_CTX=$(echo "$CONFIG" | jq -r --argjson d "$DEFAULT_NUM_CTX" '.num_ctx // $d')
OLLAMA_URL=$(echo "$CONFIG" | jq -r --arg d "$DEFAULT_OLLAMA_URL" '.ollama_url // $d')
CURL_TIMEOUT=$(echo "$CONFIG" | jq -r --argjson d "$DEFAULT_CURL_TIMEOUT" '.curl_timeout_seconds // $d')
TOKEN_RESET_THRESHOLD=$(echo "$CONFIG" | jq -r --argjson d "$DEFAULT_TOKEN_RESET_THRESHOLD" '.token_reset_threshold // $d')
MODE=$(echo "$CONFIG" | jq -r --arg d "$DEFAULT_MODE" '.mode // $d')

case "$MODE" in shadow|block|rewake) ;; *) MODE=$DEFAULT_MODE ;; esac

case "$NUM_CTX" in ''|*[!0-9]*) NUM_CTX=$DEFAULT_NUM_CTX ;; esac
case "$CURL_TIMEOUT" in ''|*[!0-9]*) CURL_TIMEOUT=$DEFAULT_CURL_TIMEOUT ;; esac
case "$TOKEN_RESET_THRESHOLD" in ''|*[!0-9]*) TOKEN_RESET_THRESHOLD=$DEFAULT_TOKEN_RESET_THRESHOLD ;; esac

if [ -f "$STATE_FILE" ] && jq -e . "$STATE_FILE" >/dev/null 2>&1; then
  STATE=$(cat "$STATE_FILE")
else
  STATE='{"offset":0,"context":null,"cumulative_tokens":0,"block_count":0}'
fi

OFFSET=$(echo "$STATE" | jq -r '.offset // 0')
CONTEXT=$(echo "$STATE" | jq -c '.context // null')
CUMULATIVE=$(echo "$STATE" | jq -r '.cumulative_tokens // 0')
BLOCK_COUNT=$(echo "$STATE" | jq -r '.block_count // 0')
BLOCK_COUNT_TS=$(echo "$STATE" | jq -r '.block_count_ts // 0')

case "$OFFSET" in ''|*[!0-9]*) OFFSET=0 ;; esac
case "$CUMULATIVE" in ''|*[!0-9]*) CUMULATIVE=0 ;; esac
case "$BLOCK_COUNT" in ''|*[!0-9]*) BLOCK_COUNT=0 ;; esac
case "$BLOCK_COUNT_TS" in ''|*[!0-9]*) BLOCK_COUNT_TS=0 ;; esac

NOW=$(date +%s)
if [ "$BLOCK_COUNT" -gt 0 ] && [ "$((NOW - BLOCK_COUNT_TS))" -gt "$BLOCK_COUNT_TTL_SECONDS" ]; then
  BLOCK_COUNT=0
  BLOCK_COUNT_TS=0
fi

write_state() {
  local offset="$1" context="$2" cumulative="$3" blocks="${4:-0}" blocks_ts="${5:-0}"
  local new_state
  new_state=$(jq -n --argjson offset "$offset" --argjson context "$context" --argjson cum "$cumulative" --argjson blocks "$blocks" --argjson blocks_ts "$blocks_ts" \
    '{offset:$offset, context:$context, cumulative_tokens:$cum, block_count:$blocks, block_count_ts:$blocks_ts}')
  # Prior art: ralph-wiggum's stop-hook.sh TEMP_FILE=...tmp.$$ + mv pattern.
  local tmp="${STATE_FILE}.tmp.$$"
  echo "$new_state" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

# Re-read just before writing: the values loaded at startup are stale by the
# length of the judge call. Monotonic fields take the max so a slow fire can't
# rewind what a faster one already recorded. Use write_state directly when a
# rewind is intended (compaction).
save_state() {
  local offset="$1" context="$2" cumulative="$3" blocks="${4:-0}" blocks_ts="${5:-0}"
  local d_offset d_cum d_blocks d_blocks_ts
  if [ -f "$STATE_FILE" ] && jq -e . "$STATE_FILE" >/dev/null 2>&1; then
    d_offset=$(jq -r '.offset // 0' "$STATE_FILE" 2>/dev/null)
    d_cum=$(jq -r '.cumulative_tokens // 0' "$STATE_FILE" 2>/dev/null)
    d_blocks=$(jq -r '.block_count // 0' "$STATE_FILE" 2>/dev/null)
    d_blocks_ts=$(jq -r '.block_count_ts // 0' "$STATE_FILE" 2>/dev/null)
    case "$d_offset" in ''|*[!0-9]*) d_offset=0 ;; esac
    case "$d_cum" in ''|*[!0-9]*) d_cum=0 ;; esac
    case "$d_blocks" in ''|*[!0-9]*) d_blocks=0 ;; esac
    case "$d_blocks_ts" in ''|*[!0-9]*) d_blocks_ts=0 ;; esac

    if [ "$d_offset" -gt "$offset" ]; then offset="$d_offset"; fi
    if [ "$d_blocks" -gt "$blocks" ]; then blocks="$d_blocks"; fi
    if [ "$d_blocks_ts" -gt "$blocks_ts" ]; then blocks_ts="$d_blocks_ts"; fi
    # Overcounting only resets the context early, which is safe; undercounting
    # lets it outgrow num_ctx. Skip the max when deliberately resetting.
    if [ "$context" != "null" ] && [ "$d_cum" -gt "$cumulative" ]; then cumulative="$d_cum"; fi
  fi
  write_state "$offset" "$context" "$cumulative" "$blocks" "$blocks_ts"
}

LINE_COUNT=$(wc -l < "$TRANSCRIPT_PATH" | tr -d ' ')
case "$LINE_COUNT" in ''|*[!0-9]*) STAGE="bad_line_count"; exit 0 ;; esac

# Compaction/clear/resume shrank the transcript underneath us - reset and skip
# this round rather than misjudging a summary as a real turn.
if [ "$LINE_COUNT" -lt "$OFFSET" ]; then
  write_state 0 null 0
  STAGE="compaction_reset"
  exit 0
fi

if [ "$LINE_COUNT" -le "$OFFSET" ]; then
  STAGE="no_new_lines"
  exit 0
fi

DELTA_FILE="${STATE_FILE}.delta.$$"
tail -n +"$((OFFSET + 1))" "$TRANSCRIPT_PATH" | jq -r '
  select(.type=="assistant" or .type=="user") |
  .type as $role |
  .message.content[]? |
  if .type=="text" then (if $role=="assistant" then "[ASSISTANT] " else "[USER] " end) + .text
  elif .type=="tool_use" then "[ASSISTANT tool_use] " + .name + " " + (.input | tostring)
  elif .type=="tool_result" then "[tool_result] " + (if (.content|type)=="string" then .content else (.content | tostring) end)
  else empty end
' 2>/dev/null > "$DELTA_FILE"

DELTA_BYTES=$(wc -c < "$DELTA_FILE" | tr -d ' ')
case "$DELTA_BYTES" in ''|*[!0-9]*) DELTA_BYTES=0 ;; esac

DELTA_TRUNCATED=0
if [ "$DELTA_BYTES" -gt "$PROMPT_CHAR_LIMIT" ]; then
  DELTA_TRUNCATED=1
  DELTA_TEXT="$(head -c "$PROMPT_HEAD_CHARS" "$DELTA_FILE")
[... $((DELTA_BYTES - PROMPT_CHAR_LIMIT)) characters of tool output trimmed ...]
$(tail -c "$((PROMPT_CHAR_LIMIT - PROMPT_HEAD_CHARS))" "$DELTA_FILE")"
else
  DELTA_TEXT=$(cat "$DELTA_FILE")
fi
rm -f "$DELTA_FILE"

if [ -z "$DELTA_TEXT" ]; then
  save_state "$LINE_COUNT" "$CONTEXT" "$CUMULATIVE" "$BLOCK_COUNT" "$BLOCK_COUNT_TS"
  STAGE="no_delta_text"
  exit 0
fi

RULES=""
RULES_MANIFEST=""
note_rule_source() {
  RULES_MANIFEST="${RULES_MANIFEST}$(wc -c < "$1" | tr -d ' ')	$1
"
}

for f in "$HOME/.claude/CLAUDE.md" "$CWD/.claude/CLAUDE.md"; do
  if [ -f "$f" ]; then
    RULES="${RULES}
# $f
$(cat "$f")
"
    note_rule_source "$f"
  fi
done

MEM_SLUG=$(echo "$CWD" | sed -e 's/:/-/g' -e 's/\\/-/g' -e 's/\//-/g')
MEMDIR="$HOME/.claude/projects/${MEM_SLUG}/memory"
MEMORY_FILES_USED=0
RULES_TRUNCATED=0
if [ -d "$MEMDIR" ]; then
  for f in "$MEMDIR"/feedback_*.md; do
    if [ -f "$f" ]; then
      if [ "$MEMORY_FILES_USED" -ge "$MAX_MEMORY_FILES" ] || [ "${#RULES}" -ge "$RULES_CHAR_LIMIT" ]; then
        RULES_TRUNCATED=1
        break
      fi
      RULES="${RULES}
# $(basename "$f")
$(cat "$f")
"
      note_rule_source "$f"
      MEMORY_FILES_USED=$((MEMORY_FILES_USED + 1))
    fi
  done
fi

for whip_md in "$HOME/.claude/whip.md" "$CWD/.claude/whip.md"; do
  if [ -f "$whip_md" ]; then
    RULES="${RULES}
$(cat "$whip_md")
"
    note_rule_source "$whip_md"
  fi
done

RULES_BYTES=${#RULES}

if [ -z "$RULES" ]; then
  save_state "$LINE_COUNT" "$CONTEXT" "$CUMULATIVE" "$BLOCK_COUNT" "$BLOCK_COUNT_TS"
  STAGE="no_rules"
  exit 0
fi

if [ "$CONTEXT" = "null" ] || [ -z "$CONTEXT" ]; then
  # First call since seed/reset: send full rules as system once. Ollama's
  # context array carries them forward from here, so later calls skip
  # re-evaluating this whole blob - the actual prompt-eval bottleneck.
  SYSTEM_FULL="${SYSTEM_PREAMBLE}

RULES AND MEMORIES:
${RULES}"
  PAYLOAD=$(jq -n --arg model "$MODEL" --arg sys "$SYSTEM_FULL" --arg prompt "$DELTA_TEXT" --argjson think "$THINK" --argjson num_ctx "$NUM_CTX" \
    '{model:$model, system:$sys, prompt:$prompt, stream:false, think:$think, format:"json", options:{num_ctx:$num_ctx}}')
  PAYLOAD_KIND="seed"
else
  PAYLOAD=$(jq -n --arg model "$MODEL" --arg prompt "$DELTA_TEXT" --argjson ctx "$CONTEXT" --argjson think "$THINK" --argjson num_ctx "$NUM_CTX" \
    '{model:$model, prompt:$prompt, stream:false, think:$think, format:"json", context:$ctx, options:{num_ctx:$num_ctx}}')
  PAYLOAD_KIND="continuation"
fi

if [ "${WHIP_DEBUG:-}" = "1" ] && [ "$PAYLOAD_KIND" = "seed" ]; then
  {
    echo "=== rules (session ${SESSION_ID}, $(printf '%s' "$RULES" | wc -c | tr -d ' ') bytes) ==="
    printf '%s' "$RULES_MANIFEST"
    echo "--- full text ---"
    printf '%s\n' "$RULES"
    echo
  } >> "$PROMPT_LOG"
fi

# Prior art: claude-review-loop delegates to Codex via a Bash runner script; whip calls Ollama inline.
STAGE="calling_ollama"
PAYLOAD_FILE="${STATE_FILE}.payload.$$"
printf '%s' "$PAYLOAD" > "$PAYLOAD_FILE"
PAYLOAD_BYTES=$(wc -c < "$PAYLOAD_FILE" | tr -d ' ')
case "$PAYLOAD_BYTES" in ''|*[!0-9]*) PAYLOAD_BYTES=null ;; esac
RESPONSE_FILE="${STATE_FILE}.response.$$"
CURL_TIMING=$("$CURL_BIN" -s --max-time "$CURL_TIMEOUT" "$OLLAMA_URL" -d @"$PAYLOAD_FILE" \
  -o "$RESPONSE_FILE" -w 'connect=%{time_connect} starttransfer=%{time_starttransfer} total=%{time_total}' \
  < /dev/null 2>/dev/null)
CURL_EXIT=$?
RESPONSE=$(cat "$RESPONSE_FILE" 2>/dev/null)
rm -f "$PAYLOAD_FILE" "$RESPONSE_FILE"

if [ -z "$RESPONSE" ]; then
  # Hold the offset so this delta is judged on the next fire. Advancing here
  # would silently drop the turn from coverage - and transient Ollama failures
  # are exactly when that matters.
  # Prior art: security-guidance restore_unreviewed_stop_state.
  save_state "$OFFSET" "$CONTEXT" "$CUMULATIVE" "$BLOCK_COUNT" "$BLOCK_COUNT_TS"
  case "$CURL_EXIT" in
    28) STAGE="ollama_timeout" ;;
    6|7) STAGE="ollama_unreachable" ;;
    *) STAGE="ollama_curl_error_${CURL_EXIT}" ;;
  esac
  exit 0
fi

VERDICT_RAW=$(echo "$RESPONSE" | jq -r '.response // empty' 2>/dev/null)
NEW_CONTEXT=$(echo "$RESPONSE" | jq -c '.context // null' 2>/dev/null)
TURN_TOKENS=$(echo "$RESPONSE" | jq -r '((.prompt_eval_count // 0) + (.eval_count // 0))' 2>/dev/null)
case "$TURN_TOKENS" in ''|*[!0-9]*) TURN_TOKENS=0 ;; esac

NEW_CUMULATIVE=$((CUMULATIVE + TURN_TOKENS))
if [ "$NEW_CUMULATIVE" -gt "$TOKEN_RESET_THRESHOLD" ]; then
  NEW_CONTEXT=null
  NEW_CUMULATIVE=0
fi

{
  echo "=== turn (session ${SESSION_ID}, lines ${OFFSET}->${LINE_COUNT}) ==="
  echo "$DELTA_TEXT"
  echo
} >> "$TURNS_LOG"

{
  echo "=== verdict (session ${SESSION_ID}, lines ${OFFSET}->${LINE_COUNT}) ==="
  echo "${VERDICT_RAW:-<no response>}"
  echo
} >> "$VERDICTS_LOG"

VIOLATION=$(echo "$VERDICT_RAW" | jq -r 'if (.violation == true) and ((.explanation // "") != "") then "yes" else "no" end' 2>/dev/null)

if [ "$VIOLATION" != "yes" ]; then
  save_state "$LINE_COUNT" "$NEW_CONTEXT" "$NEW_CUMULATIVE" 0
  STAGE="success"
  exit 0
fi

if [ "$MODE" = "shadow" ]; then
  save_state "$LINE_COUNT" "$NEW_CONTEXT" "$NEW_CUMULATIVE" 0
  STAGE="success_violation_shadowed"
  exit 0
fi

# Prior art: security-guidance MAX_STOP_HOOK_FIRINGS, which allows a few
# rounds of fix-and-recheck before giving up rather than blocking once.
if [ "$BLOCK_COUNT" -ge "$MAX_BLOCKS" ]; then
  save_state "$LINE_COUNT" "$NEW_CONTEXT" "$NEW_CUMULATIVE" "$BLOCK_COUNT" "$BLOCK_COUNT_TS"
  STAGE="block_cap_reached"
  exit 0
fi

VERDICT_RULE=$(echo "$VERDICT_RAW" | jq -r '.rule // ""' 2>/dev/null)
VERDICT_EXPLANATION=$(echo "$VERDICT_RAW" | jq -r '.explanation // ""' 2>/dev/null)
BLOCK_TEXT="A local judge flagged the previous turn against the user's standing rules.

Rule: ${VERDICT_RULE}
Detail: ${VERDICT_EXPLANATION}

Address or acknowledge this, then continue with the user's original request or continue waiting for their reply. This is supplementary feedback, not a replacement for your previous response. The judge is a small local model and can be wrong - if you disagree, say so briefly rather than reworking correct output."
# The "supplementary, not a replacement" framing is security-guidance's
# CONTINUATION_SUFFIX; without it a rewoken model redoes the whole turn.

save_state "$LINE_COUNT" "$NEW_CONTEXT" "$NEW_CUMULATIVE" "$((BLOCK_COUNT + 1))" "$(date +%s)"
STAGE="blocked"
# Both channels, per security-guidance: asyncRewake reads `stderr || stdout`
# for the model-visible body, and top-level decision/reason covers the sync
# path. Stop is not in the hookSpecificOutput union, so additionalContext
# would fail validation and silently drop the whole line.
printf '%s' "$BLOCK_TEXT" >&2
jq -nc --arg reason "$BLOCK_TEXT" '{decision:"block", reason:$reason}'
exit 0

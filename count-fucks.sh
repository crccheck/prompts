#!/bin/bash
# Usage:
#
# Add the hook to your `.claude/settings.json`:
#
# "hooks": {
#   "UserPromptSubmit": [
#     {
#       "hooks": [
#         {
#           "type": "command",
#           "command": "~/path/to/count-fucks.sh"
#         }
#       ]
#     }
#   ],
#
# Then in your statusLine.command, get session_id from stdin and then expose it like:
#
# if [ -n "$session_id" ]; then
#   _fc=$(cat "/tmp/claude/fuck_count_${session_id}" 2>/dev/null)
#   if [ -n "$_fc" ] && [ "$_fc" -gt 0 ] 2>/dev/null; then
#     [ -n "$line2" ] && line2+="$sep"
#     line2+="${dim}fucks: ${reset}${cyan}${_fc}${reset}"
#   fi
# fi

input=$(cat)
grep -qi 'fuck' <<< "$input" || exit 0
session_id=$(jq -r '.session_id // "default"' <<< "$input")
count_file="/tmp/claude/fuck_count_${session_id}"
mkdir -p /tmp/claude
printf "%d" "$(($(cat "$count_file" 2>/dev/null || echo 0) + 1))" > "$count_file"

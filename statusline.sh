#!/bin/bash
# Line 1: Model | tokens used/total | 5h % | 7d % | extra $ usage
# Line 2: session cost | session name | /rename branch

set -f

input=$(cat)
[ -z "$input" ] && { printf "Claude"; exit 0; }

blue='\033[38;2;0;153;255m'
orange='\033[38;2;255;176;85m'
cyan='\033[38;2;46;149;153m'
white='\033[38;2;220;220;220m'
dim='\033[2m'
reset='\033[0m'
bg_orange='\033[48;2;255;176;85m'
dark='\033[38;2;30;30;30m'

format_tokens() {
    awk "BEGIN { n=$1; if (n>=1000000) printf \"%.1fm\",n/1000000; else if (n>=1000) printf \"%.0fk\",n/1000; else printf \"%d\",n }"
}

format_epoch_time() {
    [ -z "$1" ] || [ "$1" = "null" ] && return
    local fmt; [ "$2" = "time" ] && fmt="%H:%M" || fmt="%b %-d"
    { date -j -r "$1" +"$fmt" 2>/dev/null || date -d "@$1" +"$fmt" 2>/dev/null; } | tr '[:upper:]' '[:lower:]'
}

get_oauth_token() {
    local token
    [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ] && { echo "$CLAUDE_CODE_OAUTH_TOKEN"; return; }
    if command -v security >/dev/null 2>&1; then
        token=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null \
            | jq -r '.claudeAiOauth.accessToken // empty' 2>/dev/null)
        [ -n "$token" ] && { echo "$token"; return; }
    fi
    jq -r '.claudeAiOauth.accessToken // empty' "${HOME}/.claude/.credentials.json" 2>/dev/null
}

# Extract all fields from input in one jq pass
{
    read -r model_name
    read -r session_name
    read -r cwd
    read -r five_hour_pct
    read -r five_hour_reset
    read -r seven_day_pct
    read -r seven_day_reset
    read -r cost_usd
    read -r size
    read -r input_tokens
    read -r cache_create
    read -r cache_read
} < <(echo "$input" | jq -r '
    .model.display_name // "Claude",
    .session_name // "",
    .cwd // "",
    .rate_limits.five_hour.used_percentage,
    .rate_limits.five_hour.resets_at,
    .rate_limits.seven_day.used_percentage,
    .rate_limits.seven_day.resets_at,
    .cost.total_cost_usd,
    .context_window.context_window_size // 200000,
    .context_window.current_usage.input_tokens // 0,
    .context_window.current_usage.cache_creation_input_tokens // 0,
    .context_window.current_usage.cache_read_input_tokens // 0
')

[ "$size" -eq 0 ] 2>/dev/null && size=200000
current=$(( input_tokens + cache_create + cache_read ))

git_branch=""
if [ -n "$cwd" ]; then
    git_branch=$(git -C "$cwd" branch --show-current 2>/dev/null)
    [[ "$git_branch" == "main" || "$git_branch" == "master" ]] && git_branch=""
fi

# Fetch usage data (cached, 300s TTL)
cache_file="/tmp/claude/statusline-usage-cache.json"
mkdir -p /tmp/claude
usage_data=""
needs_refresh=true
if [ -f "$cache_file" ]; then
    cache_mtime=$(stat -c %Y "$cache_file" 2>/dev/null || stat -f %m "$cache_file" 2>/dev/null)
    if [ $(( $(date +%s) - cache_mtime )) -lt 300 ]; then
        needs_refresh=false
        usage_data=$(cat "$cache_file")
    fi
fi

if $needs_refresh; then
    oauth_token=$(get_oauth_token)
    if [ -n "$oauth_token" ] && [ "$oauth_token" != "null" ]; then
        response=$(curl -s --max-time 5 \
            -H "Accept: application/json" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $oauth_token" \
            -H "anthropic-beta: oauth-2025-04-20" \
            -H "User-Agent: claude-code/2.1.34" \
            "https://api.anthropic.com/api/oauth/usage" 2>/dev/null)
        if echo "$response" | jq . >/dev/null 2>&1; then
            usage_data="$response"
            echo "$response" > "$cache_file"
        fi
    fi
    [ -z "$usage_data" ] && [ -f "$cache_file" ] && usage_data=$(cat "$cache_file")
fi

# Line 1: Model | tokens | usage limits
sep=" ${dim}|${reset} "
line1="${blue}${model_name}${reset} ${dim}|${reset} ${orange}$(format_tokens $current) / $(format_tokens $size)${reset}"
add_col() { line1+="$sep$1"; }

if [ "$five_hour_pct" != "null" ]; then
    pct=$(echo "$five_hour_pct" | awk '{printf "%.0f", $1}')
    add_col "${white}5h:${reset} ${cyan}${pct}%${reset} ${dim}$(format_epoch_time "$five_hour_reset" time)${reset}"
fi
if [ "$seven_day_pct" != "null" ]; then
    pct=$(echo "$seven_day_pct" | awk '{printf "%.0f", $1}')
    add_col "${white}7d:${reset} ${cyan}${pct}%${reset} ${dim}$(format_epoch_time "$seven_day_reset" date)${reset}"
fi
if [ -n "$usage_data" ]; then
    {
        read -r extra_enabled
        read -r extra_used_raw
        read -r extra_limit_raw
    } < <(echo "$usage_data" | jq -r '.extra_usage | (.is_enabled // false), (.used_credits // 0), (.monthly_limit // 0)')
    extra_used_int=$(printf "%.0f" "$extra_used_raw")
    if [ "$extra_enabled" = "true" ] && [ "$extra_used_int" -gt 0 ]; then
        extra_used=$(awk "BEGIN { printf \"%.2f\", $extra_used_raw/100 }")
        extra_reset=$(date -v+1m -v1d +"%b %-d" 2>/dev/null | tr '[:upper:]' '[:lower:]' \
            || date -d "$(date +%Y-%m-01) +1 month" +"%b %-d" 2>/dev/null | tr '[:upper:]' '[:lower:]')
        if [ "$five_hour_pct" = "null" ] && [ "$seven_day_pct" = "null" ]; then
            extra_limit=$(awk "BEGIN { printf \"%.0f\", $extra_limit_raw/100 }")
            add_col "${white}usage:${reset} ${cyan}\$${extra_used}${dim}/\$${extra_limit}${reset} ${dim}${extra_reset}${reset}"
        else
            add_col "${cyan}\$${extra_used}${reset} ${dim}${extra_reset}${reset}"
        fi
    fi
fi

# Line 2: session cost | session name | /rename (unbounded, goes last)
line2=""
if [ "$cost_usd" != "null" ]; then
    cost_fmt=$(awk "BEGIN { printf \"\$%.4f\", $cost_usd }")
    line2="${white}session:${reset} ${cyan}${cost_fmt}${reset}"
fi
if [ -n "$session_name" ]; then
    [ -n "$line2" ] && line2+="$sep"
    line2+="${dim}${session_name}${reset}"
fi
if [ -n "$git_branch" ] && [ "$git_branch" != "$session_name" ]; then
    [ -n "$line2" ] && line2+="$sep"
    line2+="${bg_orange}${dark}/rename ${git_branch}${reset}"
fi

# Output
printf "%b" "$line1"
[ -n "$line2" ] && printf "\n%b" "$line2"

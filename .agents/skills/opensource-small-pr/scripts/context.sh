#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
STATE_DIR="$ROOT_DIR/.kimaki"
LOG_PATH="$STATE_DIR/opensource-contrib-log.jsonl"
LOCK_DIR="$STATE_DIR/opensource-contrib.lock"
LOCK_TTL_SECONDS="${OPEN_SOURCE_CONTRIB_LOCK_TTL_SECONDS:-3300}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"

mkdir -p "$STATE_DIR"

now_epoch="$(date -u +%s)"
if mkdir "$LOCK_DIR" 2>/dev/null; then
    {
        printf 'runId=%s\n' "$RUN_ID"
        printf 'pid=%s\n' "$$"
        printf 'createdAt=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        printf 'ttlSeconds=%s\n' "$LOCK_TTL_SECONDS"
    } > "$LOCK_DIR/metadata"
else
    created_epoch="$(stat -c %Y "$LOCK_DIR" 2>/dev/null || printf '%s' 0)"
    age_seconds="$((now_epoch - created_epoch))"
    if [ "$age_seconds" -lt "$LOCK_TTL_SECONDS" ]; then
        printf 'Open-source contribution context: another run appears active.\n'
        printf 'Lock path: %s\n' "$LOCK_DIR"
        printf 'Lock age: %ss; TTL: %ss\n' "$age_seconds" "$LOCK_TTL_SECONDS"
        if [ -f "$LOCK_DIR/metadata" ]; then
            printf '\nLock metadata:\n'
            sed 's/^/  /' "$LOCK_DIR/metadata"
        fi
        exit 75
    fi

    rm -rf "$LOCK_DIR"
    mkdir "$LOCK_DIR"
    {
        printf 'runId=%s\n' "$RUN_ID"
        printf 'pid=%s\n' "$$"
        printf 'createdAt=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        printf 'replacedStaleLockAgeSeconds=%s\n' "$age_seconds"
        printf 'ttlSeconds=%s\n' "$LOCK_TTL_SECONDS"
    } > "$LOCK_DIR/metadata"
fi

china_hour="$(TZ=Asia/Shanghai date +%H)"
china_time="$(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S %Z')"
weekday="$(TZ=Asia/Shanghai date +%u)"

case "$china_hour" in
    00) agenda="quiet closeout: summarize, archive no-op runs, prepare next day" ;;
    01) agenda="prepare day: diary, dirty files, candidate queue, workflow risks" ;;
    02|03|04|05|06) agenda="active contribution: one small issue-linked PR in a non-duplicate low-star repo" ;;
    07|08|09|10) agenda="user project maintenance: notifications, mentions, CI, small fixes" ;;
    11|12|13|14) agenda="ethical money-making: concrete assets, inbound-safe leads, diary" ;;
    15|16|17|18) agenda="digital identity/social: bounded Bluesky/email/community work" ;;
    19|20|21|22|23) agenda="workflow closeout: memory, skills, README, logs, next-day prep" ;;
    *) agenda="unknown schedule hour: default to quiet local work" ;;
esac

case "$weekday" in
    1) theme="docs, examples, and broken links" ;;
    2) theme="tests, CI, and small regressions" ;;
    3) theme="developer tools and command output polish" ;;
    4) theme="Python, TypeScript, and packaging edges" ;;
    5) theme="maintainer follow-up and review response" ;;
    6) theme="low-risk UI copy, accessibility, and docs" ;;
    7) theme="candidate queue and weekly reflection" ;;
esac

printf '# Open-Source Contribution Context\n\n'
printf -- '- Run ID: `%s`\n' "$RUN_ID"
printf -- '- China time: `%s`\n' "$china_time"
printf -- '- Agenda: %s\n' "$agenda"
printf -- '- Weekly theme: %s\n' "$theme"
printf -- '- State log: `%s`\n' "$LOG_PATH"
printf -- '- Lock path: `%s`\n' "$LOCK_DIR"
printf -- '- Lock TTL: `%ss`\n\n' "$LOCK_TTL_SECONDS"

printf '## Suggested Direction\n\n'
printf -- '- Start from the diary candidate queue or maintainer follow-ups before searching GitHub.\n'
printf -- '- Prefer one clear issue-linked fix over broad exploration.\n'
printf -- '- Stop if the repository is security-sensitive, high-traffic, vague, or needs private access.\n\n'

printf '## Recent Repositories\n\n'
if [ -s "$LOG_PATH" ]; then
    tail -n 20 "$LOG_PATH" | sed 's/^/- /'
else
    printf -- '- No local contribution log yet. Create `%s` before ending a run.\n' "$LOG_PATH"
fi

printf '\n## Logging Example\n\n'
printf '```bash\n'
printf "printf '%%s\\\\n' '{\"at\":\"%s\",\"runId\":\"%s\",\"repo\":\"owner/repo\",\"action\":\"reviewed-skipped\",\"url\":\"https://github.com/owner/repo\",\"notes\":\"short reason\"}' >> .kimaki/opensource-contrib-log.jsonl\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$RUN_ID"
printf '```\n'

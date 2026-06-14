#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
STATE_DIR="$ROOT_DIR/.kimaki"
LOG_PATH="$STATE_DIR/opensource-contrib-log.jsonl"
LOCK_PATH="$STATE_DIR/opensource-contrib.lock"
TTL_SECONDS="${OPEN_SOURCE_CONTRIB_LOCK_TTL_SECONDS:-3300}"
NOW_EPOCH="$(date -u +%s)"
RUN_ID="opensource-$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$STATE_DIR"

if [[ -e "$LOCK_PATH" ]]; then
  lock_mtime="$(stat -c %Y "$LOCK_PATH" 2>/dev/null || printf '0')"
  lock_age="$((NOW_EPOCH - lock_mtime))"
  if (( TTL_SECONDS > 0 && lock_age < TTL_SECONDS )); then
    printf 'Another open-source contribution run appears active.\n'
    printf 'Lock: %s\n' "$LOCK_PATH"
    printf 'Age: %ss, TTL: %ss\n' "$lock_age" "$TTL_SECONDS"
    printf 'Stop this automated run unless you are intentionally continuing the same work.\n'
    exit 2
  fi
fi

rm -rf "$LOCK_PATH"
mkdir -p "$LOCK_PATH"
printf '%s\n' "$RUN_ID" > "$LOCK_PATH/run_id"

china_hour="$(TZ=Asia/Shanghai date +%H)"
china_time="$(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M %Z')"

case "$china_hour" in
  01) agenda="Prepare the day, inspect dirty/temp state, create diary, prepare candidate queue." ;;
  02) agenda="Open-source contribution 1-2: choose one strong target and prepare the second." ;;
  03) agenda="Open-source contribution 3: avoid duplicate repositories and follow the context log." ;;
  04) agenda="Open-source contribution 4: small low-risk PR or verified useful issue only." ;;
  05) agenda="Open-source contribution 5: maintain quality over count; no mechanical PRs." ;;
  06) agenda="Open-source contribution 6 and night summary; reconcile evidence and risks." ;;
  07|08|09|10) agenda="User-project maintenance/follow-up window; do not start unrelated open-source work." ;;
  19|20|21|22|23|00) agenda="Closeout/meta-planning window; update skills or local workflow only when small." ;;
  *) agenda="Not an active open-source contribution hour; prefer local notes or follow-up only." ;;
esac

printf 'Open-source contribution context\n'
printf -- '--------------------------------\n'
printf 'Run ID: %s\n' "$RUN_ID"
printf 'China time: %s\n' "$china_time"
printf 'Agenda: %s\n' "$agenda"
printf 'State log: %s\n' "$LOG_PATH"
printf 'Lock: %s\n' "$LOCK_PATH"
printf '\nRecent contribution log entries:\n'
if [[ -s "$LOG_PATH" ]]; then
  tail -n 12 "$LOG_PATH"
else
  printf '(none yet)\n'
fi
printf '\nLog example:\n'
printf '%s\n' "printf '%s\\n' '{\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"runId\":\"$RUN_ID\",\"repo\":\"owner/repo\",\"action\":\"reviewed-skipped\",\"url\":\"https://github.com/owner/repo\",\"notes\":\"why skipped\"}' >> .kimaki/opensource-contrib-log.jsonl"
printf '\nRelease lock when finished:\n'
printf 'rm -rf %q\n' "$LOCK_PATH"

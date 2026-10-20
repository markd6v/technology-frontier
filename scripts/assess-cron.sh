#!/usr/bin/env bash
# Hourly assessment on this Mac through the Claude Code CLI and its subscription (ARCHITECTURE §8.5).
# Reads .env.cron (DATABASE_URL of the database to assess; optional APP_URL + CRON_SECRET to refresh
# the site's cache afterwards). Never put the subscription login on Vercel or in CI.
# Usage: scripts/assess-cron.sh run|install|uninstall|status
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="dev.frontier-radar.assess"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/frontier-assess.log"
ENV_FILE="${ASSESS_ENV_FILE:-$ROOT/.env.cron}"
INTERVAL_S=3600

run() {
  cd "$ROOT"
  if [ ! -f "$ENV_FILE" ]; then
    echo "$(date '+%F %T') missing $ENV_FILE (copy the example in README → Local assessment)" >&2
    exit 1
  fi
  # Keep the log from growing without bound.
  if [ -f "$LOG" ] && [ "$(stat -f %z "$LOG")" -gt 5000000 ]; then tail -n 2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"; fi
  echo "--- $(date '+%F %T')"
  # ASSESS_LIMIT in the env file caps items per run (default: the job's own limit).
  local limit
  limit="$(sed -n 's/^ASSESS_LIMIT=//p' "$ENV_FILE" | tail -n 1)"
  ASSESS_PROVIDER=claude-code node --env-file="$ENV_FILE" --import tsx src/cli/job.ts assess ${limit:+--limit="$limit"}
  # Optional: ask the deployed site to re-rank, which also refreshes its page cache.
  set -a; . "$ENV_FILE"; set +a
  if [ -n "${APP_URL:-}" ] && [ -n "${CRON_SECRET:-}" ]; then
    curl -fsS -X POST --max-time 120 -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/jobs/rank" >/dev/null \
      && echo "refreshed $APP_URL" || echo "could not refresh $APP_URL" >&2
  fi
}

install() {
  local node_dir claude_dir
  command -v claude >/dev/null || { echo "claude CLI not found on PATH" >&2; exit 1; }
  node_dir="$(dirname "$(command -v node)")"
  claude_dir="$(dirname "$(command -v claude)")"
  mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
  cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$ROOT/scripts/assess-cron.sh</string><string>run</string></array>
  <key>StartInterval</key><integer>$INTERVAL_S</integer>
  <key>RunAtLoad</key><true/>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$node_dir:$claude_dir:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "installed $LABEL: runs every $((INTERVAL_S / 60)) min (and once on wake if a run was missed); log: $LOG"
}

uninstall() {
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "removed $LABEL"
}

status() {
  if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
    launchctl print "gui/$(id -u)/$LABEL" | grep -E "state =|last exit code|runs =" | sed 's/^[[:space:]]*/  /'
  else
    echo "$LABEL is not installed"
  fi
  [ -f "$LOG" ] && { echo "--- last lines of $LOG"; tail -n 15 "$LOG"; }
}

case "${1:-}" in
  run) run ;;
  install) install ;;
  uninstall) uninstall ;;
  status) status ;;
  *) echo "usage: $0 run|install|uninstall|status" >&2; exit 1 ;;
esac

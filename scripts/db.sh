#!/usr/bin/env bash
# Local Postgres cluster in ./.data/pg on port 54329, so it never touches a system install.
# Usage: scripts/db.sh start|stop|status
set -euo pipefail

PORT=54329
export LC_ALL=C LANG=C  # Homebrew postgres aborts at startup with an invalid locale
DIR="$(cd "$(dirname "$0")/.." && pwd)/.data/pg"
BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl)")}"

case "${1:-start}" in
  start)
    if [ ! -f "$DIR/PG_VERSION" ]; then
      mkdir -p "$DIR"
      "$BIN/initdb" -D "$DIR" -U postgres --auth=trust --locale=C --encoding=UTF8 >/dev/null
    fi
    if ! "$BIN/pg_ctl" -D "$DIR" status >/dev/null 2>&1; then
      "$BIN/pg_ctl" -D "$DIR" -l "$DIR/server.log" -o "-p $PORT -k /tmp" -w start >/dev/null
    fi
    "$BIN/psql" -h localhost -p "$PORT" -U postgres -tAc "select 1 from pg_database where datname='frontier'" | grep -q 1 \
      || "$BIN/createdb" -h localhost -p "$PORT" -U postgres frontier
    echo "postgres running: postgres://postgres@localhost:$PORT/frontier"
    ;;
  stop) "$BIN/pg_ctl" -D "$DIR" stop ;;
  status) "$BIN/pg_ctl" -D "$DIR" status ;;
  *) echo "usage: $0 start|stop|status" >&2; exit 1 ;;
esac

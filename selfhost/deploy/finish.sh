#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo '请使用sudo执行。' >&2; exit 1; }
release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
(cd "$release" && sha256sum -c SHA256SUMS >/dev/null)
bash "$release/deploy/repair-nginx-baseline.sh"
bash "$release/deploy/activate.sh"

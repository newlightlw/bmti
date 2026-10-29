#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo '请使用sudo执行。' >&2; exit 1; }
config=/etc/nginx/sites-available/heretoo
baseline=43382f0f7ad2e1b405e5761fd16f778dae5ef35c6fe175004d9b3ae8bfa3f8ed
if [[ $(sha256sum "$config" | cut -d ' ' -f 1) == "$baseline" ]]; then nginx -t; exit 0; fi
[[ ! -e /etc/nginx/snippets/agent-mesh.locations.conf ]]
if systemctl is-active --quiet agent-mesh.service agent-mesh-relay.service; then
    echo 'Agent Mesh服务正在运行，停止自动修复以保护现有功能。' >&2; exit 1
fi
if ss -lnt | awk '{print $4}' | grep -Eq ':(18787|18880)$'; then
    echo 'Agent Mesh端口正在使用，停止自动修复。' >&2; exit 1
fi
backup=$(mktemp /var/backups/heretoo-nginx-orphan-XXXXXXXX.conf)
cp -a "$config" "$backup"
python3 - "$config" <<'PY'
from pathlib import Path
import hashlib,sys
p=Path(sys.argv[1]);data=p.read_bytes();line=b'    include /etc/nginx/snippets/agent-mesh.locations.conf;\n'
assert hashlib.sha256(data).hexdigest()=='b4f0e3f1f225d87955fca166a46735d4f480c0c2ad15a197758153b7a5937e1c','Nginx文件已变化，请重新核对'
assert data.count(line)==1
result=data.replace(line,b'',1)
assert hashlib.sha256(result).hexdigest()=='43382f0f7ad2e1b405e5761fd16f778dae5ef35c6fe175004d9b3ae8bfa3f8ed'
p.write_bytes(result)
PY
if ! nginx -t; then
    cp -a "$backup" "$config"
    echo "验证仍失败，已恢复修复前文件。备份：$backup" >&2
    exit 1
fi
systemctl reload nginx
curl --fail --silent --show-error --resolve heretoo.manisfast.com:443:127.0.0.1 https://heretoo.manisfast.com/api/health
printf '\n已恢复原Nginx基线，原文件备份：%s\n' "$backup"

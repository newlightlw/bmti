#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo '请在服务器使用 sudo bash 执行本脚本。' >&2; exit 1; }
release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
[[ "$release" == /home/liw/heretoo-hgp-* ]] || { echo '非预期发布目录' >&2; exit 1; }
domain=bmti.myassist.cn
config=/etc/nginx/sites-available/heretoo-hgp
enabled=/etc/nginx/sites-enabled/heretoo-hgp
unit=/etc/systemd/system/heretoo-hgp.service
current=/home/liw/heretoo-hgp-current
env_file=/home/liw/.config/heretoo-hgp/server.env
data=/home/liw/.local/share/heretoo-hgp
for required in "$release/server.mjs" "$release/client/index.html" "$release/client/admin/index.html" "$release/deploy/nginx.conf" "$release/deploy/heretoo-hgp.service" "$env_file"; do
    [[ -f "$required" ]] || { echo "缺少文件：$required" >&2; exit 1; }
done
(cd "$release" && sha256sum -c SHA256SUMS >/dev/null)
[[ $(/usr/bin/node -p 'process.versions.node.split(".")[0]') -ge 24 ]]
getent ahostsv4 "$domain" | awk '{print $1}' | sort -u | grep -qx '175.178.59.206'
[[ ! -e "$current" || -L "$current" ]] || { echo '当前路径不是符号链接，停止以保护原文件。' >&2; exit 1; }
[[ ! -e "$enabled" || -L "$enabled" ]] || { echo '站点启用路径不是符号链接，停止。' >&2; exit 1; }
if [[ -L "$enabled" ]]; then [[ $(readlink -f "$enabled") == "$config" ]]; fi
if grep -Rl --include='*' 'server_name.*bmti\.myassist\.cn' /etc/nginx/sites-enabled 2>/dev/null | grep -vFx "$enabled" | grep -q .; then
    echo '新域名已被其他Nginx站点占用，请先核对。' >&2; exit 1
fi
python3 - "$env_file" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]);values=dict(line.split('=',1) for line in p.read_text().splitlines() if line and not line.startswith('#'))
assert values['HGP_PUBLIC_ORIGIN']=='https://bmti.myassist.cn'
assert values['HGP_DATABASE_PATH']=='/home/liw/.local/share/heretoo-hgp/hgp.sqlite3'
assert values['PORT']=='8787'
assert re.fullmatch('[a-f0-9]{64}',values['HGP_ADMIN_HASH'])
assert p.stat().st_mode & 0o077 == 0
PY
nginx -t
backup=$(mktemp -d /var/backups/heretoo-hgp-XXXXXXXX)
was_active=$(systemctl is-active heretoo-hgp.service || true)
was_enabled=$(systemctl is-enabled heretoo-hgp.service 2>/dev/null || true)
[[ ! -e "$config" ]] || cp -a "$config" "$backup/nginx.conf"
[[ ! -e "$unit" ]] || cp -a "$unit" "$backup/service"
if [[ -L "$current" ]]; then readlink "$current" > "$backup/previous-current"; fi
if [[ -L "$enabled" ]]; then readlink "$enabled" > "$backup/previous-enabled"; fi
if [[ -f "$data/hgp.sqlite3" ]]; then
    python3 - "$data/hgp.sqlite3" "$backup/hgp.sqlite3" <<'PY'
import sqlite3,sys
with sqlite3.connect(sys.argv[1]) as src, sqlite3.connect(sys.argv[2]) as dst: src.backup(dst)
PY
fi
# Rollback restores service/config/current pointer. Database backup is retained for
# explicit recovery; do not automatically overwrite newly accepted user records.
cat > "$backup/rollback.sh" <<ROLLBACK
#!/usr/bin/env bash
set -eu
[[ \$EUID -eq 0 ]]
systemctl stop heretoo-hgp.service || true
systemctl disable heretoo-hgp.service 2>/dev/null || true
if [[ -f '$backup/service' ]]; then cp -a '$backup/service' '$unit'; else rm -f '$unit'; fi
if [[ -f '$backup/nginx.conf' ]]; then cp -a '$backup/nginx.conf' '$config'; else rm -f '$config'; fi
rm -f '$enabled'
if [[ -f '$backup/previous-enabled' ]]; then ln -s "\$(cat '$backup/previous-enabled')" '$enabled'; fi
rm -f '$current'
if [[ -f '$backup/previous-current' ]]; then ln -s "\$(cat '$backup/previous-current')" '$current'; fi
systemctl daemon-reload
if [[ '$was_enabled' == enabled ]]; then systemctl enable heretoo-hgp.service; else systemctl disable heretoo-hgp.service 2>/dev/null || true; fi
if [[ '$was_active' == active ]]; then systemctl start heretoo-hgp.service; fi
nginx -t && systemctl reload nginx
printf '已恢复发布前的服务和Nginx。备份目录：%s\n' '$backup'
ROLLBACK
chmod 700 "$backup/rollback.sh"
rollback_on_failure() {
    status=$?
    trap - ERR
    echo "激活失败，正在回退。备份：$backup" >&2
    bash "$backup/rollback.sh" || echo "自动回退遇到问题，请检查 $backup" >&2
    exit "$status"
}
trap rollback_on_failure ERR
install -d -m 700 -o liw -g liw "$data"
install -d -m 755 /var/www/heretoo-hgp-acme
install -m 644 "$release/deploy/heretoo-hgp.service" "$unit"
ln -s "$release" "$current.next"
mv -Tf "$current.next" "$current"
systemctl daemon-reload
systemctl enable --now heretoo-hgp.service
systemctl restart heretoo-hgp.service
for attempt in {1..20}; do
    if curl --fail --silent http://127.0.0.1:8787/api/health > "$backup/health.json"; then break; fi
    sleep 1
done
python3 - "$backup/health.json" <<'PY'
import json,sys
assert json.load(open(sys.argv[1]))['runtime']=='node-sqlite'
PY
certificate=/etc/letsencrypt/live/$domain/fullchain.pem
key=/etc/letsencrypt/live/$domain/privkey.pem
if [[ -f "$certificate" && -f "$key" ]] && openssl x509 -in "$certificate" -noout -checkhost "$domain" >/dev/null && openssl x509 -in "$certificate" -noout -checkend 604800 >/dev/null; then
    echo '已存在有效域名证书，复用证书。'
else
    install -m 644 "$release/deploy/nginx-bootstrap.conf" "$config"
    [[ -L "$enabled" ]] || ln -s "$config" "$enabled"
    nginx -t
    systemctl daemon-reload
    systemctl reload nginx
    # Reuse the server's existing ACME account, without new ToS acceptance.
    certbot certonly --webroot -w /var/www/heretoo-hgp-acme -d "$domain" --cert-name "$domain" --non-interactive --keep-until-expiring
fi
openssl x509 -in "$certificate" -noout -checkhost "$domain"
openssl x509 -in "$certificate" -noout -checkend 86400
install -m 644 "$release/deploy/nginx.conf" "$config"
[[ -L "$enabled" ]] || ln -s "$config" "$enabled"
nginx -t
systemctl daemon-reload
systemctl reload nginx
# Reload only signals the master. Wait for new workers to serve the correct
# certificate and our application before treating the switch as complete.
https_ready=0
for attempt in {1..30}; do
    if curl --noproxy '*' --fail --silent --show-error --connect-timeout 2 --max-time 4 --resolve "$domain:443:127.0.0.1" "https://$domain/api/health" > "$backup/https-health.json" 2> "$backup/tls-last-error"; then
        if python3 - "$backup/https-health.json" <<'PY_READY'
import json,sys
try: ok=json.load(open(sys.argv[1])).get('runtime')=='node-sqlite'
except (ValueError,OSError): ok=False
raise SystemExit(0 if ok else 1)
PY_READY
        then https_ready=1; break; fi
    fi
    sleep 1
done
if [[ "$https_ready" != 1 ]]; then
    echo 'Nginx在等待后仍未提供目标证书和HGP健康接口。' >&2
    cat "$backup/tls-last-error" >&2
fi
[[ "$https_ready" == 1 ]]
curl --noproxy '*' --fail --silent --show-error --resolve "$domain:443:127.0.0.1" "https://$domain/" > "$backup/home.html"
curl --noproxy '*' --fail --silent --show-error --resolve "$domain:443:127.0.0.1" "https://$domain/admin" > "$backup/admin.html"
python3 - "$backup" <<'PY'
from pathlib import Path
import json,sys
p=Path(sys.argv[1]);assert json.loads((p/'https-health.json').read_text())['runtime']=='node-sqlite'
assert '/assets/' in (p/'home.html').read_text() and '/assets/' in (p/'admin.html').read_text()
PY
status=$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' --resolve "$domain:443:127.0.0.1" "https://$domain/api/admin")
[[ "$status" == 401 ]]
trap - ERR
printf '\nHGP 已激活：https://%s/\n管理端：https://%s/admin\n回滚：sudo bash %s/rollback.sh\n' "$domain" "$domain" "$backup"

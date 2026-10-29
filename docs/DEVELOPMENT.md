# 本地开发与验收

推荐Node **24**、npm、Python 3。Node包的历史engine下限用于Sites，不表示独立SQLite版在Node22已验证。当前Node24的`node:sqlite`会输出ExperimentalWarning，测试与运行应分别检查实际退出码。

## 安装与构建

在仓库根目录运行：

```sh
npm ci
npm test
npm run test:selfhost
npm run typecheck
npm run build:selfhost
```

## 创建个人配置

首次执行以下命令，生成独立开发口令及环境文件。文件保存在仓库外，权限600，目录700；已有文件时停止，不覆盖。Python会将所选个人目录写入环境文件，Windows可自行选择等效私有路径。

```sh
python3 - <<'PY_CONFIG'
import hashlib, os, pathlib, secrets
config = pathlib.Path.home() / '.config/bmti'
data = pathlib.Path.home() / '.local/share/bmti'
config.mkdir(parents=True, exist_ok=True, mode=0o700)
config.chmod(0o700)
data.mkdir(parents=True, exist_ok=True, mode=0o700)
paths = [config / 'development.env', config / 'admin-access.txt']
if any(p.exists() for p in paths):
    raise SystemExit('配置已存在，请复用或手动选择新的隔离目录。')
password = secrets.token_urlsafe(32)
content = '\n'.join([
    'HGP_ADMIN_HASH=' + hashlib.sha256(password.encode()).hexdigest(),
    'HGP_PUBLIC_ORIGIN=http://127.0.0.1:5189',
    'PORT=5189',
    'HGP_DATABASE_PATH=' + str(data / 'development.sqlite3'),
    '',
])
for path, value in zip(paths, [content, '管理口令：' + password + '\n']):
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as handle:
        handle.write(value)
print('已生成个人环境与口令文件：', config)
PY_CONFIG
```

口令只在本人私有`admin-access.txt`中查看，不贴入PR、Issue或命令行参数。`.env.example`仅列字段，不含可用凭证。

## 启动与修改

```sh
node --env-file="$HOME/.config/bmti/development.env" selfhost-dist/server.mjs
```

打开 http://127.0.0.1:5189/ 和 `/admin`。启动时自动应用打包的SQL迁移，后续重启不会重复应用；修改已应用SQL会报错，应追加迁移。

独立版没有热更新；修改后停止进程，重新`npm run build:selfhost`并启动。构建会重建`selfhost-dist/`，开发数据库放在仓库外不会被删除。

## HTTP集成测试

保持上述隔离服务运行，在另一终端执行：

```sh
HGP_TEST_URL=http://127.0.0.1:5189 HGP_ADMIN_PASSWORD_FILE="$HOME/.config/bmti/admin-access.txt" python3 tests/api_smoke.py
```

脚本会改变隔离库题量、写入合成记录并恢复32题，**不能对有真实用户的生产站运行整套测试**。改端口时同时修改`PORT`、`HGP_PUBLIC_ORIGIN`与测试URL，浏览器来源必须完全一致（localhost与127.0.0.1也不同）。

## 必需验证

- `npm test`：9项，题库、抽样、16角色、并重、低符合、接近、缺失和呈现。
- `npm run test:selfhost`：4项，重启持久化、事务回滚、迁移不可改、参数绑定。
- `npm run typecheck`、`npm run build:selfhost`：类型和独立构建。
- 修改API／持久化时再运行8项隔离HTTP测试。
- 修改页面时用浏览器检查完整答卷、旧报告重载及窄屏；桌面390px不等于真机验收。

## 可选：Sites / Vinext

这条路径用于维护旧Sites站点，不是普通伙伴本地启动的前置条件。

1. 将个人`HGP_ADMIN_HASH`放入忽略的`.dev.vars`。
2. `npm run build`生成Worker构建。
3. 仅对全新本地D1库应用`drizzle/0000_peaceful_skaar.sql`一次：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_peaceful_skaar.sql
npm run dev -- --port 5187
```

后续迁移追加应用，不重复执行首个SQL。`.openai/hosting.json`保留原站身份，克隆不自动获得部署权限，不新建或覆盖其他站点。Sites环境、腾讯云环境和本地环境分别持久化。

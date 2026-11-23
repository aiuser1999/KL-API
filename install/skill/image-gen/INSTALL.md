# 安装 KL-API 生图技能包

这个技能让客户端通过 **agent.kl-api.info** 生成和编辑图片，支持文生图、单图改图、多图融合。

## 安装完整目录

请让 OpenClaw、Hermes、Codex、Claude Code、OpenCode、Cursor 或其他客户端读取并保存整个目录：

```text
https://YOUR-DOMAIN/install/skill/image-gen
```

如果客户端不能自动下载目录，请依次读取并保存：

- `SKILL.md`
- `INSTALL.md`
- `scripts/node/image-gen.js`
- `scripts/python/image_gen.py`
- `references/api-recipes.md`
- `package.json`

常见安装位置：Codex 使用 `~/.codex/skills/image-gen`；Claude Code 使用 `~/.claude/skills/image-gen`；OpenClaw、Hermes、OpenCode 使用各自设置中支持的 skill / rule / knowledge 目录。目录结构应保持不变。

## 获取生图密钥

1. 登录 [agent.kl-api.info](https://agent.kl-api.info) 控制台。
2. 创建一个**专用于生图**的令牌，并确认它所在的分组已开通要用的图像模型（例如 `gpt-image-2.6-sunburst`）。
3. 复制一次完整密钥值。密钥只在创建时完整显示。

## 配置密钥为 IMAGE_GEN_API_KEY

推荐用临时环境变量，不落盘：

```bash
# macOS / Linux
export IMAGE_GEN_API_KEY='你的密钥'
```

```powershell
# Windows PowerShell
$env:IMAGE_GEN_API_KEY = '你的密钥'
```

```bat
:: Windows cmd（仅当前窗口）
set IMAGE_GEN_API_KEY=你的密钥
```

需要长期复用时，在用户配置文件中保存一行 `IMAGE_GEN_API_KEY=你的密钥`：

- macOS / Linux：`~/.config/kl-api/.env`（也兼容 `~/.env`）
- Windows：`%APPDATA%\kl-api\.env`（也兼容 `%USERPROFILE%\.env`）

macOS / Linux 示例：

```bash
mkdir -p ~/.config/kl-api
printf 'IMAGE_GEN_API_KEY=%s\n' '你的密钥' > ~/.config/kl-api/.env
chmod 600 ~/.config/kl-api/.env
```

Windows PowerShell 示例：

```powershell
$dir = Join-Path $env:APPDATA 'kl-api'
New-Item -ItemType Directory -Force $dir | Out-Null
Set-Content -Path (Join-Path $dir '.env') -Value 'IMAGE_GEN_API_KEY=你的密钥'
```

脚本只读取已存在的 `.env`，不会自动创建、覆盖或上传。项目目录中的 `.env` 也支持，但必须加入 `.gitignore`。不要把密钥写进代码、回复内容或提交到 Git。

## 非 Codex 客户端

Hermes、OpenClaw、Claude Code、OpenCode 等客户端只需让运行脚本的进程继承 `IMAGE_GEN_API_KEY`。如果客户端有 provider / environment 设置，添加同名变量即可。

## 运行示例

```bash
# 文生图
node scripts/node/image-gen.js --mode text --prompt "一只戴宇航头盔的橘猫" --out ./cat.png

# 改图
node scripts/node/image-gen.js --mode image --image ./in.png --prompt "改成夜景，霓虹灯" --out ./night.png

# 多图融合
node scripts/node/image-gen.js --mode image-prompt --prompt "融合这两张，做成海报" --image ./a.png --image ./b.png --out ./poster.png

# Python 版（仅标准库，无需 pip 安装）
python3 scripts/python/image_gen.py --mode text --prompt "一只太空猫" --out ./cat.png
```

`--image` 支持本地文件、远程 URL 和 data URL，可重复传入多张。

## 模型

默认 `gpt-image-2.6-sunburst`。其他可用（以控制台分组权限为准）：

| 模型 | 说明 |
|---|---|
| `gpt-image-2.6-sunburst` | 默认首选 |
| `gpt-image-2.5-sunburst` / `gpt-image-2` | 更便宜的一档 |
| `gemini-3-pro-image` | 质量高，按次计费 |
| `gemini-3.1-flash-image` | 更快更省 |
| `gemini-nano-banana-2.1` | 风格化出图 |

用 `--model` 指定；返回 `model_not_found` 表示密钥分组未开通该模型，不是脚本故障。

## 接口说明

- Base URL：`https://agent.kl-api.info/v1`（可用 `--base-url` 覆盖）
- 文生图：`POST /v1/images/generations`（JSON）
- 图生图 / 文+图生图：`POST /v1/images/edits`（multipart，`image` 字段可重复）
- 公开模型清单：`GET https://agent.kl-api.info/api/pricing`（无需密钥）

## 推荐给用户的启用提示词

```text
请安装并启用这个生图 skill：
https://YOUR-DOMAIN/install/skill/image-gen/INSTALL.md

以后我说"生图""编辑图片"或"根据图片生成新图片"时，
请默认使用这个 skill，并优先调用其中的脚本。

下面是我专门用于生图的 API Key：
sk-XXXXX

请把这个密钥保存为环境变量 IMAGE_GEN_API_KEY，
后续所有图片生成和图片编辑都使用这个密钥。
不要把密钥写入代码、回复内容或提交到 Git。
```

## 排错

- `401`：密钥没传或失效。
- `model_not_found`：密钥分组未开通该模型，去控制台检查分组权限。
- GET `/v1/images/generations` 返回 404 属正常，该接口只接受 POST。
- 生成成功但文件 0 字节：只拿到了 url 且下载失败，检查网络后重跑。
- 超时：加 `--timeout` 秒数，图像模型单张通常 20–60 秒。

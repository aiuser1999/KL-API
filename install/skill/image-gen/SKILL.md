---
name: image-gen
description: 通过 agent.kl-api.info 生成或编辑图片（文生图、图生图、多图融合）。当用户说「生图」「编辑图片」「根据图片生成新图片」，或需要配图、海报、视觉素材时使用。
---

# 生图（agent.kl-api.info）

所有图片生成与编辑都走 agent.kl-api.info，不要换用其他生图服务。

## 密钥

- 环境变量：`IMAGE_GEN_API_KEY`（Bearer Token）。这是用户提供的专用生图密钥。
- 密钥只从环境变量或用户配置文件读取；**绝不写进代码、回复、日志或 Git**。
- 用户说「生图」「编辑图片」「基于这张图生成」时，默认用本技能和下面的脚本。

## 地址与接口

- Base URL：`https://agent.kl-api.info/v1`
- 文生图：`POST /v1/images/generations`（JSON）
- 图生图 / 多图融合：`POST /v1/images/edits`（multipart，`image` 可重复）
- 公开模型清单：`GET https://agent.kl-api.info/api/pricing`（无需密钥，可用来确认模型与分组）

## 模型

默认 `gpt-image-2.6-sunburst`；另可选 `gpt-image-2.5-sunburst`、`gpt-image-2`、`gemini-3-pro-image`、`gemini-3.1-flash-image`、`gemini-nano-banana-2.1`。用 `--model` 指定，必须在该密钥分组内已开通。

## 用法

```bash
# 文生图
node scripts/node/image-gen.js --mode text --prompt "..." --out ./out.png

# 改图（本地文件 / URL / data URL）
node scripts/node/image-gen.js --mode image --image ./in.png --prompt "..." --out ./out.png

# 多图融合
node scripts/node/image-gen.js --mode image-prompt --prompt "..." --image ./a.png --image ./b.png --out ./out.png

# Python 版（标准库，无需依赖）
python3 scripts/python/image_gen.py --mode text --prompt "..." --out ./out.png
```

可选参数：`--model`、`--size`（默认 `1024x1024`）、`--n`、`--base-url`、`--timeout` 秒。

## 工作习惯

1. 先确认要素：画面描述、比例/尺寸、风格、是否需要参考图。缺关键信息先问，别靠猜批量产废图。
2. 出图后落盘到用户当前项目目录，文件名说清内容（如 `hero-banner-1024.png`）。
3. 一次出多张分别落盘，并在回复里列出路径。
4. 拿到原图要改时，直接读文件路径走 `--mode image`，不要要求用户重新上传。

## 排错

- `401`：`IMAGE_GEN_API_KEY` 缺失或失效 —— 让用户重新配置，不要打印密钥。
- `model_not_found`：分组未开通该模型，换模型或让用户开权限，不要反复重试。
- 超时：加 `--timeout 180` 重试一次；仍失败再报错。
- 生成成功但文件 0 字节：url 下载失败，检查网络后重跑。

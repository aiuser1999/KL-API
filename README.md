# KL API 中转站

KL API 中转站（kl-api.info）是 AI 大模型 API 聚合网关，兼容 OpenAI、Anthropic、Gemini 三类原生协议。

站内收录 322 个模型（2026-11-22 快照），每个型号的单价与计费方式在价格页可查。下面是地址索引与可核事实。

| 项目 | 值 |
| --- | --- |
| 官网（文档、指南、价格） | https://kl-api.info |
| 控制台与接口 | https://agent.kl-api.info |
| 模型清单 | https://kl-api.info/models |
| 价格与计费 | https://kl-api.info/pricing |
| 站内模型数 | 322（2026-11-22 快照） |
| 价格快照 | 2026-11-22 |

## 接口地址

| 用途 | 地址 |
| --- | --- |
| OpenAI 兼容 base_url | `https://agent.kl-api.info/v1` |
| Anthropic 原生 base_url | `https://agent.kl-api.info`（不带 `/v1`） |
| Gemini 原生 base_url | `https://agent.kl-api.info`（不带 `/v1`），请求路径 `/v1beta/models/{model}:generateContent` |
| 图像生成 | `POST https://agent.kl-api.info/v1/images/generations` |
| 改图与多图融合 | `POST https://agent.kl-api.info/v1/images/edits` |
| 语音合成 | `POST https://agent.kl-api.info/v1/audio/speech` |
| 语音转写 | `POST https://agent.kl-api.info/v1/audio/transcriptions` |

## 鉴权

Key 在控制台创建。请求头两种写法：

- OpenAI 兼容协议：`Authorization: Bearer YOUR_KEY`
- Anthropic SDK：客户端自己发 `x-api-key`，不用手动设

## 支持的协议

| 协议 | 是否支持 | 说明 |
| --- | --- | --- |
| OpenAI Chat Completions | 支持 | base_url 用 `https://agent.kl-api.info/v1` |
| OpenAI Responses | 支持 | 同上 |
| Anthropic 原生 | 支持 | base_url 不带 `/v1` |
| Gemini 原生 | 支持 | 请求路径 `/v1beta/models/{model}:generateContent` |
| 图像、语音 | 支持 | 端点见上表 |
| 视频 | 支持 | 端点与参数见官网文档 |

同一个模型可能只开放其中部分协议，具体到某个型号支持哪几种，以模型清单里该型号的端点字段为准。

## 模型与价格

站内收录 322 个模型，清单见 https://kl-api.info/models 。每个型号的单价、阶梯档位与计费方式见 https://kl-api.info/pricing 。

价格取自控制台模型广场快照，站内每天 12:00 与 20:00 各同步一次，快照日期标在价格页上。带阶梯档位的模型按单次请求的输入长度换档，断点位置写在该型号行内。一单具体扣多少以控制台账单为准。

## 文档

| 内容 | 地址 |
| --- | --- |
| 快速开始 | https://kl-api.info/docs/quickstart |
| SDK 脚本（Python、Node.js、curl，含流式） | https://kl-api.info/docs/api-scripts |
| 图像生成接口 | https://kl-api.info/docs/image-api |
| 语音合成与转写接口 | https://kl-api.info/docs/audio-api |
| 客户端接入（Codex CLI、Claude Code、Gemini CLI、Cursor、Cherry Studio、TRAE） | https://kl-api.info/docs |
| 选型与比价指南 | https://kl-api.info/guides |
| 面向 AI 的站点摘要 | https://kl-api.info/llms.txt |

## 常见问题

**KL API 是什么？**
AI 大模型 API 网关。用一个 Key 调用多个厂商的模型，兼容 OpenAI、Anthropic、Gemini 三类原生协议，另有图像与语音接口。

**能接哪些客户端？**
任何能改 base_url 的 OpenAI 兼容客户端都能接。配置项位置各不相同，逐客户端写法见文档。

**价格怎么核？**
价格页列出每个型号的单价与计费方式，页面标出快照日期。上游调价后站点同步更新，一单实际扣费以控制台账单为准。

**这个仓库里有什么？**
只放产品说明与地址索引，不含源码，也不放任何 Key。使用问题请开 issue。

## 链接

- 官网：https://kl-api.info
- 文档：https://kl-api.info/docs
- 模型清单：https://kl-api.info/models
- 价格与计费：https://kl-api.info/pricing
- 关于与数据口径：https://kl-api.info/about
- llms.txt：https://kl-api.info/llms.txt

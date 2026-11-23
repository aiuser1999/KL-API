# 接口配方（agent.kl-api.info）

Base URL：`https://agent.kl-api.info/v1`
鉴权：`Authorization: Bearer $IMAGE_GEN_API_KEY`

## 文生图

```bash
curl -sS https://agent.kl-api.info/v1/images/generations \
  -H "Authorization: Bearer $IMAGE_GEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2.6-sunburst",
    "prompt": "一只戴透明宇航头盔的橘猫，飘在星空里，插画风格",
    "n": 1,
    "size": "1024x1024"
  }'
```

返回可能是 `data[0].b64_json`，也可能是 `data[0].url`，两种都要能处理。网关也可能返回 `text/event-stream`，内容为逐行 `data: {...}`，取最后一条可解析的 JSON。

## 改图 / 图生图

`POST /v1/images/edits`，`multipart/form-data`：`model`、`prompt`、`n`、`size`，以及一张或多张 `image` 文件。

```bash
curl -sS https://agent.kl-api.info/v1/images/edits \
  -H "Authorization: Bearer $IMAGE_GEN_API_KEY" \
  -F "model=gpt-image-2.6-sunburst" \
  -F "prompt=改成夜景，霓虹灯，赛博朋克色调" \
  -F "size=1024x1024" \
  -F "image=@./input.png"
```

多图融合就重复 `-F "image=@./b.png"`。参考图是远程 URL 或 data URL 时，先下载/解码成本地字节再作为文件上传（脚本已经这么做）。

## 查询可用模型（无需密钥）

```bash
curl -sS https://agent.kl-api.info/api/pricing
```

过滤 `model_type` 为 `图像` 的条目即图像模型，`enable_groups` 说明哪些分组可用。请求的图像模型必须在该密钥所属分组内，否则返回 `model_not_found`。

## 常用尺寸

`1024x1024`（方图）、`1536x1024`（横图）、`1024x1536`（竖图）。具体支持范围以模型为准，报参数错误就回到 `1024x1024`。

## 错误对照

| 现象 | 原因 | 处理 |
|---|---|---|
| `401 Invalid token` | 密钥缺失/失效 | 重新配置 `IMAGE_GEN_API_KEY`，不要打印密钥 |
| `model_not_found` | 分组未开通该模型 | 换模型或开分组，不要重试 |
| `400` 参数错误 | 尺寸/数量不被模型支持 | 回到 `1024x1024`、`n=1` |
| 429 | 频率或额度受限 | 稍后重试，或提示用户额度 |
| 请求超时 | 图像模型耗时较长 | `--timeout 180` 重试一次 |
| 文件 0 字节 | 只拿到 url 且下载失败 | 检查网络后重跑 |

## 计费参考

一次文生图返回形如：

```json
{"usage":{"input_tokens":35,"output_tokens":824,"total_tokens":859,
 "output_tokens_details":{"image_tokens":824,"text_tokens":0}}}
```

按 image tokens 计费，尺寸越大消耗越多。

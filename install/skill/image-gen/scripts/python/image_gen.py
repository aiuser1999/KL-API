#!/usr/bin/env python3
"""agent.kl-api.info 生图脚本（标准库实现，无需 pip 安装）。

用法：
    python3 image_gen.py --mode text --prompt "一只太空猫" --out ./cat.png
    python3 image_gen.py --mode image --image ./in.png --prompt "改成夜景" --out ./out.png
    python3 image_gen.py --mode image-prompt --prompt "融合成海报" --image a.png --image b.png --out ./poster.png

环境变量：IMAGE_GEN_API_KEY（必填；也接受 KL_API_KEY 兼容旧名）
          IMAGE_GEN_BASE_URL（可选，覆盖默认站点）
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

DEFAULT_BASE = "https://agent.kl-api.info/v1"
DEFAULT_MODEL = "gpt-image-2.6-sunburst"
DEFAULT_SIZE = "1024x1024"
MODES = ("text", "image", "image-prompt")


def load_env_files():
    """从常见的 .env 位置补齐缺失的环境变量，不覆盖已有值。"""
    candidates = []
    if os.environ.get("APPDATA"):
        candidates.append(Path(os.environ["APPDATA"]) / "kl-api" / ".env")
    home = os.environ.get("HOME") or os.environ.get("USERPROFILE")
    if home:
        candidates.append(Path(home) / ".config" / "kl-api" / ".env")
        candidates.append(Path(home) / ".env")
    candidates.append(Path.cwd() / ".env")
    for path in candidates:
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            if key and key not in os.environ:
                os.environ[key] = value.strip().strip("'\"")
        break


def api_key():
    return os.environ.get("IMAGE_GEN_API_KEY") or os.environ.get("KL_API_KEY") or ""


def guess_type(name):
    ctype, _ = mimetypes.guess_type(name)
    return ctype or "application/octet-stream"


def read_image(ref):
    """本地文件、http(s) URL、data URL 统一读成 (bytes, filename, content_type)。"""
    if ref.startswith("data:"):
        header, _, data = ref.partition(",")
        meta = header[5:]
        is_b64 = ";base64" in meta
        ctype = meta.split(";")[0] or "application/octet-stream"
        raw = base64.b64decode(data) if is_b64 else urllib.parse.unquote_to_bytes(data)
        return raw, f"input.{ctype.split('/')[-1]}", ctype
    if ref.startswith("http://") or ref.startswith("https://"):
        with urllib.request.urlopen(ref, timeout=120) as resp:
            ctype = resp.headers.get("Content-Type", "image/png")
            data = resp.read()
        name = Path(urllib.parse.urlparse(ref).path).name or "input.png"
        return data, name, ctype
    path = Path(ref).expanduser().resolve()
    return path.read_bytes(), path.name, guess_type(path.name)


def _download(url):
    with urllib.request.urlopen(url, timeout=120) as resp:
        return resp.read()


def encode_multipart(fields, files):
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in fields.items():
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode("utf-8")
        )
    for name, filename, ctype, data in files:
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{filename}\"\r\n"
            f"Content-Type: {ctype}\r\n\r\n".encode("utf-8")
        )
        parts.append(data)
        parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def parse_response(ctype, raw):
    text = raw.decode("utf-8", "replace")
    if "event-stream" in (ctype or ""):
        last = None
        for line in text.splitlines():
            line = line.strip()
            if not line.startswith("data:"):
                continue
            body = line[5:].strip()
            if body in ("", "[DONE]"):
                continue
            try:
                last = json.loads(body)
            except json.JSONDecodeError:
                continue
        if last is None:
            raise SystemExit("流式响应里没有可用数据")
        return last
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        raise SystemExit(f"期望 JSON，实际收到：{text[:300]}")


def save_image(item, out_path):
    b64 = item.get("b64_json") if isinstance(item, dict) else None
    if b64:
        Path(out_path).write_bytes(base64.b64decode(b64))
        return
    url = (item or {}).get("url")
    if not url:
        raise SystemExit("响应里既没有 b64_json 也没有 url")
    if url.startswith("data:"):
        raw, _, _ = read_image(url)
        Path(out_path).write_bytes(raw)
        return
    Path(out_path).write_bytes(_download(url))


def main():
    parser = argparse.ArgumentParser(description="agent.kl-api.info 生图")
    parser.add_argument("--mode", choices=MODES, default="text")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--image", action="append", default=[], help="参考图，可重复")
    parser.add_argument("--images", default="", help="逗号分隔的参考图列表")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--size", default=DEFAULT_SIZE)
    parser.add_argument("--n", type=int, default=1)
    parser.add_argument("--out", default="")
    parser.add_argument("--base-url", default="")
    parser.add_argument("--timeout", type=float, default=300.0)
    args = parser.parse_args()

    load_env_files()
    key = api_key()
    if not key:
        raise SystemExit("IMAGE_GEN_API_KEY 未设置。请先配置环境变量，不要把密钥写进脚本或对话。")

    images = list(args.image)
    if args.images:
        images.extend(part.strip() for part in args.images.split(",") if part.strip())
    if args.mode != "text" and not images:
        raise SystemExit(f"{args.mode} 模式需要至少一个 --image")

    base = (args.base_url or os.environ.get("IMAGE_GEN_BASE_URL") or DEFAULT_BASE).rstrip("/")
    out = args.out or f"image-{int(time.time())}.png"
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    headers = {"Authorization": f"Bearer {key}"}

    if args.mode == "text":
        url = f"{base}/images/generations"
        payload = {"model": args.model, "prompt": args.prompt, "n": args.n, "size": args.size}
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    else:
        url = f"{base}/images/edits"
        files = []
        for ref in images:
            data, name, ctype = read_image(ref)
            files.append(("image", name, ctype, data))
        body, ctype = encode_multipart(
            {"model": args.model, "prompt": args.prompt, "n": str(args.n), "size": args.size}, files
        )
        headers["Content-Type"] = ctype

    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as resp:
            payload = parse_response(resp.headers.get("Content-Type", ""), resp.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        print(f"HTTP {error.code}（{url}）\n{detail[:800]}", file=sys.stderr)
        if "model_not_found" in detail:
            print("\n该密钥分组未开通这个图像模型，换模型或去控制台开分组。", file=sys.stderr)
        if error.code == 401:
            print("\nIMAGE_GEN_API_KEY 无效或已过期。", file=sys.stderr)
        return 1
    except urllib.error.URLError as error:
        print(f"请求失败：{error.reason}", file=sys.stderr)
        return 1

    items = payload.get("data") if isinstance(payload, dict) else None
    if not items:
        print(f"响应里没有图片：{json.dumps(payload)[:500]}", file=sys.stderr)
        return 1

    for index, item in enumerate(items):
        if len(items) == 1:
            target = out
        else:
            stem = Path(out).stem
            suffix = Path(out).suffix or ".png"
            target = str(Path(out).with_name(f"{stem}-{index + 1}{suffix}"))
        save_image(item, target)
        print(Path(target).resolve())

    usage = payload.get("usage") if isinstance(payload, dict) else None
    if usage:
        print(f"usage: {json.dumps(usage)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())

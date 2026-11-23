#!/usr/bin/env node
'use strict';
// agent.kl-api.info 生图脚本（文生图 / 改图 / 多图融合）
// 用法见 ../SKILL.md 与 ../INSTALL.md
//
// 环境变量：IMAGE_GEN_API_KEY（必填，也可用 KL_API_KEY 兼容旧名）
// 可选：IMAGE_GEN_BASE_URL 覆盖默认站点

const { writeFileSync, readFileSync, mkdirSync } = require('node:fs');
const { resolve, basename, extname, dirname } = require('node:path');

const DEFAULT_BASE = 'https://agent.kl-api.info/v1';
const DEFAULT_MODEL = 'gpt-image-2.6-sunburst';
const DEFAULT_SIZE = '1024x1024';
const MODES = ['text', 'image', 'image-prompt'];

function usage() {
  return [
    '用法：',
    '  node image-gen.js --mode text --prompt "画面描述" --out ./out.png',
    '  node image-gen.js --mode image --image ./in.png --prompt "改成夜景" --out ./out.png',
    '  node image-gen.js --mode image-prompt --prompt "融合成海报" --image a.png --image b.png --out ./poster.png',
    '',
    '参数：--mode text|image|image-prompt，--prompt，--image（可重复，支持本地文件/URL/data URL），',
    '      --model，--size（默认 1024x1024），--n，--out，--base-url，--timeout（秒）',
    '环境变量：IMAGE_GEN_API_KEY',
  ].join('\n');
}

function parseArgs(argv) {
  const out = { images: [], mode: 'text' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} 缺少取值`);
      return value;
    };
    switch (arg) {
      case '--mode': out.mode = next(); break;
      case '--prompt': out.prompt = next(); break;
      case '--image': out.images.push(next()); break;
      case '--model': out.model = next(); break;
      case '--size': out.size = next(); break;
      case '--n': out.n = Number(next()); break;
      case '--out': out.out = next(); break;
      case '--base-url': out.base = next(); break;
      case '--timeout': out.timeout = Number(next()) * 1000; break;
      case '-h':
      case '--help': out.help = true; break;
      default: throw new Error(`未知参数：${arg}`);
    }
  }
  return out;
}

// 支持 .env 兜底：$APPDATA/kl-api/.env、$HOME/.env
function readEnvFiles() {
  const candidates = [];
  if (process.env.APPDATA) candidates.push(resolve(process.env.APPDATA, 'kl-api', '.env'));
  if (process.env.HOME || process.env.USERPROFILE) {
    const home = process.env.HOME || process.env.USERPROFILE;
    candidates.push(resolve(home, '.config', 'kl-api', '.env'));
    candidates.push(resolve(home, '.env'));
  }
  candidates.push(resolve(process.cwd(), '.env'));
  for (const file of candidates) {
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (match === null) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
    break;
  }
}
readEnvFiles();

function apiKey() {
  return process.env.IMAGE_GEN_API_KEY || process.env.KL_API_KEY || '';
}

async function toBlob(ref) {
  if (/^data:/i.test(ref)) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(ref);
    if (match === null) throw new Error('data URL 格式不对');
    const type = match[1] || 'application/octet-stream';
    const bytes = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8');
    return { blob: new Blob([bytes], { type }), name: `input.${type.split('/')[1] || 'png'}` };
  }
  if (/^https?:\/\//i.test(ref)) {
    const res = await fetch(ref);
    if (!res.ok) throw new Error(`下载参考图失败：${ref} HTTP ${res.status}`);
    const type = res.headers.get('content-type') || 'image/png';
    return { blob: new Blob([Buffer.from(await res.arrayBuffer())], { type }), name: basename(new URL(ref).pathname) || 'input.png' };
  }
  const path = resolve(ref);
  const ext = extname(path).replace('.', '').toLowerCase() || 'png';
  const type = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return { blob: new Blob([readFileSync(path)], { type }), name: basename(path) };
}

// 兼容普通 JSON 与 SSE（逐行 data: {...}）
async function readPayload(res) {
  const type = res.headers.get('content-type') || '';
  const text = await res.text();
  if (type.includes('event-stream')) {
    let last;
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const body = trimmed.slice(5).trim();
      if (body === '' || body === '[DONE]') continue;
      try { last = JSON.parse(body); } catch { /* 分片未完整，跳过 */ }
    }
    if (last === undefined) throw new Error('流式响应里没有可用数据');
    return last;
  }
  try { return JSON.parse(text); } catch { throw new Error(`期望 JSON，实际收到：${text.slice(0, 300)}`); }
}

async function saveImage(item, out) {
  if (item && typeof item.b64_json === 'string' && item.b64_json !== '') {
    writeFileSync(out, Buffer.from(item.b64_json, 'base64'));
    return;
  }
  const url = item && item.url;
  if (typeof url !== 'string' || url === '') throw new Error('响应里既没有 b64_json 也没有 url');
  if (/^data:/i.test(url)) {
    const { blob } = await toBlob(url);
    writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载生成结果失败：HTTP ${res.status}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (error) {
    console.error(`${error.message}\n\n${usage()}`);
    process.exit(2);
  }
  if (args.help) { console.log(usage()); return; }
  if (!MODES.includes(args.mode)) { console.error(`--mode 只能是 ${MODES.join(' / ')}\n\n${usage()}`); process.exit(2); }
  if (!args.prompt) { console.error(`--prompt 必填\n\n${usage()}`); process.exit(2); }
  if (args.mode !== 'text' && args.images.length === 0) {
    console.error(`${args.mode} 模式需要至少一个 --image\n\n${usage()}`);
    process.exit(2);
  }

  const key = apiKey();
  if (key === '') {
    console.error('IMAGE_GEN_API_KEY 未设置。请先配置环境变量，不要把密钥写进脚本或对话。');
    process.exit(2);
  }

  const base = (args.base || process.env.IMAGE_GEN_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  const model = args.model || DEFAULT_MODEL;
  const size = args.size || DEFAULT_SIZE;
  const n = Number.isFinite(args.n) && args.n > 0 ? args.n : 1;
  const timeoutMs = Number.isFinite(args.timeout) ? args.timeout : 300000;
  const out = args.out || `image-${Date.now()}.png`;
  mkdirSync(dirname(resolve(out)), { recursive: true });

  const headers = { Authorization: `Bearer ${key}` };
  let url;
  let body;
  if (args.mode === 'text') {
    url = `${base}/images/generations`;
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ model, prompt: args.prompt, n, size });
  } else {
    url = `${base}/images/edits`;
    const form = new FormData();
    form.set('model', model);
    form.set('prompt', args.prompt);
    form.set('n', String(n));
    form.set('size', size);
    for (const ref of args.images) {
      const { blob, name } = await toBlob(ref);
      form.append('image', blob, name);
    }
    body = form;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
  } catch (error) {
    console.error(error.name === 'AbortError' ? `请求超时（${timeoutMs / 1000}s）` : `请求失败：${error.message}`);
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`HTTP ${res.status}（${url}）\n${detail.slice(0, 800)}`);
    if (detail.includes('model_not_found')) console.error('\n该密钥分组未开通这个图像模型，换模型或去控制台开分组。');
    if (res.status === 401) console.error('\nIMAGE_GEN_API_KEY 无效或已过期。');
    process.exit(1);
  }

  const payload = await readPayload(res);
  const items = Array.isArray(payload && payload.data) ? payload.data : [];
  if (items.length === 0) {
    console.error(`响应里没有图片：${JSON.stringify(payload).slice(0, 500)}`);
    process.exit(1);
  }

  for (let i = 0; i < items.length; i++) {
    const target = items.length === 1 ? out : out.replace(/(\.\w+)?$/, `-${i + 1}$1`);
    await saveImage(items[i], target);
    console.log(resolve(target));
  }
  if (payload && payload.usage) console.error(`usage: ${JSON.stringify(payload.usage)}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});

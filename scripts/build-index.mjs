// 扫描仓库目录结构，生成 _index.json
// 由 .github/workflows/build-index.yml 在每次 push 后自动执行
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const OWNER = '682540';
const REPO = 'xiaolinji-share';

// 不作为分类的目录
const SKIP_DIRS = new Set(['.git', '.github', 'scripts', 'node_modules']);

function gitTime(rel) {
  try {
    return execSync(`git log -1 --format=%cI -- "${rel}"`, { cwd: ROOT }).toString().trim() || null;
  } catch {
    return null;
  }
}

function readCategory(cat) {
  const abs = path.join(ROOT, cat);
  const items = [];
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const rel = path.posix.join(cat, ent.name);

    if (ent.isDirectory()) {
      const files = fs
        .readdirSync(path.join(ROOT, rel))
        .filter((f) => !f.startsWith('.'));
      const cover = files.find((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f)) || null;
      const descFile = files.find((f) => /^(说明|readme)\.(txt|md)$/i.test(f));
      let desc = '';
      if (descFile) {
        try {
          desc = fs.readFileSync(path.join(ROOT, rel, descFile), 'utf8').slice(0, 200).trim();
        } catch {}
      }
      items.push({ name: ent.name, path: rel, type: 'folder', files, cover, desc, updated: gitTime(rel) });
    } else {
      items.push({ name: ent.name, path: rel, type: 'file', files: [ent.name], cover: null, desc: '', updated: gitTime(rel) });
    }
  }
  return items;
}

const cats = [];
for (const ent of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!ent.isDirectory() || ent.name.startsWith('.') || SKIP_DIRS.has(ent.name)) continue;
  const items = readCategory(ent.name);
  if (items.length) cats.push({ name: ent.name, items });
}

// 分类内按更新时间倒序（新资源在前）
for (const c of cats) {
  c.items.sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
}

const out = {
  generated: new Date().toISOString(),
  owner: OWNER,
  repo: REPO,
  source: `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@main/`,
  cats,
};

fs.writeFileSync(path.join(ROOT, '_index.json'), JSON.stringify(out, null, 1));

const total = cats.reduce((n, c) => n + c.items.length, 0);
console.log(`index rebuilt: ${cats.length} 个分类, ${total} 条资源`);

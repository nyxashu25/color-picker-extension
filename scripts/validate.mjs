// Sanity checks for the extension package. Run with: node scripts/validate.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const fail = (msg) => problems.push(msg);

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version ?? '')) fail(`invalid version: ${manifest.version}`);
if ((manifest.name ?? '').length === 0 || manifest.name.length > 45) fail('name must be 1-45 characters (Chrome Web Store limit)');
if ((manifest.description ?? '').length === 0 || manifest.description.length > 132) {
  fail(`description must be 1-132 characters (Chrome Web Store limit), got ${(manifest.description ?? '').length}`);
}

// Every file the manifest points at must exist.
const refs = new Set();
const collect = (v) => {
  if (typeof v === 'string' && /\.(png|html|js|css|json)$/.test(v)) refs.add(v);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
};
['icons', 'action', 'side_panel', 'background', 'content_scripts', 'options_page', 'options_ui'].forEach((k) => collect(manifest[k]));
for (const ref of refs) if (!existsSync(join(root, ref))) fail(`manifest references a missing file: ${ref}`);

// Icon files must be PNGs of exactly the size their key promises.
for (const [size, file] of Object.entries(manifest.icons ?? {})) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  const buf = readFileSync(path);
  const isPng = buf.length > 24 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a';
  if (!isPng) { fail(`${file} is not a PNG`); continue; }
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (w !== Number(size) || h !== Number(size)) fail(`${file} is ${w}x${h}, expected ${size}x${size}`);
}

// Manifest V3 forbids inline scripts and remote code, so catch both early.
for (const file of readdirSync(root).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(join(root, file), 'utf8');
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc=/.test(m[1])) fail(`${file}: inline <script> is blocked by the extension CSP`);
    if (/\bsrc=["']https?:/i.test(m[1])) fail(`${file}: remote script is not allowed in Manifest V3`);
  }
  if (/<link[^>]+href=["']https?:/i.test(html)) fail(`${file}: remote stylesheet; bundle it instead`);
  if (/\son[a-z]+=["']/i.test(html)) fail(`${file}: inline event handler is blocked by the extension CSP`);
}

// Permissions should be deliberate: list them so a change shows up in review.
console.log(`${manifest.name} v${manifest.version}`);
console.log(`permissions: ${(manifest.permissions ?? []).join(', ') || '(none)'}`);
console.log(`host permissions: ${(manifest.host_permissions ?? []).join(', ') || '(none)'}`);

if (problems.length) {
  console.error('\nValidation failed:');
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}
console.log('manifest OK');

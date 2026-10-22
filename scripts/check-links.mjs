import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
const pages = (await files(root)).filter(file => file.endsWith('.html'));
const contents = new Map(await Promise.all(pages.map(async file => [file, await readFile(file, 'utf8')])));
const ids = new Map([...contents].map(([file, html]) => [file, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]))]));
const errors = [];
let checked = 0;
for (const [file, html] of contents) {
  const relative = path.relative(root, file);
  const pageURL = new URL(relative.replace(/index\.html$/, ''), 'https://bl808-linux.github.io/');
  for (const tag of html.matchAll(/<(?:a|link|script|img|source)\b[^>]*>/g)) {
    if (/\brel="canonical"/.test(tag[0])) continue;
    const match = tag[0].match(/\b(?:href|src)="([^"]+)"/);
    if (!match) continue;
    const href = match[1].replaceAll('&amp;', '&');
    let url;
    try { url = new URL(href, pageURL); } catch { errors.push(`${relative}: invalid URL ${href}`); continue; }
    if (url.origin !== pageURL.origin) continue;
    const pathname = decodeURIComponent(url.pathname).replace(/^\//, '');
    let target = path.join(root, pathname);
    try {
      const info = await stat(target);
      if (info.isDirectory()) target = path.join(target, 'index.html');
      await stat(target);
    } catch { errors.push(`${relative}: missing target ${href}`); continue; }
    if (url.hash && target.endsWith('.html') && !ids.get(target)?.has(decodeURIComponent(url.hash.slice(1)))) {
      errors.push(`${relative}: missing anchor ${href}`);
    }
    checked++;
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`Checked ${checked} internal references across ${pages.length} HTML pages.`);

#!/usr/bin/env python3
"""Mirror the two official English BL808 HTML manuals without rebuilding their contents."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
import subprocess

SITE = Path(__file__).resolve().parents[1]
BUNDLES = [
    ('BL808_DS', 'en', 'BL808_html_DS_1.2_en', 'Datasheet 1.2 — English'),
    ('BL808_RM', 'en', 'BL808_RM_en_1.3_html', 'Reference Manual 1.3 — English'),
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def normalize_html(data):
    data, count = re.subn(rb'<body\b', b'<body data-pagefind-ignore="all"', data, count=1)
    if count != 1:
        raise ValueError('HTML body missing')
    # Upstream references a custom stylesheet which is absent from both bundles.
    data = re.sub(rb'[ \t]*<link\b[^>]*href="(?:\.\./)?_static/style\.css"[^>]*>(?:\r?\n)?', b'', data)
    ids = set(re.findall(rb'\bid="([^"]+)"', data))
    # Sphinx emits these links for unresolved RST references. Keep their text.
    def diagnostic_link(match):
        return match[2] if match[1] not in ids else match[0]
    return re.sub(rb'<a href="#([^"]+)">(<span class="problematic"[^>]*>.*?</span>)</a>',
                  diagnostic_link, data, flags=re.S)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source', type=Path, default=SITE.parent / 'references/bl_docs')
    args = ap.parse_args()
    source = args.source.resolve()
    revision = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    for family, language, folder, _ in BUNDLES:
        if not (source / family / language / folder / 'index.html').is_file():
            ap.error('missing complete HTML manual: ' + folder)
    target = SITE / 'public/vendor/bl808'
    if target.exists():
        manifest = target / 'manifest.json'
        if not manifest.is_file() or json.loads(manifest.read_text()).get('generator') != 'scripts/import-vendor-docs.py':
            ap.error('refusing to replace an unmanaged directory: ' + str(target))
        shutil.rmtree(target)
    target.mkdir(parents=True)
    manifest = {
        'generator': 'scripts/import-vendor-docs.py',
        'source_repository': 'https://github.com/bouffalolab/bl_docs',
        'source_commit': revision,
        'method': 'Mirror the complete vendor-provided Sphinx HTML, images, styles, sources and search assets.',
        'html_changes': ['Add data-pagefind-ignore="all" to body, keeping this archive outside the edited site search.', 'Remove upstream links to the absent _static/style.css.', 'Remove dangling Sphinx diagnostic hyperlinks while preserving their original text and span IDs.'],
        'manuals': [],
    }
    for family, language, folder, title in BUNDLES:
        src = source / family / language / folder
        dest = target / family / language
        shutil.copytree(src, dest)
        files = []
        for file in sorted(dest.rglob('*')):
            if not file.is_file():
                continue
            before = file.read_bytes()
            if file.suffix == '.html':
                after = normalize_html(before)
                file.write_bytes(after)
            else:
                after = before
            files.append({'path': file.relative_to(dest).as_posix(), 'source_sha256': sha(before),
                          'published_sha256': sha(after), 'bytes': len(after)})
        pdfs = []
        for pdf in sorted((source / family / language).glob('*.pdf')):
            data = pdf.read_bytes()
            pdfs.append({'path': pdf.relative_to(source).as_posix(), 'sha256': sha(data), 'bytes': len(data),
                         'url': f'https://github.com/bouffalolab/bl_docs/blob/{revision}/{pdf.relative_to(source).as_posix()}'})
        row = {'title': title, 'source_path': src.relative_to(source).as_posix(),
               'url': f'{family}/{language}/', 'html_pages': sum(f['path'].endswith('.html') for f in files),
               'content_pages': sum(f['path'].startswith('content/') and f['path'].endswith('.html') for f in files),
               'bytes': sum(f['bytes'] for f in files), 'pdfs': pdfs, 'files': files}
        manifest['manuals'].append(row)
        print(f"{title}: {row['content_pages']} content pages, {len(files)} files, {row['bytes']} bytes")
    (target / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    links = '\n'.join(f'<li><a href="{m["url"]}">{html.escape(m["title"])}</a></li>' for m in manifest['manuals'])
    (target / 'index.html').write_text(f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Original BL808 manuals</title>
<style>body{{font:18px/1.65 system-ui,sans-serif;max-width:48rem;margin:3rem auto;padding:0 1.25rem;color:#1c2434;background:#fafbfc}}h1{{line-height:1.2}}li{{margin:.85rem 0}}a{{color:#174eaf}}code{{overflow-wrap:anywhere}}footer{{margin-top:2rem;font-size:.9rem;color:#505b6c}}</style>
</head><body data-pagefind-ignore="all"><main>
<h1>Original BL808 manuals</h1>
<p>Complete English vendor manuals, including register tables, diagrams and their own search.</p>
<ul>{links}</ul>
<p>These manuals are kept separate from the edited BL808 reference. Original vendor attribution is retained.</p>
<footer><p>Source: <a href="https://github.com/bouffalolab/bl_docs/tree/{revision}">Bouffalo Lab official documentation</a>.</p>
<p>Revision: <code>{revision}</code>. <a href="manifest.json">File checksums and source PDFs</a>.</p>
<p><a href="../../../">BL808 Reference home</a></p></footer>
</main></body></html>\n''')


if __name__ == '__main__':
    main()

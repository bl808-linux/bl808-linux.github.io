# BL808 Reference

Static hardware documentation for BL808, published at
[bl808-linux.github.io](https://bl808-linux.github.io).

Requires Node.js 24 or later.

```sh
npm ci
npm run dev
```

`npm run check` checks Astro and TypeScript. `npm run build` renders the static
site, builds its Pagefind search index, and checks internal URLs and anchors.
`npm test` runs browser checks against a production preview; install its browser
first with `npx playwright install chromium`.

Pages live in `src/content/docs`. Register data lives in `src/data/registers.json`;
the shared register component renders metadata, bit diagrams and field tables.
Only established definitions and verified behavior belong in this repository.
Experimental notes, raw laboratory records and unresolved claims stay outside
the published site. See Sources and Reading the reference for editorial rules.

Pushes to `main` build and deploy `dist/` through GitHub Pages. Pull requests
run the same build and browser checks without deploying. Hardware access is
never part of the documentation build.

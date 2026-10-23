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
the published site. See Board observations and Reading the reference for
measurement context and notation.

## GitHub Pages deployment

In the repository's **Settings → Pages → Build and deployment**, set **Source**
to **GitHub Actions**. The site uses Astro, so its source files must be built
before publication.

Pushes to `main` run **Deploy Astro site to Pages**. That workflow installs
dependencies, checks and builds the site, and deploys only `dist/`. The
`public/.nojekyll` marker is copied into that output.

If a separate **pages build and deployment** run reports a Jekyll error about
an `.astro` file, switch the Pages source from **Deploy from a branch** to
**GitHub Actions**. The marker in the built output does not replace this
repository setting. Do not publish the repository root as the site.

Pull requests run the build and browser checks without deploying. Hardware
access is never part of the documentation build.

## Original English vendor manuals

The complete official English Datasheet 1.2 and Reference Manual 1.3 are
mirrored at [/vendor/bl808/](https://bl808-linux.github.io/vendor/bl808/).
They retain the vendor's HTML, register tables, diagrams, attribution and
Sphinx search. The home page and sidebar link to the manuals; their contents
remain separate from the edited reference chapters and Pagefind search. Chinese editions are not included.

`public/vendor/bl808/manifest.json` pins the official repository revision,
source PDF identities and per-file source/published SHA-256 hashes. HTML-only
normalizations remove references to an upstream-missing stylesheet and
unresolved Sphinx diagnostic hyperlinks (their text is preserved), and exclude
the archive from Pagefind. The link checker handles `genindex.html` as an
ordinary page rather than mistaking it for a directory index.

To refresh from a local clone of `https://github.com/bouffalolab/bl_docs`:

```sh
python3 scripts/import-vendor-docs.py --source /path/to/bl_docs
npm run check
npm run build
npm test
```

The checked-in mirror builds without a documentation checkout or PDF converter.
This archive reproduces vendor documentation; it does not extend the site's
board-validation claims.

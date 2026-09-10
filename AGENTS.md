# Repository Guidelines

## Project Structure & Module Organization

This repository contains the standalone Fiestas Patronales de Aranda de Duero 2026 experience. Source data lives in `src/data/fiestas-2026/events.json`. Nunjucks templates are in `src/templates/`, page styles in `src/styles/`, and browser modules in `src/scripts/`. The generated site is written to `dist/` and should not be edited by hand.

## Build, Test, and Development Commands

- `npm install`: install Nunjucks, Tailwind, PostCSS, and Autoprefixer.
- `npm run build`: generate the agenda, map, event detail pages, community plans, CSS, JS, and the `sitemap.xml` / `robots.txt` derived from the indexable pages actually written to `dist/`.
- `npm run dev`: build once and serve the output at `http://127.0.0.1:8002/`.
- `npm run icons`: regenerate the self-hosted Font Awesome subset (`src/assets/icons/`). `npm run build` fails if it is stale, so run this after adding any new `fa-*` class.
- `npm run clean`: remove generated `dist/` output.

Routes live at the root of the domain (`/`, `/mapa/`, `/e/<id>/<slug>/`, `/plan/`, `/planes/`, `/colaboradores/`). The casetas, `/populares/`, and transit features are gated behind the `FIESTAS_CASETAS_ENABLED`, `FIESTAS_POPULAR_ENABLED`, and `FIESTAS_TRANSIT_ENABLED` env flags (all off in this fork).

## Coding Style & Naming Conventions

Use ES modules and two-space indentation in JavaScript, Nunjucks, and CSS. Keep event ids numeric and stable, matching the detail path pattern `/e/<id>/<slug>/`. Prefer descriptive data fields over template-only conditionals.

## Testing Guidelines

Two suites, wired to git hooks so they run on their own (`npm install` points
`core.hooksPath` at `scripts/hooks/`):

- `npm test` — unit tests with `node --test`: pure functions (ICS export with its
  `VALARM` reminder, plan storage, analytics consent gate, favorite reminders)
  plus source-level checks such as the pinned Leaflet SRI hashes and the per-job
  workflow permissions. Takes about a second, and runs on every commit via
  `scripts/hooks/pre-commit`.
- `npm run test:e2e` — Playwright end-to-end suite in `tests/e2e/`, on Chromium
  desktop and Chromium mobile. Takes a couple of minutes, and runs before every
  push via `scripts/hooks/pre-push`, which rebuilds `dist/` first because
  Playwright serves what is on disk, not what is in `src/`.

Escape hatches, for when you know what you are doing: `git commit --no-verify`,
`git push --no-verify`, or `SKIP_E2E=1 git push`.

The end-to-end suite never reaches the network. External hosts (`unpkg.com`,
`api.arandadeduero.es`, the CARTO basemaps, remote posters, `fonts.googleapis.com`,
`fonts.gstatic.com`, `www.googletagmanager.com`, `*.google-analytics.com`) are
intercepted in `tests/e2e/fixtures.js`, and any request to a host that is not
stubbed fails the test. Leaflet is served from `node_modules/leaflet`,
byte-identical to the copy on unpkg, so the pinned SRI hashes are verified for
real. `tests/e2e/consent.spec.js` asserts that Google Analytics never loads
before «Aceptar» and stays off after «Denegar».

If Playwright has no browser build for your system (for example macOS 13), point
it at a browser you already have. Set it once per clone, so the hooks pick it up
too without exporting anything:

~~~bash
git config fiestas.playwrightChannel chrome
~~~

`PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` works too, for a one-off run. Skip
both if `npx playwright install chromium` works on your system.

The hooks are local, so they only protect the machine that installed them. The
deploy workflow runs `npm test` before building, which is the one check that
also applies to work that never touched a local hook.

Still worth a manual pass before publishing, because the suite does not cover
it: visual layout and dark mode, the PWA install prompt on a real device, the
share sheet, and calendar downloads landing correctly in a calendar app.

## Commit & Pull Request Guidelines

Use short imperative commit messages, for example `Extract fiestas standalone build`. Pull requests should describe the user-facing change, include verification steps, and attach screenshots for layout or responsive changes.

## URL Policy

All routes are local to this site (`https://fiestas.arandadeduero.dev/`). There is no companion events site to link out to. `publicBaseUrl` in `scripts/build.mjs` is the single source of truth for absolute URLs (canonical tags, social metadata, sitemap).

## Typography, Colours & Branding

- Default font is **Outfit**, loaded from Google Fonts. Every `font-family` starts with `'Outfit'`; `tailwind.config.js` `sans`/`display` match.
- Brand palette (see `src/styles/base.css` `:root`): primary `#0083c1`, accent `#3cb4e5`, secondary `#ce0e2d`, warm `#f5a800` / `#a4541c`, highlight `#e9f4f9`, text `#3c3c3c` / `#646464`.
- Credit line: original project by volunteers of Aldea Pucela, adapted by the Ayuntamiento de Aranda de Duero (Concejalía de Innovación). Keep both.

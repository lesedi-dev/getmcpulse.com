# mcpulse-web

The marketing site. Astro, static output, deployed to Vercel.

Sibling to the other two repos:

```
mcpulse/        private monorepo — apps/api, apps/dashboard, packages/schemas
mcpulse-sdk/    public repo — @mcpulse/sdk
mcpulse-web/    this — the public site
```

## Commands

```bash
npm run dev       # localhost:4321
npm run build     # → dist/
npm run preview   # serve dist/
npx astro check   # typecheck .astro and .ts
```

## What is here

| | |
|---|---|
| `src/pages/index.astro` | The one landing page: hero, how it works, install, insights, metrics, CTA |
| `src/components/InstallSequence.astro` | The four-step install player |
| `src/components/HeroPanel.astro` | The drawn overview panel in the hero |
| `src/components/PillarVisual.astro` | The three moving diagrams under "How it works" |
| `src/components/PostCover.astro` | Per-post cover art, drawn from the slug — no image pipeline |
| `src/content/blog/` | 20 posts, front matter validated by `src/content.config.ts` |
| `src/lib/site.ts` | Every URL and claim the site makes about itself |

## Decisions

**No framework, no islands.** Every page is a document. The only JavaScript is
three inline scripts — the scroll-reveal observer, the install player, and the
copy button — which Astro inlines rather than bundling, so the site ships zero
`.js` files. A marketing site that needs a runtime to render text is arguing
against the product.

**Dark and near-monochrome**, which is the dashboard's own `--color-primary-*`
slate ramp taken a step further. One accent (`signal`), spent only on things
that are live: the pulse mark, the active step, a hover.

**Stylesheet is external, not inlined.** `inlineStylesheets: "always"` put a
full copy of the CSS in all 23 pages, so a reader moving between posts
re-downloaded ~14kb they already had. `"auto"` makes it one cached file.

**Motion is decoration and behaves like it.** Everything animated is guarded by
`prefers-reduced-motion`, and the install sequence jumps to its final panel —
the one that pays off — rather than replaying at zero duration.

**Fonts are self-hosted** through Fontsource. No request to a third party
before the first paint.

## Adding a post

Drop a `.md` file in `src/content/blog/`. Front matter is validated at build
time, so a typo fails the build rather than shipping:

```yaml
---
title: A title
description: One sentence, shown on the card and in the OG tags.
published: 2026-08-14
topic: Measurement   # Measurement | Tool design | Engineering | Privacy
minutes: 5
---
```

Quote the `description` if it contains a colon — YAML will otherwise read it as
a key and fail the parse.

The file name is the URL. Posts appear on `/blog` newest first, in `/rss.xml`,
and in the sitemap automatically.

## Weight

At the last build: 7.3kb gzipped for the homepage, 6kb for a post, plus a 14kb
stylesheet cached across the site. No JavaScript bundles. 23 pages.

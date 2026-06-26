# distilly

## What distilly is

distilly is a pure, local **HTML-to-markdown** library that distills web pages into
clean, token-efficient markdown for AI agents. It performs **no network I/O** and
contacts **no hosted service**: callers hand it HTML they already fetched, and it
returns clean markdown. MIT licensed.

Its engine is **vendored from and decoupled from** wevm/curl.md's `src/md/`: distilly
keeps the local conversion (`fromHtml`, `chunk`, `rules/*`, `profiles`) and drops
curl.md's hosted client, the network `mod.ts` fetch wrapper, and the type-only `#db`
import. The vendored portions remain MIT and are credited in `NOTICE`.

distilly's primary consumer is **webveil**'s extractor seam (an anonymous-capable,
self-hosted web search/fetch tool), but it is a standalone library usable by anyone
who needs page-to-markdown extraction without a third-party service.

## Domain terms

- **distill / htmlToMarkdown** — convert a raw HTML string into clean markdown. The
  single public entry point. Signature (pinned by webveil's Extractor seam):
  `htmlToMarkdown(html, { baseUrl?, rules?, size? }) => Promise<{ markdown, truncated }>`.
- **size preset** — `s` / `m` / `l` / `f` (~5k / 10k / 25k / full chars); the budget the
  markdown is truncated to, so agents control context cost.
- **rule** — a per-site cleanup/extraction rule (e.g. github, mdn, cloudflare,
  tailwind), vendored from curl.md's `rules/`. The tuned part of the engine; the rule
  set is pluggable and can grow over time.
- **profile** — a named extraction configuration (vendored from curl.md's `profiles`).
- **vendored engine** — the subset of curl.md's `src/md/` carved into distilly, with
  the network/server/db coupling removed.

## Stack

pnpm workspace monorepo; the published package lives in `packages/distilly`. TypeScript
(NodeNext, strict), built with `tsc`, tested with vitest, formatted with prettier
(tabs, single quotes, no bracket spacing). Conversion stack (once vendored): the
unified / rehype / remark ecosystem (`rehype-parse`, `rehype-remark`, `remark-gfm`,
`remark-stringify`) plus `tokenx`.

## Verify gate

`pnpm format:check && pnpm build && pnpm test` (prepare: `pnpm install`). See
`.dorfl.json`.

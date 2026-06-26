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

- **distill / htmlToMarkdown** — convert a raw HTML string into clean markdown (the PURE
  entrypoint). Signature (pinned by webveil's Extractor seam):
  `htmlToMarkdown(html, { baseUrl?, rules?, size? }) => Promise<{ markdown, truncated }>`.
  Imports NO networking.
- **urlToMarkdown** — the NETWORKED entrypoint (`distilly/fetch`):
  `urlToMarkdown(url, { fetch, rules }) => Promise<{ markdown, truncated }>`. The caller
  INJECTS `fetch`; distilly bakes in no egress. Applies network **Rules**, then runs the
  fetched HTML through the pure core. See `docs/adr/0001-rule-vs-profile-and-injected-fetch.md`.
- **size preset** — `s` / `m` / `l` / `f` (~5k / 10k / 25k / full chars); the budget the
  markdown is truncated to, so agents control context cost.
- **Profile** (PURE, network-free) — a per-site extraction config keyed by the page's
  doc-site **generator** (vitepress, docusaurus, mintlify, sphinx, starlight, ...). Its
  `contentRootSelectors` tell the converter which DOM subtree is the real content. Vendored
  from curl.md's `profiles.ts`; operates on HTML the caller already has. The pure `rules?`
  option is a `Profile`. Pluggable; can grow.
- **Rule** (NETWORK) — a per-site URL-rewriter keyed by **URL pattern** (github, mdn,
  cloudflare, zero, ...) that BYPASSES the page HTML and fetches cleaner source from an
  alternate endpoint (GitHub API, raw.githubusercontent, `.md` URLs). Vendored from
  curl.md's `rules.ts`; lives ONLY behind the networked `distilly/fetch` entrypoint and
  runs only via the caller-injected `fetch`. **Not the same as a Profile** — Profile is
  pure/generator-keyed, Rule is network/URL-keyed; do not conflate them.
- **vendored engine** — the subset of curl.md's `src/md/` carved into distilly, with
  the server/db coupling removed and the network confined to the injected-`fetch` seam.

## Stack

pnpm workspace monorepo; the published package lives in `packages/distilly`. TypeScript
(NodeNext, strict), built with `tsc`, tested with vitest, formatted with prettier
(tabs, single quotes, no bracket spacing). Conversion stack (once vendored): the
unified / rehype / remark ecosystem (`rehype-parse`, `rehype-remark`, `remark-gfm`,
`remark-stringify`) plus `tokenx`.

## Verify gate

`pnpm format:check && pnpm build && pnpm test` (prepare: `pnpm install`). See
`.dorfl.json`.

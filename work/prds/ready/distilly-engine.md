---
title: distilly — vendor and decouple curl.md's local HTML-to-markdown engine into a pure MIT library
slug: distilly-engine
---

> Launch snapshot — records intent at creation, NOT maintained. Current truth: `docs/adr/` + code; remaining work: `work/tasks/ready/`.

## Problem Statement

AI agents need clean, low-token markdown from web pages, but the good extraction
engines are coupled to hosted services. wevm/curl.md has an excellent local
HTML-to-markdown engine, yet its npm package only exposes a **hosted client** that POSTs
every URL to `curl.md` and authenticates by account, which deanonymizes the caller and
routes traffic through a third party. Its local conversion code (`src/md/`) is not
exported (package-private `#*` imports), is bundled inside a server codebase, and
depends transitively on `hono`, so it cannot be reused cleanly as a library.

The consumer (webveil) wants to fetch through its own anonymity-preserving egress and
convert **locally**, with no hosted service in the loop. There is no standalone library
that provides curl.md-quality extraction as a pure, network-free function.

## Solution

A standalone, **MIT-licensed** library, `distilly`, that vendors curl.md's local
`src/md/` engine and decouples it from the server, exposing a single pure function:

```ts
htmlToMarkdown(html: string, options?: { baseUrl?: string; size?: 's'|'m'|'l'|'f' })
  : Promise<{ markdown: string; truncated: boolean }>
```

The caller supplies HTML it already fetched (through whatever egress it chooses);
distilly does no network I/O and contacts no hosted service. It keeps curl.md's tuned
per-site rules and supports size presets so agents control context cost.

## User Stories

1. As a tool author (webveil), I want `htmlToMarkdown(html, { baseUrl, size })` so I can
   convert pages I fetched through my own egress into clean markdown without any hosted
   service.
2. As a tool author, I want size presets `s`/`m`/`l`/`f` (~5k/10k/25k/full chars) with a
   `truncated` flag, so I can bound the context cost of each fetched page.
3. As a tool author, I want a `baseUrl` so relative links in the page resolve to
   absolute URLs in the markdown.
4. As a user concerned with privacy, I want the library to perform NO network I/O and to
   never contact curl.md (or any hosted service), so converting a page leaks nothing.
5. As a maintainer, I want the engine vendored from curl.md's `src/md/` with the
   server/network/db coupling removed, so distilly is a clean, dependency-light library.
6. As a maintainer, I want curl.md's per-site rules (github, mdn, cloudflare, tailwind,
   zero, ...) carried over so extraction quality matches the upstream, with the rule set
   pluggable so it can grow.
7. As an open-source consumer, I want distilly to be MIT and to credit curl.md's MIT
   copyright in `NOTICE`, so I can reuse it freely and lawfully.
8. As a downstream of webveil's extractor seam, I want distilly's public API to match the
   `Extractor` contract webveil pins, so it drops in without an adapter.

### Autonomy notes (the two gate axes)

- **humanOnly:** omitted. An agent may task and build this; the design is resolved.
- **needsAnswers:** omitted. No open questions block tasking. The carve-out boundary is
  specified below from a source review already performed.

## Implementation Decisions

Vendor from curl.md `src/md/` (reviewed at a recent commit). **Keep**: `fromHtml.ts`
(pure `fromHtml(html, options) => markdown` on the unified/rehype/remark stack:
`rehype-parse`, `rehype-remark`, `remark-gfm`, `remark-stringify`, `unified`, `hast`/
`vfile` types), `chunk.ts`, `rules/*` (+ the `rules.ts` registry), `profiles.ts`,
`sites.ts`, and `tokenx` for token estimation.

**Drop / decouple**:
- `mod.ts`'s network `fetch()` wrapper (distilly never fetches; callers provide HTML).
  Salvage only the pure rule-application/profile-selection logic it wraps, not the
  request path.
- The type-only `import type { DB } from '#db/types.gen.ts'` in `mod.ts` — inline a local
  string-literal-union type instead.
- Test-only `~/components` import; any server/`hono`/Cloudflare references (the `hono`
  hits in `rules.ts` are a site-rule for `hono.dev`, NOT the framework — keep that rule).

**Public API** (the only export consumers depend on): `htmlToMarkdown(html, { baseUrl?,
rules?, size? }) => Promise<{ markdown, truncated }>` plus the `Size` type. Internally it
parses with `fromHtml`, applies matching rules, then truncates to the size budget
(`s`/`m`/`l`/`f` ≈ 5k/10k/25k/full chars), setting `truncated` when the budget cut
content. Truncation must be UTF-8 code-point safe.

**Packaging**: single published package `packages/distilly` (already scaffolded). Runtime
deps = the unified/rehype/remark set + `tokenx`. MIT `LICENSE` + `NOTICE` crediting
wevm/curl.md are already in place; keep them accurate as code is vendored. The MIT
library must contain only MIT-compatible code (no GPL/AGPL), since it is consumed by the
AGPL `webveil`.

## Testing Decisions

Test external behaviour at the public seam `htmlToMarkdown`, not internals:
- Known HTML in -> expected markdown out (headings, lists, tables, links, code blocks).
- `baseUrl` resolves relative links to absolute.
- Size presets enforce their char budgets and set `truncated` correctly; truncation never
  splits a UTF-8 code point.
- At least one per-site rule (e.g. github or mdn) demonstrably cleans a representative
  page better than the generic path.
- No network is performed (the function is pure given its HTML input).
Port/adapt curl.md's own `fromHtml`/`rules`/`chunk` tests where licensing-compatible as a
regression baseline (they are MIT).

## Out of Scope

- Fetching/network, egress, proxies, anonymity — those live in **webveil**, not here.
- A hosted service or any use of curl.md's hosted client — forbidden by design.
- Search, result ranking, or agent orchestration.
- An exhaustive port of every curl.md site rule — ship a solid starter subset; the rule
  set is pluggable and can grow later.

## Further Notes

distilly is repo 1 of a two-repo effort. Repo 2 is **webveil** (AGPL), an
incur-based, pi-agnostic CLI + MCP web search/fetch tool (plus a `pi-webveil` extension
that is a drop-in replacement for Ollama's `web_search`/`web_fetch`). webveil depends on
distilly through its `Extractor` seam (MIT is compatible with AGPL). The fuller design
record lives in the originating session's design doc; the durable framing is above.

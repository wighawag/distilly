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
- **needsAnswers:** omitted. No open questions block tasking. The carve-out boundary was
  specified from a source review and now lives in the tasks.

> Tasked: the implementation and testing detail (the curl.md `src/md/` carve-out, the
> public API shape, size-preset/truncation rules, and the licensing reconciliation) now
> lives in the task files under `work/tasks/` and any ADRs in `docs/adr/`. This prd keeps
> only its durable framing below.

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

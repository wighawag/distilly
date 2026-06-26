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
`src/md/` engine and decouples it from the server, in **two cleanly-separated layers /
entrypoints** (see `docs/adr/0001-rule-vs-profile-and-injected-fetch.md`):

- **`distilly` (pure):** `htmlToMarkdown(html, { baseUrl?, rules?, size? }) => Promise<{
  markdown, truncated }>`. Imports NO networking. The caller supplies HTML it already
  fetched; pure per-site **Profiles** (generator-keyed content-root selectors) tune
  quality; size presets bound context cost.
- **`distilly/fetch` (networked):** `urlToMarkdown(url, { fetch, rules }) => Promise<{
  markdown, truncated }>`. The network URL-rewriter **Rules** (github/mdn/...) live here.
  distilly bakes in NO `fetch` — the **caller injects** `fetch`, so a call without one can
  never touch the network (this is what lets webveil supply anonymity-preserving egress).

Neither path uses curl.md's hosted client/service.

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
6. As a maintainer, I want curl.md's pure, network-free per-site **Profiles** (vitepress,
   docusaurus, mintlify, sphinx, starlight, ...) carried over — generator-keyed
   content-root selectors that tune extraction on the HTML the caller already has — with
   the set pluggable so it can grow. (Distinct from network Rules; see story 9.)
7. As an open-source consumer, I want distilly to be MIT and to credit curl.md's MIT
   copyright in `NOTICE`, so I can reuse it freely and lawfully.
8. As a downstream of webveil's extractor seam, I want distilly's public API to match the
   `Extractor` contract webveil pins, so it drops in without an adapter.
9. As a tool author who wants curl.md's full quality, I want a separate networked
   entrypoint `urlToMarkdown(url, { fetch, rules })` where I INJECT `fetch` and the network
   URL-rewriter **Rules** (github/mdn/...) fetch cleaner source — so I get the upstream
   experience while distilly itself bakes in no egress (preserving my anonymity choice).
10. As a privacy-conscious consumer, I want the pure `distilly` entrypoint to import NO
    networking at all (a separate `distilly/fetch` entrypoint owns the network), so I can
    depend on the pure path and be provably network-free.

### Autonomy notes (the two gate axes)

- **humanOnly:** omitted. An agent may task and build this; the design is resolved.
- **needsAnswers:** omitted. No open questions block tasking. The carve-out boundary was
  specified from a source review and now lives in the tasks.

> Tasked: the implementation and testing detail (the curl.md `src/md/` carve-out, the
> public API shape, size-preset/truncation rules, and the licensing reconciliation) now
> lives in the task files under `work/tasks/` and any ADRs in `docs/adr/`. This prd keeps
> only its durable framing below.

## Out of Scope

- **Implicit / baked-in network egress.** distilly imports no `fetch`; the networked
  entrypoint only ever calls the caller-INJECTED `fetch`. Egress policy, proxies, and
  anonymity remain **webveil's** job — distilly provides the network *mechanism* (Rules +
  the injected-fetch seam), not the egress *policy*. (This SUPERSEDES the original
  "fetching/network live in webveil, not here" — see ADR-0001.)
- A hosted service or any use of curl.md's hosted client — forbidden by design.
- Search, result ranking, or agent orchestration.
- An exhaustive port of every curl.md Profile or Rule — ship a solid starter subset of
  each; both sets are pluggable and can grow later.

## Further Notes

distilly is repo 1 of a two-repo effort. Repo 2 is **webveil** (AGPL), an
incur-based, pi-agnostic CLI + MCP web search/fetch tool (plus a `pi-webveil` extension
that is a drop-in replacement for Ollama's `web_search`/`web_fetch`). webveil depends on
distilly through its `Extractor` seam (MIT is compatible with AGPL). The fuller design
record lives in the originating session's design doc; the durable framing is above.

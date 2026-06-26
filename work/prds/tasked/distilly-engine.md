---
title: distilly — vendor and decouple curl.md's local HTML-to-markdown engine into a pure MIT library
slug: distilly-engine
needsAnswers: true
---

> Launch snapshot — records intent at creation, NOT maintained. Current truth: `docs/adr/` + code; remaining work: `work/tasks/ready/`.

## Needs answers (drifted after tasking — do NOT re-task until reconciled)

This prd was tasked (it rests in `prds/tasked/`), but a build agent surfaced a
load-bearing conceptual error in story 6 and the per-site task derived from it. The
correction is a SCOPE CHANGE, so the prd is flagged `needsAnswers: true` in place (per
WORK-CONTRACT.md "a prd that has drifted AFTER it was tasked"): tasks 1 and 2 already
landed and are unaffected; the per-site task `vendor-rules-registry-site-subset` is also
flagged and must not be built until this is resolved.

**The error.** Story 6 ("carry over curl.md's per-site rules — github, mdn, cloudflare,
tailwind, zero") conflates TWO different upstream concepts under one word, "rule":

- Upstream **`Rule`** (`rules.ts`: github, mdn, cloudflare, zero) = **network URL-rewriters**
  that BYPASS the page HTML and fetch raw markdown from an alternate source (GitHub API,
  raw.githubusercontent, `.md` endpoints). They are inherently network-bound.
- Upstream **`Profile`** (`profiles.ts`: vitepress, docusaurus, mintlify, sphinx,
  starlight) = **pure, network-free** per-site content-root selectors, keyed by doc-site
  generator. This is what the landed `fromHtml` reads (`contentRootSelectors`) and what the
  landed public `rules?: Profile` option already binds to.

So "a per-site rule (github/mdn) cleans the same HTML better than generic, network-free"
is impossible: github/mdn's value IS the forbidden network fetch.

**The decision taken (to encode on reconcile + clear this flag).** distilly will OWN BOTH
halves, cleanly SEPARATED, so it can be used two ways:

1. **Pure path** (today's `htmlToMarkdown(html, ...)`): zero network, imports no
   networking. A pure **Profile** registry (vitepress/docusaurus/...) tunes per-site
   quality here.
2. **Fetching path** (new, e.g. `urlToMarkdown(url, { fetch, rules })`): the network
   URL-rewriter **Rules** (github/mdn) live here, BUT distilly bakes in NO fetch — the
   CALLER injects `fetch` (this is what lets webveil supply its anonymity-preserving
   egress). Still no use of curl.md's HOSTED client/service.

This REVISES the original "Out of Scope" line "Fetching/network … live in webveil, not
here": network is now in-scope for distilly AS A CALLER-INJECTED CAPABILITY, separated
from the pure core; the hosted-service prohibition stands.

**Open questions for the human (answer, then re-decompose + clear `needsAnswers`):**

1. Confirm the injected-`fetch` seam shape: `urlToMarkdown(url, { fetch, rules })` where
   distilly imports no networking and the caller supplies `fetch` (so a no-`fetch` call
   can never touch the network). Yes / adjust?
2. Packaging: two entrypoints (`distilly` pure + `distilly/fetch` networked) so a pure
   consumer cannot even import the network half, or both from the single entrypoint as
   long as the pure one pulls in no network code?

(When answered: re-task the per-site work into a pure-Profile slice + a separate
network-Rules-with-injected-fetch slice, supersede the stale
`vendor-rules-registry-site-subset` task, update story 6 + Out of Scope above, and clear
`needsAnswers` on this prd.)

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

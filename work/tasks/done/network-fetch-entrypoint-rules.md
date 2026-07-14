---
title: Networked distilly/fetch entrypoint with caller-injected fetch and URL-rewriter Rules
slug: network-fetch-entrypoint-rules
spec: distilly-engine
blockedBy: [vendor-profile-registry-site-subset]
covers: [9, 10]
---

## What to build

The SEPARATE networked entrypoint `distilly/fetch`, exposing:

```ts
urlToMarkdown(url, { fetch, rules }): Promise<{ markdown, truncated }>
```

so distilly can be used the second way (URL in → markdown out) WITHOUT distilly ever baking
in network egress. Per ADR-0001, the **caller injects `fetch`**; distilly imports no
networking of its own.

End-to-end path: caller calls `urlToMarkdown(url, { fetch })` → a matching network **Rule**
(github/mdn/cloudflare/zero/...) may REWRITE the URL to a cleaner source (GitHub API, raw
markdown endpoint) and fetch it via the **injected `fetch`** → otherwise the page itself is
fetched via the injected `fetch` → the fetched HTML (or already-clean markdown) is run
through the existing pure core (`htmlToMarkdown` / `fromHtml` + Profile detection) → returns
`{ markdown, truncated }`.

A **Rule** (per ADR-0001 + `CONTEXT.md`) is a per-site URL-rewriter keyed by URL pattern
that BYPASSES the page HTML and fetches cleaner source. It is the NETWORK counterpart to a
pure Profile, and lives ONLY behind this entrypoint.

Hard invariants:

- **distilly bakes in NO `fetch`.** `urlToMarkdown` REQUIRES the caller to pass `fetch`; a
  call without it does not silently fall back to a global/`node:http` fetch — it cannot
  touch the network on its own. This is what preserves a downstream's anonymity choice
  (webveil injects its anonymity-preserving egress).
- **Two entrypoints, isolated.** The pure `distilly` entrypoint (`htmlToMarkdown`) must
  import NONE of this network code (a pure consumer stays provably network-free). This
  task adds a `distilly/fetch` export; it does NOT add network code to the pure path.
- **No hosted curl.md client/service** — still forbidden. Rules fetch from public
  source endpoints via the injected `fetch`, never curl.md's hosted API.

Scope:

- Add the `distilly/fetch` package entrypoint/export (a second exports entry; the pure
  `.` entry stays network-free).
- Vendor curl.md's `rules.ts` URL-rewriter Rules (a solid STARTER SUBSET — e.g. github,
  mdn, plus a couple more) and the pure rule-matching/dispatch logic from `mod.ts` (which
  Rule matches a URL, how its rewrite/extract runs), but route ALL fetching through the
  injected `fetch`. Drop the `#db`, `hono`, Cloudflare, and hosted-client coupling.
- `urlToMarkdown` composes: rule-match → (rewrite + injected-fetch + extract) OR
  (injected-fetch the page) → pure core conversion → size budget.

## Acceptance criteria

- [ ] `distilly/fetch` is a separate package entrypoint exporting
      `urlToMarkdown(url, { fetch, rules }) => Promise<{ markdown, truncated }>`.
- [ ] `urlToMarkdown` performs network I/O ONLY through the caller-injected `fetch`; with no
      `fetch` provided it never touches the network (a test asserts: given no `fetch`, no
      network call occurs — e.g. it throws/refuses rather than using a global fetch).
- [ ] A starter subset of URL-rewriter Rules (at least github and mdn) rewrites matching
      URLs to cleaner source and fetches via the injected `fetch`; a test drives this with a
      MOCK `fetch` (no real network) and asserts the cleaner source is used.
- [ ] A non-matching URL is fetched directly via the injected `fetch` and run through the
      pure core; the result honours `size`/`truncated`.
- [ ] The PURE `distilly` entrypoint imports NONE of the network code — a test/assertion
      confirms the pure path pulls in no `fetch`/network module (the entrypoints are
      isolated).
- [ ] No hosted curl.md client/service is used; no `#db`/`hono`/Cloudflare imports.
- [ ] Tests cover the new behaviour (mirror the repo's vitest style) entirely with a mocked
      injected `fetch` — no real network.
- [ ] `pnpm format:check && pnpm build && pnpm test` passes.

## Blocked by

- `vendor-profile-registry-site-subset` — this entrypoint composes the pure core + Profile
  detection and touches the same engine/`src` + package `exports` area, so it is serialized
  after the Profile task to avoid merge conflicts.

## Prompt

> Goal: build distilly's SEPARATE networked entrypoint `distilly/fetch` exposing
> `urlToMarkdown(url, { fetch, rules })`, where the CALLER injects `fetch` and curl.md's
> network URL-rewriter **Rules** (github/mdn) fetch cleaner source — while distilly itself
> bakes in NO egress and the pure entrypoint stays network-free.
>
> FIRST, check this task against current reality (launch snapshot, may have DRIFTED):
> re-read `work/specs/tasked/distilly-engine.md` (stories 9, 10 + the revised Out of Scope),
> `docs/adr/0001-rule-vs-profile-and-injected-fetch.md` (the load-bearing design: Rule =
> NETWORK/URL-keyed, injected `fetch`, two isolated entrypoints), `CONTEXT.md`, and what the
> prior tasks landed in `tasks/done/`: the pure `htmlToMarkdown`/`fromHtml` core and the
> Profile registry (`vendor-profile-registry-site-subset`). Build against the REAL shapes;
> if they contradict this task, route to needs-attention.
>
> Critical design invariants (these are the whole point — see ADR-0001):
> - distilly imports NO networking. `urlToMarkdown` REQUIRES `fetch` from the caller; with
>   none it must NOT touch the network (no global/`node:http` fallback). This preserves
>   webveil's anonymity-preserving egress.
> - The pure `distilly` entrypoint (`htmlToMarkdown`) must import NONE of this network code.
>   Add a SECOND package export `distilly/fetch`; keep the `.` export network-free. A pure
>   consumer must stay provably network-free.
> - No hosted curl.md client/service. Rules fetch public source endpoints via the injected
>   `fetch` only. No `#db`/`hono`/Cloudflare.
>
> Where to look: upstream `wevm/curl.md` at `src/md/rules.ts` (the URL-rewriter Rules —
> `defineRule({ patterns: URLPattern[], rewrite, fetch, extract })`) and the pure
> rule-matching/dispatch logic inside `src/md/mod.ts` (which Rule matches a URL + how its
> rewrite/extract is sequenced — salvage that ORCHESTRATION, but route every fetch through
> the caller's injected `fetch`, never curl.md's transport/hosted path). The repo is MIT.
>
> Seams to test at: `urlToMarkdown` with a MOCK injected `fetch` (no real network ever) —
> assert a github/mdn URL is rewritten to cleaner source and that source is used; a
> non-matching URL is fetched directly and run through the pure core; and given NO `fetch`,
> no network call occurs. Plus an isolation check that the pure `distilly` entrypoint imports
> no network code.
>
> "Done" means: `distilly/fetch` exports `urlToMarkdown` with caller-injected `fetch`, a
> starter Rule subset (github/mdn+) works via mocked fetch, no-`fetch` never reaches the
> network, the pure entrypoint stays network-free and isolated, no hosted/`#db`/`hono`
> coupling, tests cover it all with a mock fetch, and `pnpm format:check && pnpm build &&
> pnpm test` is green.
>
> RECORD non-obvious in-scope decisions (the exact `urlToMarkdown` signature/options, how
> rule-match vs direct-fetch is sequenced, the no-`fetch` refusal behaviour, the
> package `exports` shape for two entrypoints). ADR-gate-worthy ones (see
> `work/protocol/ADR-FORMAT.md`) → `docs/adr/`; otherwise note in the done record.

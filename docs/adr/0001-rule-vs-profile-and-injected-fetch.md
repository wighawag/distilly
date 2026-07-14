# Rule vs Profile, and network via a caller-injected `fetch`

## Status

accepted

## Context and decision

distilly vendors per-site extraction tuning from wevm/curl.md, where the single word
"rule" covers TWO distinct upstream concepts that must not be conflated:

- **Profile** (curl.md `profiles.ts`: vitepress, docusaurus, mintlify, sphinx,
  starlight, ...) is a **pure, network-free** per-site config, keyed by the page's
  doc-site **generator**, whose `contentRootSelectors` tell the converter which DOM
  subtree is the real content. It operates on HTML the caller already has.
- **Rule** (curl.md `rules.ts`: github, mdn, cloudflare, zero, ...) is a **network
  URL-rewriter**, keyed by **URL pattern**, that BYPASSES the page HTML and fetches
  cleaner markdown from an alternate source (GitHub API, raw.githubusercontent, `.md`
  endpoints). Its value IS the network request.

We decided distilly will **own both halves, cleanly separated into two layers / two
package entrypoints**, rather than punting the network half to the downstream (webveil):

- `distilly` (pure entrypoint): `htmlToMarkdown(html, { baseUrl?, rules?, size? })`.
  Imports NO networking. The pure **Profile** registry lives here. This is the today
  surface (`rules?` is typed `Profile`).
- `distilly/fetch` (networked entrypoint): `urlToMarkdown(url, { fetch, rules })`. The
  network **Rule** URL-rewriters (github/mdn/...) live here. distilly bakes in NO
  `fetch` — the **caller injects `fetch`**. A call without an injected `fetch` can never
  touch the network.

## Why

- **Privacy is preserved by construction.** The pure entrypoint cannot import the network
  half, so a pure consumer is provably network-free. The networked entrypoint only ever
  calls the caller's `fetch`, so distilly never has implicit egress.
- **webveil's reason to exist is honoured.** webveil supplies its OWN anonymity-preserving
  `fetch`; a baked-in `fetch` would defeat that. Injection is what lets webveil stay thin
  (anonymous egress + MCP/CLI shell) while distilly owns the full curl.md-quality engine.
- **The concept model stays coherent.** "Profile" = pure/generator-keyed; "Rule" =
  network/URL-keyed. The two are pinned in `CONTEXT.md` so the distinction cannot be
  re-forked under one muddled word again.

## Consequences

- This REVISES the original spec scope line "Fetching/network ... live in webveil, not
  here": network is now in-scope for distilly **as a caller-injected capability**,
  separated from the pure core. The hosted-service prohibition (no use of curl.md's hosted
  client/service) still stands.
- MIT/AGPL split is unaffected: MIT code that accepts a `fetch` parameter is fine for the
  AGPL webveil to consume.

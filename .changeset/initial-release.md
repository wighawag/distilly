---
"distilly": minor
---

Initial release: distill HTML into clean, token-efficient markdown for agents.

- `htmlToMarkdown(html, options)` from `distilly`: the pure, network-free core. Converts HTML to budget-bounded markdown with auto-detected per-site `Profile`s.
- `urlToMarkdown(url, options)` from `distilly/fetch`: the networked entrypoint that fetches through a caller-injected `fetch` (no `fetch` is baked in) and applies the bundled URL-rewriter rules.

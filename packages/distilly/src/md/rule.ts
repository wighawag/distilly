// Vendored from wevm/curl.md (MIT) — the NETWORK rule machinery from
// `src/md/rules.ts` + the pure rule-matching/dispatch parts of `src/md/mod.ts`.
//
// A `Rule` is a per-site URL-rewriter keyed by `URLPattern` that BYPASSES the
// page HTML and fetches cleaner SOURCE (raw markdown, an API endpoint) from an
// alternate URL. Unlike a pure `Profile` (generator-keyed, HTML-only, lives on
// the `.` entrypoint), a Rule's value IS the network request, so it lives ONLY
// behind the `distilly/fetch` entrypoint.
//
// CRITICAL DECOUPLING from upstream:
//   - distilly bakes in NO `fetch`. Upstream's `mod.ts` defaults
//     `context.fetch` to `globalThis.fetch.bind(globalThis)`; distilly does
//     NOT. The caller-injected `fetch` is the ONLY transport; a rule's `fetch`
//     hook receives it via `context.fetch` and must never reach for a global.
//   - The hosted-client/transport/`#db`/`hono`/Cloudflare coupling is dropped:
//     no `transport`, no `tokenx` source-token accounting, no SPA browser
//     render retry, no DB request typing. Those are upstream server concerns.

// `URLPattern` / `URLPatternResult` are global types from the `dom` lib (and a
// runtime global on Node >= 20), so no import is needed.

/** The transport context handed to a rule's `fetch` hook: ONLY the injected `fetch`. */
export type FetchContext = {
	/** The caller-injected `fetch`. distilly bakes in none of its own. */
	fetch: typeof globalThis.fetch;
};

/** The extracted result of a rule (or the pure core): markdown content + meta. */
export type Extracted = {
	content: string;
	meta?: Record<string, string> | undefined;
};

/**
 * A network URL-rewriter rule. Keyed by `patterns`; when a URL matches, the
 * rule may `rewrite` it to a cleaner source URL, optionally use a custom
 * `fetch` hook (still through the injected `fetch` in `context`), and `extract`
 * markdown from the response.
 */
export type Rule = {
	/** Stable rule key (e.g. `githubBlob`). */
	key: string;
	/** URL patterns this rule matches. */
	patterns: URLPattern[];
	/** Rewrite the matched URL to a cleaner source URL (or `undefined` to skip). */
	rewrite?:
		| ((url: URL, match: URLPatternResult) => URL | undefined)
		| undefined;
	/**
	 * Custom fetch sequencing. Receives the (rewritten) input plus the
	 * `FetchContext` carrying the caller-injected `fetch`. distilly NEVER passes
	 * a global fetch here — the only transport is the caller's.
	 */
	fetch?:
		| ((
				input: RequestInfo | URL,
				init: RequestInit | undefined,
				context: FetchContext,
		  ) => Promise<Response>)
		| undefined;
	/** Turn the fetched response into markdown content + meta. */
	extract?: ((response: Response) => Promise<Extracted>) | undefined;
};

/**
 * Define a network rule. Mirrors curl.md's `defineRule`, minus the upstream
 * `options`/token-threading and `checks` (a hosted-eval concern). The returned
 * value is a plain `Rule` (upstream returned a factory).
 */
export function defineRule(config: Rule): Rule {
	return config;
}

/** Coerce `fetch`'s `RequestInfo | URL` input to a `URL`. */
export function asUrl(input: RequestInfo | URL): URL {
	if (input instanceof URL) return input;
	if (typeof input !== 'string' && 'url' in input) return new URL(input.url);
	return new URL(String(input));
}

/**
 * The first rule whose pattern matches `url`, with the match result. PURE — no
 * I/O; just pattern dispatch (salvaged from upstream `mod.ts`).
 */
export function matchRule(
	url: URL,
	rules: readonly Rule[],
): {rule: Rule; match: URLPatternResult} | undefined {
	for (const rule of rules)
		for (const pattern of rule.patterns) {
			const match = pattern.exec(url);
			if (match) return {rule, match};
		}
	return undefined;
}

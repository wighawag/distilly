// distilly/fetch — the NETWORKED entrypoint. `urlToMarkdown(url, { fetch, rules })`
// fetches a page (or its rewritten cleaner SOURCE) through a caller-INJECTED
// `fetch` and returns clean, budget-bounded markdown.
//
// HARD INVARIANTS (see `docs/adr/0001-rule-vs-profile-and-injected-fetch.md`):
//   - distilly bakes in NO `fetch`. `urlToMarkdown` REQUIRES the caller to pass
//     `fetch`; with none, it THROWS before any I/O — it can never fall back to a
//     global / `node:http` fetch. This preserves a downstream's anonymity
//     choice (webveil injects its anonymity-preserving egress).
//   - This module is the ONLY one that touches the network seam, and it does so
//     solely through the injected `fetch`. The pure `.` entrypoint
//     (`htmlToMarkdown`) imports NONE of this file's network code.
//   - No hosted curl.md client/service, no `#db`/`hono`/Cloudflare. Rules fetch
//     public source endpoints via the injected `fetch` only.
//
// Orchestration (salvaged from curl.md `src/md/mod.ts`, re-pointed at the
// injected `fetch`): match a Rule → (rule.rewrite the URL + rule.fetch via the
// injected fetch + rule.extract) OR (injected-fetch the page) → if the fetched
// source is already markdown, use it directly; otherwise run the HTML through
// the pure core (`fromHtml` + Profile auto-detection) → apply the `size` budget.

import {filterFrontmatterKeys, fromHtml} from './md/fromHtml.js';
import {detectProfile} from './md/profiles.js';
import {asUrl, matchRule, type Rule} from './md/rule.js';
import {rules as bundledRules} from './md/rules.js';
import type {Size} from './index.js';
import {SIZE_BUDGETS, truncateToBudget} from './truncate.js';

export type {Rule, FetchContext, Extracted} from './md/rule.js';
export {defineRule, matchRule} from './md/rule.js';
export {githubBlob, mdn, reactDev, vue, rules} from './md/rules.js';

/** The `fetch` the caller injects. distilly bakes in none of its own. */
export type Fetch = typeof globalThis.fetch;

export interface UrlToMarkdownOptions {
	/**
	 * REQUIRED. The `fetch` distilly performs ALL network I/O through. distilly
	 * never supplies one: omitting it makes the call throw before any I/O, so a
	 * pure consumer can prove distilly never reaches the network on its own.
	 */
	fetch: Fetch;
	/**
	 * The network URL-rewriter Rules to try (in order). Defaults to the bundled
	 * starter set (`githubBlob`, `mdn`, ...). Pass your own array to
	 * override/extend; pass `[]` to disable rule rewriting entirely.
	 */
	rules?: readonly Rule[];
	/** Char budget: `s`/`m`/`l` (~5k/10k/25k) or `f` (full). Defaults to `f`. */
	size?: Size;
}

export interface UrlToMarkdownResult {
	markdown: string;
	truncated: boolean;
}

/**
 * Fetch a URL and distill it into clean, budget-bounded markdown.
 *
 * Network I/O happens ONLY through `options.fetch`. If `options.fetch` is
 * missing, this throws BEFORE any network access — distilly has no egress of
 * its own.
 *
 * @param url - The page URL to fetch (string or `URL`).
 * @param options.fetch - REQUIRED caller-injected `fetch` (the only transport).
 * @param options.rules - URL-rewriter Rules to try (defaults to the bundled set).
 * @param options.size - Char budget preset (defaults to `f`/full).
 * @returns `{ markdown, truncated }`.
 */
export async function urlToMarkdown(
	url: string | URL,
	options: UrlToMarkdownOptions,
): Promise<UrlToMarkdownResult> {
	const fetch = options?.fetch;
	// REFUSE rather than reach for a global fetch: distilly bakes in no egress.
	if (typeof fetch !== 'function')
		throw new TypeError(
			'urlToMarkdown requires an injected `fetch`: distilly performs no network I/O of its own. Pass `{ fetch }` (e.g. your anonymity-preserving egress).',
		);

	const {rules = bundledRules, size = 'f'} = options;
	const inputUrl = url instanceof URL ? url : new URL(url);

	const matched = matchRule(inputUrl, rules);
	const rewrittenUrl =
		matched?.rule.rewrite?.(inputUrl, matched.match) ?? inputUrl;

	// All fetching routes through the injected `fetch` — directly or via a rule's
	// own `fetch` hook (which receives the injected fetch in its context).
	const response = matched?.rule.fetch
		? await matched.rule.fetch(rewrittenUrl, undefined, {fetch})
		: await fetch(rewrittenUrl, {redirect: 'follow'});

	if (!response.ok)
		throw new Error(
			`urlToMarkdown: fetching ${asUrl(rewrittenUrl).href} failed with status ${response.status}.`,
		);

	const {content} = await extract(
		response,
		inputUrl,
		rewrittenUrl,
		matched?.rule,
	);

	const {text, truncated} = truncateToBudget(content, SIZE_BUDGETS[size]);
	return {markdown: text, truncated};
}

/**
 * Turn the fetched response into markdown. A rule's own `extract` wins;
 * otherwise: an already-markdown source (by content-type or `.md` path) is used
 * verbatim (frontmatter split off); HTML is run through the pure core
 * (`fromHtml` + Profile auto-detection) with the ORIGINAL url as `baseUrl`.
 */
async function extract(
	response: Response,
	inputUrl: URL,
	rewrittenUrl: URL,
	rule: Rule | undefined,
): Promise<{content: string; meta: Record<string, string>}> {
	if (rule?.extract) {
		const result = await rule.extract(response);
		return {content: result.content, meta: result.meta ?? {}};
	}

	const text = await response.text();

	const contentType = (
		response.headers.get('content-type') ?? ''
	).toLowerCase();
	const isHtml =
		contentType.includes('text/html') ||
		contentType.includes('application/xhtml+xml');
	// Treat the source as already-clean markdown when the server says so, or when
	// the (rewritten) path is a `.md`/`.mdx` file AND the server did not declare
	// HTML. The HTML guard matters when a URL merely ENDS in `.md` but actually
	// serves an HTML page (e.g. a github.com `/blob/…/README.md` web view).
	const isMarkdown =
		contentType.includes('text/markdown') ||
		(!isHtml && /\.mdx?$/i.test(asUrl(rewrittenUrl).pathname));

	if (isMarkdown) {
		const {body, meta} = splitFrontmatter(text);
		return {content: body, meta: filterFrontmatterKeys(meta)};
	}

	// Generic HTML: pure core + Profile auto-detection, resolving relative links
	// against the ORIGINAL page URL.
	const profile = detectProfile(text);
	return fromHtml(text, {baseUrl: inputUrl.href, profile});
}

/**
 * Split YAML-ish frontmatter (`---\n…\n---\n`) off the top of a markdown
 * document. Faithful to curl.md `mod.ts` `splitFrontmatter`, returning the body
 * and a flat string→string meta map (no nesting; good enough for the allow-list
 * `filterFrontmatterKeys` then trims to).
 */
export function splitFrontmatter(markdown: string): {
	body: string;
	meta: Record<string, string>;
} {
	if (!markdown.startsWith('---\n')) return {body: markdown, meta: {}};
	const end = markdown.indexOf('\n---\n', 4);
	if (end === -1) return {body: markdown, meta: {}};
	const body = markdown.slice(end + 5).replace(/^\n+/, '');
	const meta: Record<string, string> = {};
	const lines = markdown.slice(4, end).split('\n');
	let currentKey: string | undefined;
	let currentValue = '';

	const flush = () => {
		if (currentKey && currentValue) meta[currentKey] = currentValue;
	};

	for (const line of lines) {
		if ((line[0] === ' ' || line[0] === '\t') && currentKey) {
			currentValue = `${currentValue} ${line.trim()}`.trim();
			continue;
		}
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		flush();
		const key = line.slice(0, colonIdx).trim();
		let value = line.slice(colonIdx + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		)
			value = value.slice(1, -1);
		currentKey = key || undefined;
		currentValue = value;
	}
	flush();
	return {body, meta};
}

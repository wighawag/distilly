// distilly — distill HTML into clean, token-efficient markdown for agents.
//
// `htmlToMarkdown` is the single public entry point (signature pinned by
// webveil's Extractor seam). It wraps the vendored, decoupled core conversion
// (`fromHtml`, from wevm/curl.md's `src/md/`) and applies the `size` budget. It
// performs NO network I/O and contacts NO hosted service: the caller hands it
// HTML it already fetched, and the function is PURE given that HTML.
//
//   htmlToMarkdown(html, { baseUrl?, rules?, size? }): Promise<{ markdown, truncated }>

import {fromHtml} from './md/fromHtml.js';
import type {Profile} from './md/profile.js';
import {SIZE_BUDGETS, truncateToBudget} from './truncate.js';

export type {Profile} from './md/profile.js';

export type Size = 's' | 'm' | 'l' | 'f'; // ~5k / 10k / 25k / full chars

/**
 * A per-site extraction rule threaded into the core conversion. The pluggable
 * rule SET + registry that resolves a page to its rule is a separate sibling
 * task (`vendor-rules-registry-site-subset`); until it lands, callers may pass a
 * rule (a `Profile`) explicitly and omitting `rules` uses the generic path.
 */
export type Rules = Profile<Record<string, unknown>>;

export interface HtmlToMarkdownOptions {
	baseUrl?: string;
	rules?: Rules;
	size?: Size;
}

export interface HtmlToMarkdownResult {
	markdown: string;
	truncated: boolean;
}

/**
 * Convert a raw HTML string into clean, budget-bounded markdown.
 *
 * Pure: no network I/O, no hosted service. The caller supplies the HTML.
 *
 * @param html - The HTML to distill.
 * @param options.baseUrl - Resolve relative links/images to absolute URLs.
 * @param options.rules - A per-site extraction rule (threaded to the core).
 * @param options.size - Char budget: `s`/`m`/`l` (~5k/10k/25k) or `f` (full).
 *   Defaults to `f`. `f` never truncates.
 * @returns `{ markdown, truncated }` where `truncated` is `true` iff the size
 *   budget actually cut content.
 */
export async function htmlToMarkdown(
	html: string,
	options: HtmlToMarkdownOptions = {},
): Promise<HtmlToMarkdownResult> {
	const {baseUrl, rules, size = 'f'} = options;

	const {content} = await fromHtml(html, {baseUrl, profile: rules});

	const {text, truncated} = truncateToBudget(content, SIZE_BUDGETS[size]);

	return {markdown: text, truncated};
}

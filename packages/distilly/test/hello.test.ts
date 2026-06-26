// Public `htmlToMarkdown` seam tests. These exercise EXTERNAL behaviour only
// (HTML string in -> { markdown, truncated } out), not engine internals: known
// HTML -> expected markdown, each `size` budget + its `truncated` flag,
// UTF-8-safe truncation at the boundary, `baseUrl` link resolution, `rules`
// threading, and purity (no network). The conversion internals are covered by
// `fromHtml.test.ts`.

import {describe, expect, test, vi} from 'vitest';
import {htmlToMarkdown} from '../src/index.js';

describe('htmlToMarkdown', () => {
	test('converts known HTML to expected markdown', async () => {
		const {markdown, truncated} = await htmlToMarkdown(
			'<h1>Title</h1><p>Hello world</p>',
		);
		expect(markdown).toContain('# Title');
		expect(markdown).toContain('Hello world');
		expect(truncated).toBe(false);
	});

	test('returns a Promise of { markdown, truncated }', async () => {
		const result = await htmlToMarkdown('<p>hi</p>');
		expect(typeof result.markdown).toBe('string');
		expect(typeof result.truncated).toBe('boolean');
	});

	test('threads baseUrl so relative links resolve to absolute', async () => {
		const {markdown} = await htmlToMarkdown('<a href="sibling">Sibling</a>', {
			baseUrl: 'https://example.com/docs/page',
		});
		expect(markdown).toContain('(/docs/sibling)');
	});

	test('relativizes same-origin absolute links via baseUrl', async () => {
		const {markdown} = await htmlToMarkdown(
			'<a href="https://example.com/about">About</a>',
			{baseUrl: 'https://example.com/docs/page'},
		);
		expect(markdown).toContain('[About](/about)');
		expect(markdown).not.toContain('https://example.com/about');
	});

	test('threads rules (profile) through to the core', async () => {
		// A profile's contentRootSelectors preserve a known content root even when
		// generic noise heuristics would prune it (asserted at the public seam).
		// Here a `.sidebar`-classed wrapper with no <main>/<article> inside is
		// pruned by the generic noise heuristic, but kept when its selector is a
		// declared content root.
		const html =
			'<!doctype html><html><body><div id="VPContent" class="sidebar"><h1>Title</h1><p>Content</p></div><p>Outside</p></body></html>';

		const generic = await htmlToMarkdown(html);
		expect(generic.markdown).not.toContain('# Title');
		expect(generic.markdown).toContain('Outside');

		const withRule = await htmlToMarkdown(html, {
			rules: {
				contentRootSelectors: ['#VPContent'],
				key: 'vitepress',
				markers: [],
			},
		});
		expect(withRule.markdown).toContain('# Title');
		expect(withRule.markdown).toContain('Content');
	});

	test('omitting rules uses the generic path', async () => {
		const {markdown} = await htmlToMarkdown('<h1>Plain</h1><p>Body</p>');
		expect(markdown).toContain('# Plain');
		expect(markdown).toContain('Body');
	});
});

describe('htmlToMarkdown size budgets', () => {
	// One paragraph well over the largest (l = 25k) budget.
	const long = 'x'.repeat(40_000);
	const html = `<p>${long}</p>`;

	test('f (full) never truncates', async () => {
		const {markdown, truncated} = await htmlToMarkdown(html, {size: 'f'});
		expect(truncated).toBe(false);
		expect([...markdown].length).toBeGreaterThan(25_000);
	});

	test('default size is full (no truncation)', async () => {
		const {truncated} = await htmlToMarkdown(html);
		expect(truncated).toBe(false);
	});

	test('s caps at ~5k chars and sets truncated', async () => {
		const {markdown, truncated} = await htmlToMarkdown(html, {size: 's'});
		expect(truncated).toBe(true);
		expect([...markdown].length).toBeLessThanOrEqual(5_000);
	});

	test('m caps at ~10k chars and sets truncated', async () => {
		const {markdown, truncated} = await htmlToMarkdown(html, {size: 'm'});
		expect(truncated).toBe(true);
		expect([...markdown].length).toBeLessThanOrEqual(10_000);
	});

	test('l caps at ~25k chars and sets truncated', async () => {
		const {markdown, truncated} = await htmlToMarkdown(html, {size: 'l'});
		expect(truncated).toBe(true);
		expect([...markdown].length).toBeLessThanOrEqual(25_000);
	});

	test('content within budget is not truncated', async () => {
		const {markdown, truncated} = await htmlToMarkdown('<p>short</p>', {
			size: 's',
		});
		expect(truncated).toBe(false);
		expect(markdown).toContain('short');
	});
});

describe('htmlToMarkdown UTF-8-safe truncation', () => {
	test('does not split an emoji (astral code point) at the boundary', async () => {
		// Each emoji is a single code point but two UTF-16 code units. Place the
		// budget boundary mid-stream so a naive code-unit slice would split one.
		const emoji = '😀'; // U+1F600, surrogate pair in UTF-16
		const {markdown} = await htmlToMarkdown(`<p>${emoji.repeat(8_000)}</p>`, {
			size: 's',
		});
		// The cut lands on a code-point boundary, so the output contains NO lone
		// surrogate (a split astral code point would leave a dangling 0xD800-0xDFFF
		// code unit). Iterating by code point and re-joining is a faithful no-op.
		expect(markdown).not.toMatch(/[\uD800-\uDFFF]/u);
		expect([...markdown].join('')).toBe(markdown);
		expect([...markdown].length).toBeLessThanOrEqual(5_000);
	});

	test('does not split a CJK character at the boundary', async () => {
		const cjk = '漢字測試'; // 4 CJK code points
		const {markdown, truncated} = await htmlToMarkdown(
			`<p>${cjk.repeat(2_000)}</p>`,
			{size: 's'},
		);
		expect(truncated).toBe(true);
		// Output is valid: re-encoding is a no-op and there are no lone surrogates.
		expect(markdown).not.toMatch(/[\uD800-\uDFFF]/u);
		expect([...markdown].length).toBeLessThanOrEqual(5_000);
	});
});

describe('htmlToMarkdown is pure (no network)', () => {
	test('performs no fetch / network call', async () => {
		const fetchSpy = vi.fn();
		const original = globalThis.fetch;
		// @ts-expect-error override for the duration of the test
		globalThis.fetch = fetchSpy;
		try {
			await htmlToMarkdown(
				'<a href="https://example.com/page">link</a><p>body</p>',
				{baseUrl: 'https://example.com', size: 'm'},
			);
		} finally {
			globalThis.fetch = original;
		}
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

// Tests for the NETWORKED `distilly/fetch` entrypoint. EVERY network call here
// goes through a MOCK injected `fetch` — no real network is ever touched.
//
// Coverage:
//   - a matching Rule (github/mdn) rewrites the URL to cleaner SOURCE and that
//     source is fetched + used;
//   - a non-matching URL is fetched directly and run through the pure core,
//     honouring `size`/`truncated`;
//   - given NO `fetch`, the call refuses BEFORE any I/O (no global fetch);
//   - rules are pluggable (custom array; `[]` disables rewriting);
//   - ISOLATION: the pure `distilly` entrypoint imports none of the network code.

import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, expect, test, vi} from 'vitest';
import {urlToMarkdown, githubBlob, mdn, defineRule} from '../src/fetch.js';

/** A `fetch` mock that maps requested URL → a canned `Response`. */
function mockFetch(
	responder: (url: string) => {
		body: string;
		contentType?: string;
		status?: number;
	},
) {
	return vi.fn(async (input: RequestInfo | URL) => {
		const url =
			input instanceof URL
				? input.href
				: typeof input === 'string'
					? input
					: input.url;
		const {body, contentType = 'text/html', status = 200} = responder(url);
		return new Response(body, {
			status,
			headers: {'content-type': contentType},
		});
	}) as unknown as typeof globalThis.fetch & {mock: {calls: unknown[][]}};
}

describe('urlToMarkdown — no injected fetch', () => {
	test('refuses (throws) before any network access when fetch is omitted', async () => {
		await expect(
			// @ts-expect-error intentionally omitting the required `fetch`
			urlToMarkdown('https://example.com'),
		).rejects.toThrow(/requires an injected `fetch`/);
	});

	test('does not fall back to a global fetch', async () => {
		const globalSpy = vi.fn();
		const original = globalThis.fetch;
		// @ts-expect-error override for the duration of the test
		globalThis.fetch = globalSpy;
		try {
			await expect(
				// @ts-expect-error intentionally omitting the required `fetch`
				urlToMarkdown('https://example.com', {}),
			).rejects.toThrow();
		} finally {
			globalThis.fetch = original;
		}
		expect(globalSpy).not.toHaveBeenCalled();
	});
});

describe('urlToMarkdown — Rule rewrites to cleaner source', () => {
	test('github /blob/ URL is rewritten to raw.githubusercontent and that source is used', async () => {
		const fetch = mockFetch((url) => {
			if (url === 'https://raw.githubusercontent.com/wevm/viem/main/README.md')
				return {
					body: '# viem\n\nClean raw README.',
					contentType: 'text/markdown',
				};
			// The original github.com page must NEVER be fetched.
			return {body: '<html><body>github web chrome</body></html>'};
		});

		const {markdown} = await urlToMarkdown(
			'https://github.com/wevm/viem/blob/main/README.md',
			{fetch},
		);

		expect(markdown).toContain('# viem');
		expect(markdown).toContain('Clean raw README.');
		// Exactly one call, to the rewritten raw source.
		const calls = (fetch as unknown as {mock: {calls: [unknown][]}}).mock.calls;
		expect(calls).toHaveLength(1);
		expect(String(calls[0]![0] as URL | string)).toBe(
			'https://raw.githubusercontent.com/wevm/viem/main/README.md',
		);
	});

	test('mdn URL is rewritten to its mdn/content raw markdown source', async () => {
		const source = [
			'---',
			'title: Array.prototype.map()',
			'---',
			'',
			'The {{jsxref("Array")}} method **map()** works.',
			'',
			'{{Compat}}',
			'',
		].join('\n');
		const fetch = mockFetch((url) => {
			if (
				url ===
				'https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/javascript/reference/global_objects/array/map/index.md'
			)
				return {body: source, contentType: 'text/markdown'};
			return {body: '<html>mdn page</html>'};
		});

		const {markdown} = await urlToMarkdown(
			'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map',
			{fetch},
		);

		// The cleaner source was used; MDN macros were normalised/stripped.
		expect(markdown).toContain('works.');
		expect(markdown).toContain(
			'[`Array`](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)',
		);
		expect(markdown).not.toContain('{{Compat}}');
	});
});

describe('urlToMarkdown — non-matching URL', () => {
	test('is fetched directly and run through the pure core', async () => {
		const fetch = mockFetch(() => ({
			body: '<html><body><main><h1>Plain</h1><p>Body text.</p></main></body></html>',
		}));

		const {markdown} = await urlToMarkdown('https://example.com/page', {fetch});

		expect(markdown).toContain('# Plain');
		expect(markdown).toContain('Body text.');
		const calls = (fetch as unknown as {mock: {calls: [unknown][]}}).mock.calls;
		expect(String(calls[0]![0])).toBe('https://example.com/page');
	});

	test('honours the size budget / truncated flag', async () => {
		const long = `<main><p>${'x'.repeat(20_000)}</p></main>`;
		const fetch = mockFetch(() => ({
			body: `<html><body>${long}</body></html>`,
		}));

		const full = await urlToMarkdown('https://example.com/big', {fetch});
		expect(full.truncated).toBe(false);

		const small = await urlToMarkdown('https://example.com/big', {
			fetch,
			size: 's',
		});
		expect(small.truncated).toBe(true);
		expect([...small.markdown].length).toBeLessThanOrEqual(5_000);
	});
});

describe('urlToMarkdown — pluggable rules', () => {
	test('a caller-supplied rule array overrides the bundled set', async () => {
		const custom = defineRule({
			key: 'mySite',
			patterns: [new URLPattern({hostname: 'docs.mine.dev'})],
			rewrite(url) {
				const md = new URL(url.href);
				md.pathname = `${md.pathname}.md`;
				return md;
			},
		});
		const fetch = mockFetch((url) => {
			if (url === 'https://docs.mine.dev/guide.md')
				return {body: '# Guide', contentType: 'text/markdown'};
			return {body: '<html>page</html>'};
		});

		const {markdown} = await urlToMarkdown('https://docs.mine.dev/guide', {
			fetch,
			rules: [custom],
		});
		expect(markdown).toContain('# Guide');
	});

	test('passing rules: [] disables rewriting (direct fetch through the core)', async () => {
		const fetch = mockFetch(() => ({
			body: '<html><body><main><h1>Direct</h1></main></body></html>',
		}));
		const {markdown} = await urlToMarkdown(
			'https://github.com/wevm/viem/blob/main/README.md',
			{fetch, rules: []},
		);
		// No rewrite happened: the original URL was fetched.
		const calls = (fetch as unknown as {mock: {calls: [unknown][]}}).mock.calls;
		expect(String(calls[0]![0])).toBe(
			'https://github.com/wevm/viem/blob/main/README.md',
		);
		expect(markdown).toContain('# Direct');
	});
});

describe('rule rewrites (pure, no fetch)', () => {
	test('githubBlob rewrites markdown blobs only', () => {
		const md = githubBlob.rewrite!(
			new URL('https://github.com/o/r/blob/main/README.md'),
			new URLPattern({
				hostname: 'github.com',
				pathname: '/:owner/:repo/blob/:path+',
			}).exec('https://github.com/o/r/blob/main/README.md')!,
		);
		expect(md?.href).toBe(
			'https://raw.githubusercontent.com/o/r/main/README.md',
		);
	});

	test('githubBlob leaves non-markdown blobs alone', () => {
		const pattern = new URLPattern({
			hostname: 'github.com',
			pathname: '/:owner/:repo/blob/:path+',
		});
		const url = 'https://github.com/o/r/blob/main/src/index.ts';
		expect(
			githubBlob.rewrite!(new URL(url), pattern.exec(url)!),
		).toBeUndefined();
	});

	test('mdn rewrites to the localized mdn/content path', () => {
		const pattern = new URLPattern({
			hostname: 'developer.mozilla.org',
			pathname: '/:locale/docs/:path+',
		});
		const url = 'https://developer.mozilla.org/en-US/docs/Web/CSS/color';
		const out = mdn.rewrite!(new URL(url), pattern.exec(url)!);
		expect(out?.href).toBe(
			'https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/css/color/index.md',
		);
	});
});

describe('entrypoint isolation — pure `.` imports no network code', () => {
	// Static check: the built pure entrypoint and its transitive pure modules
	// must NOT pull in the network modules (`fetch`, `rule`, `rules`) nor any
	// `URLPattern`/`fetch(` usage. We assert against the SOURCE the `.` export
	// reaches (index + truncate + md/{fromHtml,profile,profiles}).
	const here = fileURLToPath(new URL('.', import.meta.url));
	// Strip line + block comments before scanning: we are asserting on CODE
	// isolation, not on whether a comment may NAME `fetch`/`URLPattern` while
	// explaining what was deliberately NOT vendored onto the pure path.
	const stripComments = (code: string) =>
		code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
	const src = (rel: string) =>
		stripComments(
			readFileSync(new URL(`../src/${rel}`, `file://${here}`), 'utf8'),
		);

	const pureModules = [
		'index.ts',
		'truncate.ts',
		'md/fromHtml.ts',
		'md/profile.ts',
		'md/profiles.ts',
	];

	test('no pure module imports the network entrypoint or rule modules', () => {
		for (const mod of pureModules) {
			const code = src(mod);
			expect(code, `${mod} must not import ./fetch`).not.toMatch(
				/from\s+['"]\.{1,2}\/fetch(\.js)?['"]/,
			);
			expect(code, `${mod} must not import the rule machinery`).not.toMatch(
				/from\s+['"]\.\/rule(s)?(\.js)?['"]/,
			);
		}
	});

	test('no pure module performs network I/O (no fetch / URLPattern)', () => {
		for (const mod of pureModules) {
			const code = src(mod);
			expect(code, `${mod} must not call fetch`).not.toMatch(/\bfetch\s*\(/);
			expect(code, `${mod} must not use URLPattern`).not.toMatch(/URLPattern/);
		}
	});
});

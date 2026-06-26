// distilly — distill HTML into clean, token-efficient markdown for agents.
//
// Placeholder surface. The real engine (vendored + decoupled from wevm/curl.md's
// src/md/: fromHtml + chunk + rules + profiles, with the network mod.ts and the
// type-only #db import removed) is built by the first task from the PRD.
//
// The intended public API (pinned by webveil's Extractor seam):
//   htmlToMarkdown(html, { baseUrl?, rules?, size? }): Promise<{ markdown, truncated }>

export type Size = 's' | 'm' | 'l' | 'f'; // ~5k / 10k / 25k / full chars

export interface HtmlToMarkdownOptions {
	baseUrl?: string;
	size?: Size;
}

export interface HtmlToMarkdownResult {
	markdown: string;
	truncated: boolean;
}

export async function htmlToMarkdown(
	_html: string,
	_options: HtmlToMarkdownOptions = {},
): Promise<HtmlToMarkdownResult> {
	throw new Error(
		'distilly: htmlToMarkdown not implemented yet (see work/prds/ready)',
	);
}

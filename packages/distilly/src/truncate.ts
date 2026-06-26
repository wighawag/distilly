// Code-point-safe char-budget truncation for the `size` presets.
//
// distilly's size presets (`s`/`m`/`l`/`f`) bound the markdown to a CHAR budget
// (~5k/10k/25k/full) so agents control context cost. The budget is counted in
// Unicode CODE POINTS, never UTF-16 code units, so truncation can never split a
// multi-byte code point (emoji / CJK). When the budget cuts content we trim the
// trailing whitespace the cut may have stranded; `truncated` reflects whether
// the budget actually removed content, independent of that cosmetic trim.

import type {Size} from './index.js';

/** Char (code-point) budget per size preset; `f` (full) is unbounded. */
export const SIZE_BUDGETS: Record<Size, number | undefined> = {
	s: 5_000,
	m: 10_000,
	l: 25_000,
	f: undefined,
};

export type TruncateResult = {text: string; truncated: boolean};

/**
 * Truncate `text` to at most `budget` Unicode code points. Returns the
 * (possibly trimmed) text and whether content was actually cut. A `budget` of
 * `undefined` (the `f` preset) returns the text unchanged and `truncated: false`.
 */
export function truncateToBudget(
	text: string,
	budget: number | undefined,
): TruncateResult {
	if (budget === undefined) return {text, truncated: false};

	// Iterate by code point (spread uses the string iterator, which yields whole
	// code points), so the slice boundary is always a valid code-point boundary.
	const codePoints = [...text];
	if (codePoints.length <= budget) return {text, truncated: false};

	const cut = codePoints.slice(0, budget).join('');
	// Trim trailing whitespace stranded by the cut so output never ends on a
	// dangling half-line; `truncated` already records that content was removed.
	return {text: cut.replace(/\s+$/u, ''), truncated: true};
}

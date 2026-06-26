import {it, describe, expect} from 'vitest';
import {htmlToMarkdown} from '../src/index.js';

describe('distilly', () => {
	it('exposes htmlToMarkdown (not yet implemented)', async () => {
		await expect(htmlToMarkdown('<p>hi</p>')).rejects.toThrow(
			/not implemented/,
		);
	});
});

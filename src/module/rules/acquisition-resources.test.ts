import { describe, expect, it } from 'vitest';
import WH40K from '../config.ts';
import { lineResourceRows } from './acquisition-resources.ts';

/**
 * The Resources panel rows come from the acquisition currencies in
 * `WH40K.currencies`, plus the shared throne-gelt baseline.
 */
const NONE = new Set<string>();

describe('lineResourceRows', () => {
    it('shows the throne-gelt baseline once, with the line currency', () => {
        expect(lineResourceRows('ow', WH40K.currencies, NONE).map((r) => r.field)).toEqual(['system.throneGelt', 'system.logisticsRating']);
    });

    it('falls back to the baseline alone for a line with no currency of its own', () => {
        expect(lineResourceRows('nonexistent', WH40K.currencies, NONE).map((r) => r.field)).toEqual(['system.throneGelt']);
    });

    it('skips wallets that already have an editor elsewhere on the sheet', () => {
        const elsewhere = new Set(['system.logisticsRating']);
        expect(lineResourceRows('ow', WH40K.currencies, elsewhere).map((r) => r.field)).toEqual(['system.throneGelt']);
    });
});

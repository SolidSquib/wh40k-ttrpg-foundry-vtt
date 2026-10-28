import { describe, expect, it } from 'vitest';
import { importModelOrSkip } from '../../testing/model-import.ts';

/** Narrow shape of the migrated cost block. */
interface CostBlock {
    logistics: number | null;
}

/** Narrow shape of a source bag handed to `_migrateData`. */
interface CostSource {
    cost?: unknown; // eslint-disable-line no-restricted-syntax -- boundary: stands in for untyped stored cost data of any shape
}

describe('PhysicalItemTemplate cost migration', () => {
    async function migrate(source: CostSource): Promise<CostBlock | undefined> {
        const mod = await importModelOrSkip(import('./physical-item-template.ts'));
        // eslint-disable-next-line @vitest/no-conditional-in-test -- guard: skip when the model can't load under happy-dom, not an assertion branch
        if (mod === undefined) return undefined;
        // eslint-disable-next-line no-restricted-syntax -- boundary: _migrateData takes the raw Foundry source bag
        mod.default._migrateData(source as Record<string, unknown>);
        return source.cost as CostBlock;
    }

    it('fills a missing cost with nulls', async () => {
        const cost = await migrate({});
        // eslint-disable-next-line @vitest/no-conditional-in-test -- guard: skipped when the model can't load
        if (cost === undefined) return;
        expect(cost).toEqual({ logistics: null });
    });

    it('collapses a legacy per-line block to the Only War logistics value and drops gelt', async () => {
        const cost = await migrate({ cost: { ow: { logistics: '3', homebrew: { throneGelt: '7' } }, dh2: { homebrew: { throneGelt: '9' } } } });
        // eslint-disable-next-line @vitest/no-conditional-in-test -- guard: skipped when the model can't load
        if (cost === undefined) return;
        expect(cost).toEqual({ logistics: 3 });
    });

    it('keeps an already-flat cost and nulls non-numeric values', async () => {
        const flat = await migrate({ cost: { logistics: 2, throneGelt: 40 } });
        // eslint-disable-next-line @vitest/no-conditional-in-test -- guard: skipped when the model can't load
        if (flat === undefined) return;
        expect(flat).toEqual({ logistics: 2 });
        const junk = await migrate({ cost: { logistics: 'nope' } });
        // eslint-disable-next-line @vitest/no-conditional-in-test -- guard: skipped when the model can't load
        if (junk === undefined) return;
        expect(junk).toEqual({ logistics: null });
    });
});

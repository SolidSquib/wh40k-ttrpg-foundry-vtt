import { describe, expect, it } from 'vitest';
import { flattenLegacyOwnedItems, flattenLegacySource, flattenLegacySystem } from './legacy-line-containers.ts';

// eslint-disable-next-line no-restricted-syntax -- boundary: stands in for an untyped Foundry `_migrateData` source payload
type SourceBag = Record<string, unknown>;

describe('flattenLegacySystem', () => {
    it('collapses a per-line container to its Only War branch', () => {
        const system = flattenLegacySystem({ notes: { dh2: 'dh', ow: 'ow' }, weight: { ow: 3 } });
        expect(system).toEqual({ notes: 'ow', weight: 3 });
    });

    it('falls back to the raw-provenance line, then the first authored line', () => {
        expect(flattenLegacySystem({ source: { rt: { provenance: 'raw' }, dh2: { provenance: 'homebrew' } }, notes: { dh2: 'hb', rt: 'raw' } })).toMatchObject({
            notes: 'raw',
        });
        expect(flattenLegacySystem({ notes: { bc: 'only', im: 'other' } })).toEqual({ notes: 'only' });
    });

    it('recurses into collapsed branches and nested plain objects', () => {
        const system = flattenLegacySystem({ grants: { ow: { aptitudes: { ow: ['Defence'] } } }, plain: { nested: { value: 1 } } });
        expect(system).toEqual({ grants: { aptitudes: ['Defence'] }, plain: { nested: { value: 1 } } });
    });

    it('resolves a book-variant container to its canonical book', () => {
        expect(flattenLegacySystem({ stats: { ow: { __books: { a: 1, b: 2 }, __canonical: 'b' } } })).toEqual({ stats: 2 });
    });

    it('recurses into system.cost but never collapses the per-line cost block', () => {
        const cost = { dh2: { influence: 1 }, ow: { logistics: 2 } };
        expect(flattenLegacySystem({ cost: structuredClone(cost) })).toEqual({ cost });
    });

    it('leaves flat data and non-line objects untouched', () => {
        const flat = { value: 1, list: [1, 2], attack: { type: 'melee' }, clip: { max: 0 } };
        expect(flattenLegacySystem(structuredClone(flat))).toEqual(flat);
    });
});

describe('flattenLegacySource / flattenLegacyOwnedItems', () => {
    it('flattens the nested system of a whole document or the bare system payload', () => {
        const doc: SourceBag = { system: { notes: { ow: 'x' } } };
        flattenLegacySource(doc);
        expect(doc).toEqual({ system: { notes: 'x' } });
        const bare: SourceBag = { notes: { ow: 'y' } };
        flattenLegacySource(bare);
        expect(bare).toEqual({ notes: 'y' });
    });

    it("flattens every embedded item's system on an actor source", () => {
        const actor: SourceBag = { items: [{ system: { notes: { ow: 'a' } } }, { system: { notes: { ow: 'b' } } }, { name: 'no-system' }] };
        flattenLegacyOwnedItems(actor);
        expect(actor['items']).toEqual([{ system: { notes: 'a' } }, { system: { notes: 'b' } }, { name: 'no-system' }]);
    });
});

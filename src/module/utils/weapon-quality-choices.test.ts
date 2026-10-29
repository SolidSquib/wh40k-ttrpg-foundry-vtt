import { describe, expect, it } from 'vitest';
import { toQualityChoices } from './weapon-quality-choices.ts';

describe('toQualityChoices', () => {
    it('lists the entries that carry an identifier, ordered by name', () => {
        const choices = toQualityChoices([
            { name: 'Tearing', system: { identifier: 'tearing', hasLevel: false } },
            { name: 'Blast', system: { identifier: 'blast', hasLevel: true } },
            { name: 'No identifier', system: { identifier: '' } },
            { name: 'No system' },
        ]);
        expect(choices).toEqual([
            { identifier: 'blast', name: 'Blast', hasLevel: true },
            { identifier: 'tearing', name: 'Tearing', hasLevel: false },
        ]);
    });

    it('treats a missing hasLevel as an unrated quality', () => {
        expect(toQualityChoices([{ name: 'Reliable', system: { identifier: 'reliable' } }])).toEqual([
            { identifier: 'reliable', name: 'Reliable', hasLevel: false },
        ]);
    });

    it('is empty for an empty index', () => {
        expect(toQualityChoices([])).toEqual([]);
    });
});

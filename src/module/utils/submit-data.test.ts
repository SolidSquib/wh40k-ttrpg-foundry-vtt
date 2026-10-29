import { describe, expect, it } from 'vitest';
import type { RawSource } from '../data/shared/raw-source.ts';
import { dropBlankStrings } from './submit-data.ts';

describe('dropBlankStrings', () => {
    it('keeps only the checked entries of a checkbox group', () => {
        const data: RawSource = { system: { weaponTypes: ['', 'las', '', ''] } };
        dropBlankStrings(data);
        expect(data).toEqual({ system: { weaponTypes: ['las'] } });
    });

    it('turns a group with nothing checked into an empty list', () => {
        const data: RawSource = { system: { weaponTypes: ['', ''] } };
        dropBlankStrings(data);
        expect(data).toEqual({ system: { weaponTypes: [] } });
    });

    it('leaves arrays of objects, plain strings and numbers alone', () => {
        const modes = [{ label: '' }];
        const data: RawSource = { name: '', weight: 0, system: { modes, nested: { tags: ['a', ''] } } };
        dropBlankStrings(data);
        expect(data).toEqual({ name: '', weight: 0, system: { modes: [{ label: '' }], nested: { tags: ['a'] } } });
    });
});

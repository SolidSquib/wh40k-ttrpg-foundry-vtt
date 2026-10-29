import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ADVERSARY_DEFINED_QUALITIES, HAS_PRIVATE_CONTENT } from '../testing/private-content.ts';
import {
    buildWeaponQualityPayloadIndex,
    getWeaponQualityHasLevel,
    getWeaponQualityMechanics,
    getWeaponQualityMechanicsForId,
} from './weapon-quality-payloads.ts';

/**
 * Drives the real boot index (`buildWeaponQualityPayloadIndex`) against the Only War
 * `ow-core-items-weapon-qualities` pack `_source` (core rulebook pp. 169–173) through a
 * typed `game.packs` stub, so the per-doc `mechanics` and `hasLevel` reads are exercised
 * end-to-end rather than through the seam the other suites use.
 */

interface PackDoc {
    system?: { identifier?: string; hasLevel?: boolean; mechanics?: object };
}
interface PackStub {
    metadata: { name: string };
    getDocuments: () => Promise<PackDoc[]>;
}

const PACK = 'ow-core-items-weapon-qualities';
const SYSTEM_ID = 'ow';

function loadDocs(): PackDoc[] {
    const srcDir = resolve(__dirname, `../../packs-private/only-war/${PACK}/_source`);
    if (!existsSync(srcDir)) return [];
    return readdirSync(srcDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(resolve(srcDir, f), 'utf8')) as PackDoc);
}

const packStubs: PackStub[] = [
    {
        metadata: { name: PACK },
        getDocuments: async () => {
            await Promise.resolve();
            return loadDocs();
        },
    },
];

beforeAll(async () => {
    vi.stubGlobal('game', { packs: { filter: (fn: (pack: PackStub) => boolean) => packStubs.filter(fn) } });
    await buildWeaponQualityPayloadIndex();
});
afterAll(() => {
    vi.unstubAllGlobals();
});

describe.skipIf(!HAS_PRIVATE_CONTENT)('weaponQuality index resolution (Only War)', () => {
    it('indexes the pack under the ow system id', () => {
        expect(getWeaponQualityMechanics('accurate', SYSTEM_ID)?.aimBonus).toBe(10);
    });

    it('reads hasLevel off each doc, so (X) qualities are levelled', () => {
        const levelled = ['blast', 'concussive', 'crippling', 'indirect', 'primitive', 'proven', 'smoke', 'snare', 'toxic'];
        const flat = ['accurate', 'tearing', 'flame', 'unwieldy'];
        expect(levelled.filter((id) => !getWeaponQualityHasLevel(id, SYSTEM_ID))).toEqual([]);
        expect(flat.filter((id) => getWeaponQualityHasLevel(id, SYSTEM_ID))).toEqual([]);
    });

    it('falls back across systems when no systemId is supplied', () => {
        expect(getWeaponQualityMechanics('accurate')?.aimBonus).toBe(10);
        expect(getWeaponQualityHasLevel('blast')).toBe(true);
    });

    it('resolves a levelled id (primitive-7) through its base identifier', () => {
        expect(getWeaponQualityMechanicsForId('primitive-7', SYSTEM_ID)?.dieOps).toHaveLength(1);
    });

    it('resolves the Tearing / Proven / Primitive dieOps', () => {
        expect(getWeaponQualityMechanics('tearing', SYSTEM_ID)?.dieOps).toEqual([
            { op: 'keepHighest', phase: 'preEvaluate', extraDice: 1, threshold: null, usesLevel: false, modifierKey: 'tearing' },
        ]);
        expect(getWeaponQualityMechanics('proven', SYSTEM_ID)?.dieOps).toEqual([
            { op: 'floor', phase: 'postEvaluate', extraDice: null, threshold: null, usesLevel: true, modifierKey: 'proven' },
        ]);
        expect(getWeaponQualityMechanics('primitive', SYSTEM_ID)?.dieOps).toEqual([
            { op: 'cap', phase: 'postEvaluate', extraDice: null, threshold: null, usesLevel: true, modifierKey: 'primitive' },
        ]);
    });

    it('defaults dieOps to an empty list for qualities that declare none', () => {
        expect(getWeaponQualityMechanics('accurate')?.dieOps).toEqual([]);
        expect(getWeaponQualityMechanics('scatter', SYSTEM_ID)?.dieOps).toEqual([]);
    });
});

describe.skipIf(!HAS_PRIVATE_CONTENT)('weaponQuality pack content (Only War)', () => {
    const docs = loadDocs();

    it('holds the 39 qualities of core rulebook pp. 169–173 plus those adversary entries define in footnotes (Threshing, Eyeburst), each with a unique identifier', () => {
        const identifiers = docs.map((d) => d.system?.identifier);
        expect(identifiers).toHaveLength(39 + ADVERSARY_DEFINED_QUALITIES);
        expect(new Set(identifiers).size).toBe(39 + ADVERSARY_DEFINED_QUALITIES);
    });
});

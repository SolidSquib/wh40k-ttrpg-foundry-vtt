/**
 * Wiring guard for the Only War origin-path builder: the builder's configuration, the packs
 * registered in system.json and the content in those packs must agree, at every stage of
 * Only War character creation.
 *
 * History: the builder shows nothing for a stage when it cannot find content for it, and it fails
 * silently — `OriginPathBuilder._loadOrigins()` resolves packs by `game.packs.get('wh40k-rpg.<name>')`
 * and skips a missing pack with a console.warn, and a stage whose items carry the wrong
 * `type` / `regiment.category` simply renders empty. Pack-name drift and item-metadata drift both hid
 * that way across the former per-line configs, with nothing linking config to packs to content.
 *
 * Only War character creation (core rulebook Chapters II–III) is, in order:
 *  1. Regiment — either a pre-built regiment (`regiment` items) or one built from options in the
 *     Regiment Creation categories: Home World, Commanding Officer, Regiment Type, Training Doctrine,
 *     Special Equipment Doctrine, Regimental Kit (and, in the supplements, Regimental Drawbacks);
 *  2. Speciality — one of the twelve core Specialities.
 *
 * The test reads pack names from system.json (the manifest Foundry loads) and content from `_source`
 * JSON. It does NOT require a live Foundry — the config is a plain object reached via
 * SystemConfigRegistry (see system-config-header-fields.test.ts for the same `game.i18n` stub pattern).
 */

import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readDeclaredPacks } from '../scripts/lib/pack-manifest.mjs';
import { SystemConfigRegistry } from '../src/module/config/game-systems/index.ts';
import { REGIMENT_CATEGORIES, REGIMENT_OPTION_CATEGORIES } from '../src/module/rules/ow-regiment-creation.ts';
import { HAS_PRIVATE_CONTENT } from '../src/module/testing/private-content.ts';
import { type OriginPackDoc, originDocsInPack } from './helpers/origin-pack-content.ts';

interface I18nStub {
    localize: (key: string) => string;
    format: (key: string) => string;
}
interface GameStub {
    i18n: I18nStub;
}
interface GlobalShim {
    game?: GameStub | undefined;
}
const G = globalThis as GlobalShim;
const ORIGINAL_GAME = G.game;

beforeAll(() => {
    G.game = {
        i18n: {
            localize: (key: string): string => key,
            format: (key: string): string => key,
        },
    };
});

afterAll(() => {
    G.game = ORIGINAL_GAME;
});

/**
 * Pack names registered in system.json. `game.packs.get('wh40k-rpg.<name>')`
 * resolves by exactly this `name` field, so it is the authoritative set the
 * builder's pack references must match.
 */
function registeredPackNames(): Set<string> {
    // Public src/system.json packs + the private content's fragment (scripts/lib/pack-manifest.mjs).
    return new Set(readDeclaredPacks(resolve(__dirname, '..')).packs.map((pack) => pack.name));
}

const PACK_NAMES = registeredPackNames();
const STEP_CONFIG = SystemConfigRegistry.get('ow').getOriginStepConfig();
const CONFIGURED_PACKS = [...STEP_CONFIG.packs, ...(STEP_CONFIG.equipmentPacks ?? [])];

/** Every document in the configured packs, with the pack it came from. */
const CONFIGURED_DOCS: Array<OriginPackDoc & { pack: string }> = STEP_CONFIG.packs.flatMap((pack) => originDocsInPack(pack).map((doc) => ({ ...doc, pack })));
const docsWhere = (predicate: (doc: OriginPackDoc) => boolean): OriginPackDoc[] => CONFIGURED_DOCS.filter(predicate);

describe.skipIf(!HAS_PRIVATE_CONTENT)('origin-path builder pack references resolve to registered compendiums', () => {
    it('system.json registers packs (guards against an empty/garbled manifest read)', () => {
        expect(PACK_NAMES.size).toBeGreaterThan(0);
    });

    it('every configured origin/equipment pack exists in system.json', () => {
        const missing = CONFIGURED_PACKS.filter((name) => !PACK_NAMES.has(name));
        expect(missing, `ow references unregistered packs: ${missing.join(', ')}`).toEqual([]);
    });

    // Reverse direction: a registered Only War origin pack the config omits is silently unselectable
    // ("no selections available"). Advanced Specialities are bought as Advances, not chosen at creation.
    it('offers every registered Only War origin pack except the Advanced Specialities', () => {
        const registered = [...PACK_NAMES].filter((name) => /^ow-.*-origins-/.test(name) && !name.endsWith('-advanced-specialities'));
        const configured = new Set(STEP_CONFIG.packs);
        const missing = registered.filter((name) => !configured.has(name));
        expect(missing, `origin packs not offered by the builder: ${missing.join(', ')}`).toEqual([]);
    });
});

describe.skipIf(!HAS_PRIVATE_CONTENT)('Only War character creation stages resolve to compendium content', () => {
    it('Regiment step: the core steps are Regiment then Speciality', () => {
        expect(STEP_CONFIG.coreSteps.map((core) => core.step)).toEqual(['regiment', 'speciality']);
    });

    it('Regiment step: pre-built regiments exist and each carries its preset', () => {
        const regiments = docsWhere((doc) => doc.type === 'regiment');
        expect(regiments.length).toBeGreaterThan(0);
        expect(regiments.filter((doc) => doc.system.step !== 'regiment' || doc.system.regimentPreset === undefined).map((doc) => doc.name)).toEqual([]);
    });

    // The budget categories the Regiment Creation builder renders as rows; every one must offer options,
    // otherwise that row is empty and a regiment cannot be built from scratch.
    it.each(REGIMENT_CATEGORIES)('Regiment step: the %s category has options to choose from', (category) => {
        const options = docsWhere((doc) => doc.type === 'regimentOption' && doc.system.regiment?.category === category);
        expect(options.length).toBeGreaterThan(0);
    });

    it('Regiment step: regimental kit items are offered from the Standard Kit allowance', () => {
        expect(docsWhere((doc) => doc.type === 'regimentOption' && doc.system.regiment?.category === 'kitItem').length).toBeGreaterThan(0);
    });

    it('core rulebook options cover every non-drawback category (Regimental Drawbacks come from the supplements)', () => {
        const core = (category: string): number =>
            CONFIGURED_DOCS.filter((doc) => doc.pack.startsWith('ow-core-') && doc.system.regiment?.category === category).length;
        const empty = REGIMENT_CATEGORIES.filter((c) => c !== 'drawback' && core(c) === 0);
        expect(empty).toEqual([]);
        expect(core('drawback')).toBe(0);
    });

    it('Speciality step: the twelve core Specialities are offered', () => {
        const specialities = CONFIGURED_DOCS.filter((doc) => doc.pack === 'ow-core-origins-specialities');
        expect(specialities).toHaveLength(12);
        expect(specialities.filter((doc) => doc.type !== 'speciality' || doc.system.step !== 'speciality').map((doc) => doc.name)).toEqual([]);
    });

    it('Sanctioned Psyker (the psyker unlock) is among the Specialities', () => {
        expect(docsWhere((doc) => doc.type === 'speciality').map((doc) => doc.name)).toContain('Sanctioned Psyker');
    });

    it('every option is typed so the builder files it under the right stage', () => {
        const misfiled = CONFIGURED_DOCS.filter((doc) => {
            if (doc.type === 'regiment') return doc.system.step !== 'regiment';
            if (doc.type === 'speciality') return doc.system.step !== 'speciality' && doc.system.step !== 'advancedSpeciality';
            if (doc.type !== 'regimentOption') return true;
            return !(REGIMENT_OPTION_CATEGORIES as ReadonlyArray<string>).includes(doc.system.regiment?.category ?? '');
        });
        expect(misfiled.map((doc) => `${doc.pack}/${doc.name} (${doc.type}/${doc.system.step})`)).toEqual([]);
    });
});

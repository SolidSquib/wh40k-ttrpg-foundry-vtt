/**
 * Fixture-stability tests for the unified sheet-context factories.
 *
 * The factories in `stories/mocks/sheet-contexts.ts` are imported by both the
 * Storybook stories and the runtime composition tests. A drift here means
 * stories and tests describe different fixtures — exactly the failure these
 * factories are meant to prevent.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localizeKey } from '../stories/mocks/lang-localize';
import { mockNpcSheetContext, mockPlayerSheetContext, mockVehicleSheetContext } from '../stories/mocks/sheet-contexts';

interface GameI18nStub {
    localize: (k: string) => string;
    format: (k: string) => string;
}
interface GameStub {
    i18n: GameI18nStub;
}
interface GlobalShim {
    game?: GameStub | undefined;
}
const G = globalThis as GlobalShim;
const ORIGINAL_GAME = G.game;

beforeAll(() => {
    // Some configs call game.i18n.localize; the factory installs a stub if absent,
    // but tests that run in isolation install the same resolver. Labels resolve
    // through the shared {@link localizeKey} (flattens en.json once) instead of a
    // hand-copied key→string map, so a langpack reword can't pass against a stale
    // string (#364).
    G.game = {
        i18n: { localize: (k: string): string => localizeKey(k), format: (k: string): string => localizeKey(k) },
    };
});

afterAll(() => {
    G.game = ORIGINAL_GAME;
});

describe('mockPlayerSheetContext', () => {
    it('produces a fully-populated Only War context by default', () => {
        const ctx = mockPlayerSheetContext();
        expect(ctx.actor).toBeTruthy();
        expect(ctx.system).toBeTruthy();
        expect(ctx.source).toBe(ctx.system);
        expect(ctx.editable).toBe(true);
        expect(ctx.inEditMode).toBe(false);
        expect(ctx.isGM).toBe(true);
        expect(ctx.isNPC).toBe(false);
        expect(ctx.tabs.length).toBeGreaterThan(0);
        expect(ctx.tab.id).toBe('biography');
        expect(ctx.originPathSteps).toHaveLength(3);
        expect(ctx.originPathComplete).toBe(true);
        expect(ctx.biography.source.notes).toContain('Background notes');
        expect(ctx.journalEntries).toHaveLength(1);
    });

    it('uses SystemConfigRegistry.getHeaderFields for header rows', () => {
        const ctx = mockPlayerSheetContext();
        const names = ctx.headerFields.map((f) => f.name);
        expect(names).toEqual(['system.originPath.homeWorld', 'system.originPath.regiment', 'system.originPath.speciality', 'system.originPath.motivation']);
        // Player name is rendered on the identity row, not in headerFields.
        expect(names).not.toContain('system.bio.playerName');
    });

    it('passes the homeWorld value through to its sidebar row', () => {
        const ctx = mockPlayerSheetContext({ actorOverrides: { system: { originPath: { homeWorld: 'Cadia' } } } });
        const hw = ctx.headerFields.find((f) => f.name === 'system.originPath.homeWorld');
        expect(hw?.value).toBe('Cadia');
    });

    it('contextOverrides.headerFields wins over the registry default', () => {
        const custom = [{ label: 'X', name: 'system.x', type: 'text' as const, value: 'Y' }];
        const ctx = mockPlayerSheetContext({ contextOverrides: { headerFields: custom } });
        expect(ctx.headerFields).toBe(custom);
    });

    it('actorOverrides flow through to actor.system without clobbering bio defaults', () => {
        const ctx = mockPlayerSheetContext({ actorOverrides: { system: { bio: { age: '99' } } } });
        const bio = ctx.actor.system.bio;
        expect(bio.age).toBe('99');
        // playerName default survives because mergeActorInput preserves un-overridden bio keys
        expect(bio.playerName).toBe('Player One');
    });

    it('emits non-empty origin-step IDs (sourced via randomId)', () => {
        const ctx = mockPlayerSheetContext();
        const stepIds = ctx.originPathSteps.map((s) => s.item?._id ?? '');
        expect(stepIds.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
        // All three IDs are unique even within a single fixture build.
        expect(new Set(stepIds).size).toBe(stepIds.length);
    });

    it('actor.type is namespaced by system after withSystem is applied', () => {
        expect(mockPlayerSheetContext().actor.type).toBe('ow-character');
    });
});

describe('mockNpcSheetContext', () => {
    it('builds an NPC context with horde, transactionProfile, and tags', () => {
        const ctx = mockNpcSheetContext();
        expect(ctx.isNPC).toBe(true);
        expect(ctx.actor.type).toBe('ow-npc');
        expect(ctx.system.threatLevel).toBe(7);
        expect(ctx.headerFields.find((f) => f.name === 'system.threatLevel')).toBeTruthy();
        expect(ctx.horde).toBeTruthy();
        expect(ctx.transactionProfile).toBeTruthy();
        expect(ctx.tags).toContain('chaos');
        expect(ctx.actor.inCombat).toBe(false);
    });

    it('contextOverrides win over defaults', () => {
        const ctx = mockNpcSheetContext({ contextOverrides: { isGM: false, journalEntries: [] } });
        expect(ctx.isGM).toBe(false);
        expect(ctx.journalEntries).toEqual([]);
    });
});

describe('mockVehicleSheetContext', () => {
    it('builds a minimal vehicle context with type-namespaced actor', () => {
        const ctx = mockVehicleSheetContext();
        expect(ctx.actor.type).toBe('ow-vehicle');
        expect(ctx.tabs.length).toBeGreaterThan(0);
        expect(ctx.headerFields).toEqual([]);
        expect(ctx.originPathComplete).toBe(false);
    });
});

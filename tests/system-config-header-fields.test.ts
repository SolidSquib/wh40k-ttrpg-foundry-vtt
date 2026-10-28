/**
 * Frozen-shape regression tests for `OWSystemConfig.getHeaderFields(actor)`.
 *
 * Each per-system config returns the field list that populates the player sheet sidebar
 * identity panel. The Foundry form parser writes back to the actor through the field's
 * `name=` path, so any rename of these strings silently breaks character save/load —
 * these tests assert byte-identical name paths and shape.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SystemConfigRegistry } from '../src/module/config/game-systems/index.ts';
import { ALL_SYSTEM_IDS, type GameSystemId, type SidebarHeaderField } from '../src/module/config/game-systems/types.ts';
import type { WH40KBaseActor } from '../src/module/documents/base-actor.ts';
import { localizeKey } from '../stories/mocks/lang-localize.ts';
import { asBaseActor } from './lib/actor-stub.ts';

interface ActorLike {
    system?: {
        bio?: Record<string, string | number>;
        originPath?: Record<string, string | number>;
        rank?: string | number;
    };
}

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

/**
 * Header labels are now localized via makeOriginField (#298 item 3); resolve the
 * header-label keys to their English so these tests keep asserting the displayed
 * label (and confirm each key resolves). Resolution goes through the shared
 * {@link localizeKey} (which flattens en.json once) rather than a hand-copied
 * key→string map, so a langpack reword can't pass these tests against a stale
 * string (#364). The `name=` path assertions below are the real save/load
 * contract and are unaffected by labels.
 */
beforeAll(() => {
    G.game = {
        i18n: {
            localize: (key: string): string => localizeKey(key),
            format: (key: string): string => localizeKey(key),
        },
    };
});

afterAll(() => {
    G.game = ORIGINAL_GAME;
});

function makeActor(overrides: ActorLike = {}): WH40KBaseActor {
    return asBaseActor({
        system: {
            bio: { playerName: 'Mona' },
            originPath: {
                homeWorld: 'Hive World',
                background: 'Imperial Guard',
                role: 'Warrior',
                career: 'Adept',
                motivation: 'Duty',
                trialsAndTravails: 'Ambushed',
                divination: 'Trust the Emperor.',
            },
            rank: 3,
            ...overrides.system,
        },
    });
}

function names(fields: SidebarHeaderField[]): string[] {
    return fields.map((f) => f.name);
}

describe('OWSystemConfig.getHeaderFields — name-path stability per system', () => {
    // NOTE: As of commit 6b6f164 ("restore origin-path bubbles + show player name in identity row"),
    // the Player row was dropped from getHeaderFields() — the player name is rendered as a paired
    // input on the identity row instead. These tests assert the post-removal field order.

    it('ow returns HomeWorld + Regiment(background) + Speciality(role) + Demeanour(motivation)', () => {
        const fields = SystemConfigRegistry.get('ow').getHeaderFields(makeActor());
        expect(names(fields)).toEqual([
            'system.originPath.homeWorld',
            'system.originPath.background',
            'system.originPath.role',
            'system.originPath.motivation',
        ]);
        expect(fields.find((f) => f.label === 'Regiment')?.name).toBe('system.originPath.background');
        expect(fields.find((f) => f.label === 'Speciality')?.name).toBe('system.originPath.role');
        expect(fields.find((f) => f.label === 'Demeanour')?.name).toBe('system.originPath.motivation');
    });

    it('the player name field is no longer part of getHeaderFields (rendered separately on the identity row)', () => {
        const ids: readonly GameSystemId[] = ALL_SYSTEM_IDS;
        const actor = makeActor({ system: { bio: {} } });
        for (const id of ids) {
            const fields = SystemConfigRegistry.get(id).getHeaderFields(actor);
            expect(fields.every((f) => f.name !== 'system.bio.playerName')).toBe(true);
        }
    });

    it('values flow through from the actor — homeWorld value populates the matching row', () => {
        const ids: readonly GameSystemId[] = ALL_SYSTEM_IDS;
        const actor = makeActor({
            system: {
                bio: { playerName: 'Mona' },
                originPath: { homeWorld: 'Hive World' },
            },
        });
        for (const id of ids) {
            const fields = SystemConfigRegistry.get(id).getHeaderFields(actor);
            const hw = fields.find((f) => f.name === 'system.originPath.homeWorld');
            expect(hw?.value, `system ${id}`).toBe('Hive World');
        }
    });
});

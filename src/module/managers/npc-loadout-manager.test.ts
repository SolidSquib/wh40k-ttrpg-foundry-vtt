import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { NpcLoadout } from '../rules/npc-loadout.ts';
import { applyNpcLoadout } from './npc-loadout-manager.ts';

interface Source {
    _id: string;
    type: string;
    flags: Record<string, object>;
    system: { state: object; special?: string[] };
}

const notifications = { warn: vi.fn(), info: vi.fn() };
type Npc = Parameters<typeof applyNpcLoadout>[0];

const item = (uuid: string, extra: { quantity?: number; craftsmanship?: string; special?: string[] } = {}): NpcLoadout['items'][number] => ({
    uuid,
    quantity: 1,
    craftsmanship: '',
    special: [],
    ...extra,
});
const LOADOUTS: NpcLoadout[] = [
    { id: 'slugga', name: 'Slugga Boy', items: [item('Compendium.x.Item.slugga')] },
    {
        id: 'shoota',
        name: 'Shoota Boy',
        items: [item('Compendium.x.Item.shoota', { quantity: 2, craftsmanship: 'good', special: ['twin-linked'] }), item('Compendium.x.Item.pack')],
    },
];

const sources: Record<string, Source> = {
    'Compendium.x.Item.shoota': { _id: 'src1', type: 'weapon', flags: {}, system: { state: {} } },
    'Compendium.x.Item.pack': { _id: 'src2', type: 'gear', flags: {}, system: { state: {} } },
};

function stubActor(
    isOwner: boolean,
    flags: Record<string, string | null>,
    own: { loadouts?: boolean; source?: string; sources?: Record<string, string> } = {},
): { actor: Npc; calls: { update: Mock; remove: Mock; create: Mock } } {
    const calls = { update: vi.fn(), remove: vi.fn(), create: vi.fn() };
    const actor = {
        name: 'Ork Boy',
        isOwner,
        _stats: { compendiumSource: own.source ?? null },
        system: { activeLoadout: 'slugga', loadouts: own.loadouts === false ? [] : LOADOUTS },
        items: {
            contents: Object.entries(flags).map(([id, loadout]) => ({ id, getFlag: () => loadout, _stats: { compendiumSource: own.sources?.[id] ?? null } })),
        },
        update: calls.update,
        deleteEmbeddedDocuments: calls.remove,
        createEmbeddedDocuments: calls.create,
    };
    // eslint-disable-next-line no-restricted-syntax -- boundary: a Foundry Actor document cannot be constructed outside a running world; only the members applyNpcLoadout reads are stubbed
    return { actor: actor as unknown as Npc, calls };
}

function stubFoundry(): void {
    vi.stubGlobal('ui', { notifications });
    vi.stubGlobal('game', { i18n: { format: (key: string) => key, localize: (key: string) => key } });
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe('applyNpcLoadout', () => {
    it("swaps the previous loadout's items for the chosen one, equipped weapons only, leaving fixed gear alone", async () => {
        stubFoundry();
        vi.stubGlobal('fromUuid', async (uuid: string) => Promise.resolve({ toObject: () => structuredClone(sources[uuid]) }));
        const { actor, calls } = stubActor(true, { old: 'slugga', fixed: null });

        expect(await applyNpcLoadout(actor, 'shoota')).toBe(true);

        expect(calls.update).toHaveBeenCalledWith({ 'system.activeLoadout': 'shoota' });
        expect(calls.remove).toHaveBeenCalledWith('Item', ['old']);
        const created = calls.create.mock.calls[0]?.[1] as Array<Source & { system: { state: { equipped?: boolean } } }>;
        expect(created.map((c) => c._id)).toEqual([undefined, undefined]);
        expect(created.map((c) => c.flags['wh40k-rpg'])).toEqual([{ loadout: 'shoota' }, { loadout: 'shoota' }]);
        expect(created.map((c) => c.system.state.equipped)).toEqual([true, undefined]);
        // what a loadout says of its item (how many, at what craftsmanship, with which extra qualities) survives the swap
        expect(created.map((c) => (c.system as { quantity?: number }).quantity)).toEqual([2, undefined]);
        expect(created.map((c) => (c.system as { craftsmanship?: string }).craftsmanship)).toEqual(['good', undefined]);
        expect(created.map((c) => c.system.special)).toEqual([['twin-linked'], undefined]);
    });

    it('does nothing and warns when the user does not own the NPC', async () => {
        stubFoundry();
        const { actor, calls } = stubActor(false, {});
        expect(await applyNpcLoadout(actor, 'shoota')).toBe(false);
        expect(calls.update).not.toHaveBeenCalled();
        expect(notifications.warn).toHaveBeenCalled();
    });

    it('warns about an item that can no longer be found and still applies the rest', async () => {
        stubFoundry();
        vi.stubGlobal('fromUuid', async (uuid: string) => Promise.resolve(uuid.endsWith('pack') ? null : { toObject: () => structuredClone(sources[uuid]) }));
        const { actor, calls } = stubActor(true, {});
        await applyNpcLoadout(actor, 'shoota');
        expect(notifications.warn).toHaveBeenCalledTimes(1);
        expect(calls.create.mock.calls[0]?.[1]).toHaveLength(1);
    });

    it('lets an NPC made before it had loadouts inherit them from its compendium entry, replacing the copy it carries', async () => {
        stubFoundry();
        vi.stubGlobal('fromUuid', async (uuid: string) =>
            Promise.resolve(uuid === 'Compendium.x.Actor.boy' ? { system: { loadouts: LOADOUTS } } : { toObject: () => structuredClone(sources[uuid]) }),
        );
        const { actor, calls } = stubActor(
            true,
            { stale: null, fixed: null },
            { loadouts: false, source: 'Compendium.x.Actor.boy', sources: { stale: 'Compendium.x.Item.slugga' } },
        );

        expect(await applyNpcLoadout(actor, 'shoota')).toBe(true);

        expect(calls.remove).toHaveBeenCalledWith('Item', ['stale']);
        expect(calls.update).toHaveBeenCalledWith({ 'system.activeLoadout': 'shoota', 'system.loadouts': LOADOUTS });
    });
});

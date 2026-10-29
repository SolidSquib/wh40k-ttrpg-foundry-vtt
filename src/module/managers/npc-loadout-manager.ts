/**
 * NPC Loadout Manager: makes one of an NPC's weapon loadouts the active one.
 *
 * The planning is the pure `rules/npc-loadout.ts`; this bridges it to Foundry's compendium and embedded-document APIs.
 * Choosing a loadout removes the items the previous one added (they carry its id in a flag) and adds the chosen
 * loadout's items from the compendium, equipped, marked with the new id.
 */

import { SYSTEM_ID } from '../constants.ts';
import type { WH40KNPC } from '../documents/npc.ts';
import { t } from '../i18n/t.ts';
import { LOADOUT_FLAG, type LoadoutItem, loadoutOfOwnedItem, type NpcLoadout, planLoadoutSwap } from '../rules/npc-loadout.ts';

/** An item's source data, narrowed to the fields a loadout writes. */
interface ItemSource {
    _id?: string | undefined;
    type: string;
    flags?: Record<string, object> | undefined;
    _stats?: object | undefined;
    system?:
        | { state?: object | undefined; quantity?: number | undefined; craftsmanship?: string | undefined; special?: Iterable<string> | undefined }
        | undefined;
}

/** Item types a loadout puts into use immediately. */
const EQUIPPED_ON_ARRIVAL = new Set(['weapon', 'armour']);

/** The loadout item as data for a new embedded item, marked as added by `loadoutId`; `null` when it cannot be read. */
async function itemDataFor({ uuid, quantity, craftsmanship, special }: LoadoutItem, loadoutId: string): Promise<object | null> {
    const doc = await fromUuid(uuid);
    // eslint-disable-next-line no-restricted-syntax -- boundary: fromUuid returns a Document | InvalidUuid | null union; toObject is feature-detected before use
    const toObject = (doc as { toObject?: () => ItemSource } | null)?.toObject;
    if (typeof toObject !== 'function') return null;
    // eslint-disable-next-line no-restricted-syntax -- boundary: fromUuid returned a Document, so toObject() is called on it as a method
    const { _id: _discard, ...source } = (doc as unknown as { toObject: () => ItemSource }).toObject();
    void _discard;
    return {
        ...source,
        _stats: { ...source._stats, compendiumSource: uuid },
        flags: { ...source.flags, [SYSTEM_ID]: { ...source.flags?.[SYSTEM_ID], [LOADOUT_FLAG]: loadoutId } },
        system: {
            ...source.system,
            ...(quantity > 1 ? { quantity } : {}),
            ...(craftsmanship === '' ? {} : { craftsmanship }),
            ...(special.length === 0 ? {} : { special: [...new Set([...(source.system?.special ?? []), ...special])] }),
            ...(EQUIPPED_ON_ARRIVAL.has(source.type) ? { state: { ...source.system?.state, equipped: true } } : {}),
        },
    };
}

/** What an NPC document's system data holds that loadouts read. */
interface LoadoutSource {
    system?: { loadouts?: readonly NpcLoadout[] } | undefined;
}

/**
 * The loadouts an NPC offers: its own, or, for an NPC created before its compendium entry had any, the entry it was
 * copied from. Lets tokens and actors already in a world use loadouts without being re-imported.
 */
export async function loadoutsOf(actor: WH40KNPC): Promise<readonly NpcLoadout[]> {
    if (actor.system.loadouts.length > 0) return actor.system.loadouts;
    const source = actor._stats.compendiumSource;
    if (source === null) return [];
    // eslint-disable-next-line no-restricted-syntax -- boundary: fromUuid returns a Document | InvalidUuid | null union; only its system loadouts are read
    const doc = (await fromUuid(source)) as LoadoutSource | null;
    return doc?.system?.loadouts?.map(({ id, name, items }) => ({ id, name, items: items.map((item) => ({ ...item, special: [...item.special] })) })) ?? [];
}

/** Item name to the id of the loadout that lists it, for copies that kept no compendium source. */
async function loadoutNames(loadouts: readonly NpcLoadout[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    for (const loadout of loadouts) {
        for (const { uuid } of loadout.items) {
            // eslint-disable-next-line no-await-in-loop -- a loadout has a handful of items, read one after another
            const doc = await fromUuid(uuid);
            // eslint-disable-next-line no-restricted-syntax -- boundary: fromUuid returns a Document | InvalidUuid | null union; only a string name is read
            const name = (doc as { name?: unknown } | null)?.name;
            if (typeof name === 'string') names.set(name, loadout.id);
        }
    }
    return names;
}

/**
 * Make `loadoutId` the NPC's active loadout. Returns whether anything was applied; warns the user when they do not own
 * the actor or a loadout item can no longer be found.
 */
export async function applyNpcLoadout(actor: WH40KNPC, loadoutId: string): Promise<boolean> {
    if (!actor.isOwner) {
        ui.notifications.warn(t('WH40K.InventoryGenerator.PermissionDenied'));
        return false;
    }
    const loadouts = await loadoutsOf(actor);
    const byName = await loadoutNames(loadouts);
    const owned = actor.items.contents
        .filter((item): item is typeof item & { id: string } => item.id !== null)
        .map((item) => {
            const flag = item.getFlag(SYSTEM_ID, LOADOUT_FLAG);
            return {
                id: item.id,
                loadout: loadoutOfOwnedItem(
                    { flag: typeof flag === 'string' ? flag : null, compendiumSource: item._stats.compendiumSource, name: item.name },
                    loadouts,
                    byName,
                ),
            };
        });
    const swap = planLoadoutSwap(loadouts, loadoutId, owned);
    if (swap === undefined) return false;

    const created: object[] = [];
    for (const item of swap.add) {
        // eslint-disable-next-line no-await-in-loop -- a loadout has a handful of items, read one after another
        const data = await itemDataFor(item, swap.loadout.id);
        if (data === null) ui.notifications.warn(t('WH40K.NPC.Loadouts.ItemMissing', { loadout: swap.loadout.name, uuid: item.uuid }));
        else created.push(data);
    }

    // an NPC that only inherited its loadouts keeps them from now on
    await actor.update(
        actor.system.loadouts.length > 0
            ? { 'system.activeLoadout': swap.loadout.id }
            : {
                  'system.activeLoadout': swap.loadout.id,
                  'system.loadouts': loadouts.map((l) => ({ ...l, items: l.items.map((item) => ({ ...item, special: [...item.special] })) })),
              },
    );
    if (swap.remove.length > 0) await actor.deleteEmbeddedDocuments('Item', swap.remove);
    if (created.length > 0) {
        // eslint-disable-next-line no-restricted-syntax -- boundary: createEmbeddedDocuments item-data param is not statically typed for item source read back from toObject()
        await actor.createEmbeddedDocuments('Item', created as unknown as Parameters<typeof actor.createEmbeddedDocuments<'Item'>>[1]);
    }
    ui.notifications.info(t('WH40K.NPC.Loadouts.Applied', { loadout: swap.loadout.name, npc: actor.name }));
    return true;
}

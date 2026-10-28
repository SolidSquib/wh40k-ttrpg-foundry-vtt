/**
 * @file Only War — apply a committed regiment to an actor.
 *
 * Each option the regiment dialog commits (Home World, Commanding Officer,
 * Regiment Type, Doctrines, Drawbacks) is an `originPath` compendium document.
 * Committing copies each onto the actor as an owned `originPath` item carrying
 * the player's choice picks, so the existing origin pipeline derives its
 * characteristic modifiers, skills, aptitudes and wounds. Talents it grants are
 * materialised as owned talent items, as the origin-path builder does.
 *
 * Re-committing replaces the previous regiment: everything this module created
 * is flagged and removed first.
 */

import { cloneGrantedItemData } from '../applications/character-creation/grant-materialize.ts';
import OriginPathData from '../data/item/origin-path.ts';
import type { WH40KBaseActor } from '../documents/base-actor.ts';
import type { RegimentCatalogEntry } from '../rules/ow-regiment-catalog.ts';
import { aggregateRegimentGrants } from '../rules/ow-regiment-creation.ts';
import { kitGearPlans, resolveKit } from '../rules/ow-regiment-kit.ts';
import { encodePicks, isRegimentPreset, type RegimentPresetData, type RegimentState, selectedOptionIds, stateFromPreset } from '../rules/ow-regiment-preset.ts';
import { dedupeTalentPlans, dedupeTraitPlans, talentPlansFor, traitPlansFor } from '../rules/ow-regiment-talents.ts';
import { forcedReplacement } from '../utils/forced-replacement.ts';
import { loadRegimentCatalog } from '../utils/regiment-catalog.ts';

const FLAG_SCOPE = 'wh40k-rpg';

/** Marks an owned `originPath` copy of a regiment option. */
const OPTION_FLAG = 'regimentOption';
/** Marks a talent granted by a regiment option. */
const GRANT_FLAG = 'regimentGranted';
/** Marks an owned preset item the Regiment Builder created (its regiment is already applied). */
const PRESET_APPLIED_FLAG = 'regimentPresetApplied';
/** Marks an inventory item the regiment's Standard Kit issued, so a re-commit replaces rather than stacks it. */
const KIT_GEAR_FLAG = 'regimentKitGear';
/** The squad Logistics Rating bonus last applied by a regiment commit, kept so a re-commit swaps rather than stacks. */
const LOGISTICS_FLAG = 'regimentLogisticsApplied';

/** Flags this module and the grant pipeline stamp on the items it creates. */
interface OwnedItemFlags {
    sourceId?: string;
    originPathGranted?: boolean;
    regimentOption?: boolean;
    regimentGranted?: boolean;
    regimentPresetApplied?: boolean;
    regimentKitGear?: boolean;
}

/** Embedded-item create payload: a cloned compendium document with extra flags stamped on. */
interface OwnedItemData {
    name?: string;
    type?: string;
    system?: { specialization?: string; quantity?: number; level?: number; selectedChoices?: Record<string, string[]> };
    flags?: Record<string, OwnedItemFlags | undefined>;
}

type CreateItemData = Parameters<WH40KBaseActor['createEmbeddedDocuments']>[1];

/**
 * Replace the actor's regiment with `optionIds`. `choices` maps an option id to
 * the picks (choice key → chosen option ids) the player made for it.
 */
export async function applyRegimentToActor(
    actor: WH40KBaseActor,
    optionIds: ReadonlyArray<string>,
    choices: Readonly<Record<string, Record<string, string[]>>>,
): Promise<void> {
    const stale = actor.items
        .filter((item) => item.getFlag(FLAG_SCOPE, OPTION_FLAG) === true || item.getFlag(FLAG_SCOPE, GRANT_FLAG) === true)
        .map((item) => item.id);
    if (stale.length > 0) await actor.deleteEmbeddedDocuments('Item', stale);

    const optionData: OwnedItemData[] = [];
    for (const uuid of optionIds) {
        // eslint-disable-next-line no-await-in-loop -- sequential: each option resolves to its own compendium document before it is cloned
        const source = await fromUuid(uuid);
        if (!source) continue;
        const cloned = cloneGrantedItemData(source, { sourceId: uuid });
        optionData.push({
            ...cloned,
            system: { ...cloned.system, selectedChoices: new Map(Object.entries(choices)).get(uuid) ?? {} },
            flags: { ...cloned.flags, [FLAG_SCOPE]: { regimentOption: true } },
        });
    }
    if (optionData.length === 0) return;

    // eslint-disable-next-line no-restricted-syntax -- boundary: createEmbeddedDocuments takes Foundry's generated create-data union; OwnedItemData is a cloned compendium payload
    const created = await actor.createEmbeddedDocuments('Item', optionData as CreateItemData);

    const plans = dedupeTalentPlans(created.flatMap((item) => (item.system instanceof OriginPathData ? talentPlansFor(item.system) : [])));
    const talents: OwnedItemData[] = [];
    for (const plan of plans) {
        // eslint-disable-next-line no-await-in-loop -- sequential: each talent resolves to its own compendium document before it is cloned
        const talent = await fromUuid(plan.uuid);
        if (!talent) continue;
        const cloned = cloneGrantedItemData(talent, { sourceId: plan.uuid, originPathGranted: true, specialization: plan.specialization });
        talents.push({
            ...cloned,
            flags: { ...cloned.flags, [FLAG_SCOPE]: { ...cloned.flags?.[FLAG_SCOPE], originPathGranted: true, regimentGranted: true } },
        });
    }

    const traitPlans = dedupeTraitPlans(created.flatMap((item) => (item.system instanceof OriginPathData ? traitPlansFor(item.system) : [])));
    const traits: OwnedItemData[] = [];
    for (const plan of traitPlans) {
        // eslint-disable-next-line no-await-in-loop -- sequential: each trait resolves to its own compendium document before it is cloned
        const trait = await fromUuid(plan.uuid);
        if (!trait) continue;
        const cloned = cloneGrantedItemData(trait, { sourceId: plan.uuid, originPathGranted: true });
        traits.push({
            ...cloned,
            name: plan.name,
            ...(plan.level === null ? {} : { system: { ...cloned.system, level: plan.level } }),
            flags: { ...cloned.flags, [FLAG_SCOPE]: { ...cloned.flags?.[FLAG_SCOPE], originPathGranted: true, regimentGranted: true } },
        });
    }
    // eslint-disable-next-line no-restricted-syntax -- boundary: createEmbeddedDocuments takes Foundry's generated create-data union; OwnedItemData is a cloned compendium payload
    if (talents.length + traits.length > 0) await actor.createEmbeddedDocuments('Item', [...talents, ...traits] as CreateItemData);
}

/**
 * Issue the regiment's Standard Kit into the character's inventory: the items of every character-scope kit line
 * and purchase, at the craftsmanship the kit raised them to. Gear a previous commit issued is replaced.
 */
async function applyRegimentKit(actor: WH40KBaseActor, state: RegimentState, catalog: ReadonlyArray<RegimentCatalogEntry>): Promise<void> {
    const stale = actor.items.filter((item) => item.getFlag(FLAG_SCOPE, KIT_GEAR_FLAG) === true).map((item) => item.id);
    if (stale.length > 0) await actor.deleteEmbeddedDocuments('Item', stale);

    const plans = kitGearPlans(resolveKit(state.selection, state.kitIds, catalog, { picks: state.kitPicks }));
    const gear: OwnedItemData[] = [];
    for (const plan of plans) {
        // eslint-disable-next-line no-await-in-loop -- sequential: each item resolves to its own compendium document before it is cloned
        const source = await fromUuid(plan.uuid);
        if (!source) continue;
        const cloned = cloneGrantedItemData(source, { sourceId: plan.uuid, quantity: plan.quantity, craftsmanship: plan.craftsmanship });
        gear.push({ ...cloned, flags: { ...cloned.flags, [FLAG_SCOPE]: { regimentKitGear: true } } });
    }
    // eslint-disable-next-line no-restricted-syntax -- boundary: createEmbeddedDocuments takes Foundry's generated create-data union; OwnedItemData is a cloned compendium payload
    if (gear.length > 0) await actor.createEmbeddedDocuments('Item', gear as CreateItemData);
    // The kit repeats items other grants issue (a Speciality's Specialist Equipment); fold them into one stack.
    await actor.mergeItemStacks();
}

/** Swap the squad Logistics Rating bonus a regiment gives, so a re-commit replaces the last one. */
async function applyRegimentLogistics(actor: WH40KBaseActor, bonus: number): Promise<void> {
    const previous = actor.getFlag(FLAG_SCOPE, LOGISTICS_FLAG);
    const applied = typeof previous === 'number' ? previous : 0;
    if (applied === bonus) return;
    // eslint-disable-next-line no-restricted-syntax -- boundary: logisticsRating lives on the per-system OW actor schema; not exposed on the abstract WH40KBaseActor system surface
    const current = (actor.system as { logisticsRating?: number }).logisticsRating;
    if (typeof current === 'number') await actor.update({ 'system.logisticsRating': current - applied + bonus });
    await actor.setFlag(FLAG_SCOPE, LOGISTICS_FLAG, bonus);
}

/**
 * Save a regiment onto an actor and apply it: the selection and kit are stored on the actor, each option is
 * copied on as an owned origin, the talents and traits they grant are created, and the Logistics bonus is
 * swapped in. The Regiment Builder's Commit button and a preset chosen in character creation both end here.
 */
export async function commitRegiment(actor: WH40KBaseActor, state: RegimentState, catalog: ReadonlyArray<RegimentCatalogEntry>): Promise<void> {
    const { selection } = state;
    const kit = state.kitIds.map((id, index) => ({ id, cost: catalog.find((entry) => entry.id === id)?.cost ?? 0, pick: state.kitPicks.at(index) ?? '' }));
    await actor.update({
        'system.regimentSelection.homeWorld': selection.homeWorld ?? '',
        'system.regimentSelection.commandingOfficer': selection.commandingOfficer ?? '',
        'system.regimentSelection.regimentType': selection.regimentType ?? '',
        'system.regimentSelection.trainingDoctrines': [...selection.trainingDoctrines],
        'system.regimentSelection.specialEquipmentDoctrines': [...selection.specialEquipmentDoctrines],
        'system.regimentDrawbacks': [...selection.drawbacks],
        'system.regimentSelection.favouredWeapons.basic': [...selection.favouredWeapons.basic],
        'system.regimentSelection.favouredWeapons.heavy': [...selection.favouredWeapons.heavy],
        'system.regimentKit': kit,
        'system.regimentChoices': forcedReplacement(encodePicks(state.picks)),
    });
    await applyRegimentToActor(actor, selectedOptionIds(selection), state.picks);
    await applyRegimentKit(actor, state, catalog);
    await applyRegimentLogistics(actor, aggregateRegimentGrants(selection, catalog).logistics ?? 0);
}

/** The preset items an actor owns (a regiment chosen in character creation, or a locked one the Builder loaded). */
function ownedPresetItems(actor: WH40KBaseActor): WH40KBaseActor['items']['contents'] {
    return actor.items.filter(
        (item) => item.system instanceof OriginPathData && item.system.step === 'regiment' && isRegimentPreset(item.system.regimentPreset),
    );
}

/** The preset block of the regiment the actor was started from, or null if it has none. */
export function ownedPresetOf(actor: WH40KBaseActor): RegimentPresetData | null {
    const item = ownedPresetItems(actor).at(0);
    return item !== undefined && item.system instanceof OriginPathData ? item.system.regimentPreset : null;
}

/**
 * Make the preset item the actor's own, replacing any it had, so the regiment's name shows in the header and a
 * locked preset stays locked. `presetUuid` is the compendium or world item the player picked. Marked applied so the
 * create hook does not apply it a second time.
 */
export async function adoptPreset(actor: WH40KBaseActor, presetUuid: string): Promise<void> {
    const stale = ownedPresetItems(actor).map((item) => item.id);
    if (stale.length > 0) await actor.deleteEmbeddedDocuments('Item', stale);
    const source = await fromUuid(presetUuid);
    if (!source) return;
    const cloned = cloneGrantedItemData(source, { sourceId: presetUuid });
    // eslint-disable-next-line no-restricted-syntax -- boundary: createEmbeddedDocuments takes Foundry's generated create-data union; OwnedItemData is a cloned compendium payload
    await actor.createEmbeddedDocuments('Item', [{ ...cloned, flags: { ...cloned.flags, [FLAG_SCOPE]: { regimentPresetApplied: true } } }] as CreateItemData);
}

/** Drop the actor's owned preset, for a regiment now built by hand. */
export async function forgetPreset(actor: WH40KBaseActor): Promise<void> {
    const stale = ownedPresetItems(actor).map((item) => item.id);
    if (stale.length > 0) await actor.deleteEmbeddedDocuments('Item', stale);
}

/**
 * `createItem` hook: a regiment preset added to a character (by the Origin Path Builder's Regiment step, or
 * dropped on the sheet) starts that character's regiment. The Builder's own commit marks its copy applied, so it
 * is skipped here. A preset with a pick left open applies what it can; the player finishes it in the Builder.
 */
export async function onRegimentPresetCreated(item: WH40KBaseActor['items']['contents'][number], userId: string): Promise<void> {
    if (game.user.id !== userId) return;
    const actor = item.parent;
    // only an Only War character carries the regiment fields
    if (actor === null || !('regimentSelection' in actor.system) || !(item.system instanceof OriginPathData)) return;
    if (item.system.step !== 'regiment' || !isRegimentPreset(item.system.regimentPreset)) return;
    if (item.getFlag(FLAG_SCOPE, PRESET_APPLIED_FLAG) === true) return;
    await commitRegiment(actor, stateFromPreset(item.system.regimentPreset), await loadRegimentCatalog());
}

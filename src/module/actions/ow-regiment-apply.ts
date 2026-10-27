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
import { dedupeTalentPlans, dedupeTraitPlans, talentPlansFor, traitPlansFor } from '../rules/ow-regiment-talents.ts';

const FLAG_SCOPE = 'wh40k-rpg';

/** Marks an owned `originPath` copy of a regiment option. */
const OPTION_FLAG = 'regimentOption';
/** Marks a talent granted by a regiment option. */
const GRANT_FLAG = 'regimentGranted';

/** Flags this module and the grant pipeline stamp on the items it creates. */
interface OwnedItemFlags {
    sourceId?: string;
    originPathGranted?: boolean;
    regimentOption?: boolean;
    regimentGranted?: boolean;
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

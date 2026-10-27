/**
 * Only War · regiment presets in the origin-path builder.
 *
 * The builder lists regiment presets in its Regiment step. A preset names its options but grants nothing itself,
 * so this wires the origins the builder has loaded into {@link buildRegimentPreview}: each preset gets the grants,
 * characteristic modifiers and still-open picks of the options it names, plus a summary of the regiment, so the
 * detail panel can show them and the player can be asked for the picks.
 */

import { type RegimentCatalogEntry, regimentEntryFromDoc } from '../../rules/ow-regiment-catalog.ts';
import { aggregateRegimentGrants, computeKitAllowance, computeRegimentBudget } from '../../rules/ow-regiment-creation.ts';
import { resolveKit } from '../../rules/ow-regiment-kit.ts';
import { stateFromPreset } from '../../rules/ow-regiment-preset.ts';
import {
    applyRegimentPreview,
    buildRegimentPreview,
    chosenCharacteristics,
    finishRegimentSelection,
    isPreviewablePreset,
    type PreviewableSystem,
    type PreviewChoice,
    type PreviewOptionDoc,
    type SummarySection,
    summaryHtml,
} from '../../rules/ow-regiment-preview.ts';
import { uuidNameCache } from '../../utils/uuid-name-cache.ts';
import { type NormalizedOrigin, normalizeOrigin } from './normalized-origin.ts';

/** The origin system as the preview reads it: raw compendium data, with the regiment fields the preview uses. */
type OriginSystem = PreviewOptionDoc['system'] & PreviewableSystem & { step?: string };

/** Section headings for the options a regiment names, in the order the book lists them. */
const SECTION_LABELS = [
    ['homeWorld', 'WH40K.OW.Regiment.Category.HomeWorld'],
    ['commandingOfficer', 'WH40K.OW.Regiment.Category.CommandingOfficer'],
    ['regimentType', 'WH40K.OW.Regiment.Category.RegimentType'],
    ['trainingDoctrines', 'WH40K.OW.Regiment.Category.TrainingDoctrine'],
    ['specialEquipmentDoctrines', 'WH40K.OW.Regiment.Category.SpecialEquipmentDoctrine'],
    ['drawbacks', 'WH40K.OW.Regiment.Category.Drawback'],
] as const;

/** The raw system of a normalized origin. */
function systemOf(origin: NormalizedOrigin): OriginSystem {
    // eslint-disable-next-line no-restricted-syntax -- boundary: a normalized origin keeps the raw compendium system, which has no schema type; OriginSystem is the slice the regiment preview reads
    return origin.system;
}

/** What a regiment gives besides grants: its options, Logistics, Standard Kit and Favoured Weapons, as description sections. */
function summarySections(
    origin: NormalizedOrigin,
    docs: ReadonlyMap<string, PreviewOptionDoc>,
    catalog: ReadonlyArray<RegimentCatalogEntry>,
): SummarySection[] {
    const system = systemOf(origin);
    if (system.regimentPreset === undefined) return [];
    const state = stateFromPreset(system.regimentPreset);
    const { selection } = state;
    const nameOf = (id: string | undefined): string[] => {
        const found = id === undefined ? undefined : docs.get(id)?.name;
        return found === undefined ? [] : [found];
    };
    const sections: SummarySection[] = SECTION_LABELS.map(([key, label]) => {
        const value = selection[key];
        return {
            label: game.i18n.localize(label),
            items: typeof value === 'string' || value === undefined ? nameOf(value) : value.flatMap((id) => nameOf(id)),
        };
    });

    const grants = aggregateRegimentGrants(selection, catalog);
    const allowance = computeKitAllowance(computeRegimentBudget(selection, catalog), grants);
    const logistics = grants.logistics ?? 0;
    sections.push({ label: game.i18n.localize('WH40K.OW.Regiment.Preview.Logistics'), items: logistics === 0 ? [] : [`+${logistics}`] });
    sections.push({ label: game.i18n.localize('WH40K.OW.Regiment.Kit.Total'), items: [String(allowance)] });

    const kit = resolveKit(selection, state.kitIds, catalog, { picks: state.kitPicks });
    const lines = kit.groups.flatMap((group) => group.lines.map((line) => `${line.label}${line.count === undefined ? '' : ` ×${line.count}`}`));
    sections.push({ label: game.i18n.localize('WH40K.OW.Regiment.StandardKit.Title'), items: lines });

    const favoured = [...selection.favouredWeapons.basic, ...selection.favouredWeapons.heavy]
        .filter((uuid) => uuid !== '')
        .map((uuid) => uuidNameCache.getName(uuid));
    sections.push({ label: game.i18n.localize('WH40K.OW.Regiment.Favoured.Title'), items: favoured });
    return sections;
}

/**
 * Re-derive the fields the builder reads besides `system` (grants, modifiers, description, whether it has picks).
 * The builder's totals and cards read these, so they have to follow the preview on and off.
 */
function renormalized(origin: NormalizedOrigin): NormalizedOrigin {
    const fresh = normalizeOrigin({ uuid: origin.id, name: origin.name, img: origin.img, system: origin.system });
    return {
        ...origin,
        grants: fresh.grants,
        modifiers: fresh.modifiers,
        description: fresh.description,
        shortDescription: fresh.shortDescription,
        hasChoices: fresh.hasChoices,
    };
}

/**
 * Give every regiment preset among `origins` the preview of what its options grant. The origins carry the option
 * documents too (they come from the same packs), so nothing more is loaded.
 */
export function previewRegimentPresets(origins: ReadonlyArray<NormalizedOrigin>): void {
    const docs = new Map<string, PreviewOptionDoc>();
    const catalog: RegimentCatalogEntry[] = [];
    for (const origin of origins) {
        const system = systemOf(origin);
        if (system.regiment === undefined) continue;
        docs.set(origin.id, { id: origin.id, name: origin.name, system });
        const entry = regimentEntryFromDoc(origin.id, { name: origin.name, system });
        if (entry !== undefined) catalog.push(entry);
    }
    for (const origin of origins) {
        const system = systemOf(origin);
        if (!isPreviewablePreset(system)) continue;
        const preview = buildRegimentPreview(system.regimentPreset, docs);
        applyRegimentPreview(system, preview, summaryHtml(summarySections(origin, docs, catalog)));
        Object.assign(origin, renormalized(origin));
    }
}

/** A confirmed selection with a regiment preview taken off: the original grants back, the player's picks on the preset. */
export function withoutRegimentPreview(selection: NormalizedOrigin): NormalizedOrigin {
    // eslint-disable-next-line no-restricted-syntax -- boundary: the finished system is the same raw compendium record, typed more narrowly; NormalizedOrigin.system is an open Record
    return renormalized({ ...selection, system: finishRegimentSelection(systemOf(selection)) as NormalizedOrigin['system'] });
}

/** How many of a regiment preset's picks the player still has to make (zero for any other origin). */
export function openRegimentPicks(selection: NormalizedOrigin): number {
    const system = systemOf(selection);
    if (system.regimentPreview === undefined) return 0;
    const chosen = new Map(Object.entries(system.selectedChoices ?? {}));
    const choices = system.grants?.choices;
    return Array.isArray(choices)
        ? choices.filter((choice: { label?: string; count?: number }) => (chosen.get(choice.label ?? '')?.length ?? 0) < (choice.count ?? 1)).length
        : 0;
}

/** The characteristic bonuses a regiment preset's picks give (empty for any other origin). */
export function regimentPickBonuses(selection: NormalizedOrigin): Record<string, number> {
    const system = systemOf(selection);
    if (system.regimentPreview === undefined) return {};
    const choices: ReadonlyArray<PreviewChoice> = system.grants?.choices ?? [];
    return chosenCharacteristics(choices, system.selectedChoices ?? {});
}

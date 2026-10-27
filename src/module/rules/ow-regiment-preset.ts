/**
 * Only War · regiment presets.
 *
 * A preset is a whole regiment saved as an `originPath` item in the Regiment step: the options chosen
 * (by compendium UUID), the picks made for them, and the Standard Kit bought. Choosing one in character
 * creation fills the Regiment Builder, and a character can start from it and change it — unless the
 * preset is locked, in which case a player cannot (the GM always can).
 *
 * Pure: no Foundry access. The dialog and the commit step live elsewhere.
 */

import { type RegimentCatalogEntry, choicesComplete, picksFor } from './ow-regiment-catalog.ts';
import {
    aggregateRegimentGrants,
    computeKitAllowance,
    computeKitBudget,
    computeRegimentBudget,
    emptyRegimentSelection,
    kitOverLimit,
    type RegimentIssue,
    type RegimentSelection,
} from './ow-regiment-creation.ts';

/** The persisted preset block (`system.regimentPreset`). */
export interface RegimentPresetData {
    homeWorld: string;
    commandingOfficer: string;
    regimentType: string;
    trainingDoctrines: string[];
    specialEquipmentDoctrines: string[];
    drawbacks: string[];
    kit: string[];
    choices: Record<string, Record<string, string[]>>;
    locked: boolean;
}

/** Everything the Regiment Builder edits. */
export interface RegimentState {
    readonly selection: RegimentSelection;
    /** Picks per selected option: option id → choice key → picked values. */
    readonly picks: Readonly<Record<string, Record<string, string[]>>>;
    /** Kit entries bought, by option id; an id repeats once per copy. */
    readonly kitIds: ReadonlyArray<string>;
}

/** True when a preset block holds a regiment (an ordinary origin has an empty one). */
export function isRegimentPreset(preset: Pick<RegimentPresetData, 'regimentType'> | undefined): boolean {
    return preset !== undefined && preset.regimentType !== '';
}

/** The builder state a preset starts from. */
export function stateFromPreset(preset: RegimentPresetData): RegimentState {
    return {
        selection: {
            ...emptyRegimentSelection(),
            homeWorld: preset.homeWorld,
            commandingOfficer: preset.commandingOfficer,
            regimentType: preset.regimentType,
            trainingDoctrines: [...preset.trainingDoctrines],
            specialEquipmentDoctrines: [...preset.specialEquipmentDoctrines],
            drawbacks: [...preset.drawbacks],
        },
        picks: Object.fromEntries(
            Object.entries(preset.choices).map(([id, picks]) => [id, Object.fromEntries(Object.entries(picks).map(([key, values]) => [key, [...values]]))]),
        ),
        kitIds: [...preset.kit],
    };
}

/** The preset block that saves a builder state. */
export function presetFromState(state: RegimentState, locked: boolean): RegimentPresetData {
    const { selection } = state;
    const held = new Set(selectedOptionIds(selection));
    return {
        homeWorld: selection.homeWorld ?? '',
        commandingOfficer: selection.commandingOfficer ?? '',
        regimentType: selection.regimentType ?? '',
        trainingDoctrines: [...selection.trainingDoctrines],
        specialEquipmentDoctrines: [...selection.specialEquipmentDoctrines],
        drawbacks: [...selection.drawbacks],
        kit: [...state.kitIds],
        // only the picks of options the preset actually holds
        choices: Object.fromEntries(Object.entries(state.picks).filter(([id]) => held.has(id))),
        locked,
    };
}

/** Every option id a selection holds, in category order. */
export function selectedOptionIds(selection: RegimentSelection): string[] {
    return [
        selection.homeWorld,
        selection.commandingOfficer,
        selection.regimentType,
        ...selection.trainingDoctrines,
        ...selection.specialEquipmentDoctrines,
        ...selection.drawbacks,
    ].filter((id): id is string => id !== undefined && id !== '');
}

/** What stops a state from being a sound regiment. */
export interface RegimentStateReport {
    /** The Regiment Creation rules still unmet (empty when the budget and picks are valid). */
    readonly issues: ReadonlyArray<RegimentIssue>;
    /** Ids the state names that the catalog does not hold (a removed or renamed option). */
    readonly unknownIds: ReadonlyArray<string>;
    /** Selected options with a choice that is not fully picked. */
    readonly openChoices: ReadonlyArray<string>;
    /** True when the Standard Kit fits its allowance and no item is taken more often than allowed. */
    readonly kitValid: boolean;
}

export function reportState(state: RegimentState, catalog: ReadonlyArray<RegimentCatalogEntry>): RegimentStateReport {
    const known = new Set(catalog.map((entry) => entry.id));
    const ids = [...selectedOptionIds(state.selection), ...state.kitIds];
    const result = computeRegimentBudget(state.selection, catalog);
    const kit = state.kitIds.map((id) => ({ id, cost: catalog.find((entry) => entry.id === id)?.cost ?? 0 }));
    const allowance = computeKitAllowance(result, aggregateRegimentGrants(state.selection, catalog));
    return {
        issues: result.issues,
        unknownIds: ids.filter((id) => !known.has(id)),
        openChoices: selectedOptionIds(state.selection).filter((id) => {
            const entry = catalog.find((candidate) => candidate.id === id);
            return entry !== undefined && !choicesComplete(entry, new Map(Object.entries(state.picks)).get(id));
        }),
        kitValid: computeKitBudget(kit, allowance).valid && kitOverLimit(kit, catalog).length === 0,
    };
}

/** True when the state breaks no rule and names only known options. Open choices are fine in a preset. */
export function isSoundPreset(report: RegimentStateReport): boolean {
    return report.issues.length === 0 && report.unknownIds.length === 0 && report.kitValid;
}

/**
 * May this user change the regiment? A locked preset freezes the choice of options and the kit for
 * players; the GM is never bound by it.
 */
export function canEditOptions(lockedPreset: boolean, isGM: boolean): boolean {
    return isGM || !lockedPreset;
}

/**
 * May this user change a pick? On a locked preset a player can still fill in a choice the preset left open,
 * but cannot change one it already made.
 */
export function canEditChoice(
    lockedPreset: RegimentPresetData | null,
    isGM: boolean,
    optionId: string,
    choice: { key: string; count: number; optionCount: number },
): boolean {
    if (lockedPreset === null || isGM) return true;
    return picksFor(lockedPreset.choices, optionId, choice.key).length < Math.min(choice.count, choice.optionCount);
}

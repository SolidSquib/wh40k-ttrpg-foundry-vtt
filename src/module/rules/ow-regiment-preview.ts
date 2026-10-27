/**
 * Only War · a regiment preset, as the character-creation builder shows it.
 *
 * A regiment preset item grants nothing itself: everything it gives comes from the Home World, Commanding
 * Officer, Regiment Type, Doctrines and Drawback it names. To show those in the builder's detail panel, and to
 * ask for the picks it leaves open, this module folds the options' grants into one origin-shaped preview.
 * The preview is display-only: {@link finishRegimentSelection} takes it back off before the origin is committed,
 * since committing the regiment applies each option through its own owned origin item.
 *
 * Pure — the builder supplies the option documents it has already loaded.
 */

import { iterateResolvedChoices } from '../utils/origin-choices.ts';
import type { RegimentBlockLike } from './ow-regiment-catalog.ts';
import { isRegimentPreset, type RegimentPresetData, selectedOptionIds, stateFromPreset } from './ow-regiment-preset.ts';

/** A skill, talent or trait an option grants outright. */
interface GrantEntry {
    readonly name: string;
    readonly specialization?: string;
    readonly level?: string | number;
    readonly uuid?: string;
}

/** One option of a choice, as authored on the regiment option document. */
export interface PreviewChoiceOption {
    readonly name?: string;
    readonly value?: string;
    readonly label?: string;
    readonly uuid?: string;
    readonly grants?: {
        readonly characteristics?: Readonly<Record<string, number>>;
        readonly skills?: ReadonlyArray<GrantEntry>;
        readonly talents?: ReadonlyArray<GrantEntry>;
        readonly traits?: ReadonlyArray<GrantEntry>;
    };
}

/** A pick a regiment option asks the player for. */
export interface PreviewChoice {
    readonly type?: string;
    readonly label?: string;
    readonly name?: string;
    readonly count?: number;
    readonly xpCost?: number;
    readonly options?: ReadonlyArray<PreviewChoiceOption>;
}

/** The slice of a regiment option document (a normalized origin) the preview reads. */
export interface PreviewOptionDoc {
    readonly id: string;
    readonly name: string;
    readonly system: {
        readonly regiment?: RegimentBlockLike;
        readonly grants?: {
            readonly skills?: ReadonlyArray<GrantEntry>;
            readonly talents?: ReadonlyArray<GrantEntry>;
            readonly traits?: ReadonlyArray<GrantEntry>;
            readonly aptitudes?: ReadonlyArray<string>;
            readonly choices?: ReadonlyArray<PreviewChoice>;
        };
        readonly modifiers?: { readonly characteristics?: Readonly<Record<string, number>> };
    };
}

/** What the preview adds to the origin's `system`. */
export interface RegimentPreview {
    readonly grants: {
        readonly skills: GrantEntry[];
        readonly talents: GrantEntry[];
        readonly traits: GrantEntry[];
        readonly aptitudes: string[];
        readonly choices: PreviewChoice[];
    };
    readonly characteristics: Record<string, number>;
    /** The picks the preset already holds, under the preview choices' labels. */
    readonly selectedChoices: Record<string, string[]>;
    /** Preview choice label → the option and choice key the pick belongs to. */
    readonly keyMap: Record<string, { readonly optionId: string; readonly choiceKey: string }>;
}

const SKILL_LEVEL = 'trained';

/**
 * An option the builder can total up on its own. The compendium leaves a talent, skill or trait option bare (the
 * choice's type says what it is, and the actor's origin pipeline reads it that way); the builder's totals only
 * count an option that says what it grants, so spell that out. The value the picks are stored under is kept.
 */
function explicitOption(type: string | undefined, option: PreviewChoiceOption): PreviewChoiceOption {
    const name = option.name ?? option.label ?? option.value ?? '';
    const base = { ...option, value: option.value ?? name, label: option.label ?? name };
    if (option.grants !== undefined) return base;
    const uuid = option.uuid ?? '';
    if (type === 'talent') return { ...base, grants: { talents: [{ name, uuid }] } };
    if (type === 'skill') return { ...base, grants: { skills: [{ name }] } };
    if (type === 'trait') return { ...base, grants: { traits: [{ name, uuid }] } };
    return base;
}

/** True when a choice's picks already fill every slot it has. */
function isFilled(choice: PreviewChoice, picks: ReadonlyArray<string>): boolean {
    return picks.length >= Math.min(choice.count ?? 1, (choice.options ?? []).length);
}

/** Add `entry` to `list` unless one with the same name and specialisation is already there. */
function addUnique(list: GrantEntry[], entry: GrantEntry): void {
    const same = (other: GrantEntry): boolean => other.name === entry.name && (other.specialization ?? '') === (entry.specialization ?? '');
    if (!list.some(same)) list.push(entry);
}

function addCharacteristics(total: Record<string, number>, mods: Readonly<Record<string, number>> | undefined): void {
    for (const [key, value] of Object.entries(mods ?? {})) total[key] = (total[key] ?? 0) + value;
}

/** What one picked option of a choice gives, added to the fixed grants. */
function foldPick(preview: RegimentPreview, choice: PreviewChoice, option: PreviewChoiceOption): void {
    const name = option.name ?? option.label ?? option.value ?? '';
    addCharacteristics(preview.characteristics, option.grants?.characteristics);
    for (const skill of option.grants?.skills ?? []) addUnique(preview.grants.skills, skill);
    for (const talent of option.grants?.talents ?? []) addUnique(preview.grants.talents, talent);
    if (option.grants !== undefined) return;
    if (choice.type === 'talent') addUnique(preview.grants.talents, { name, uuid: option.uuid ?? '' });
    else if (choice.type === 'skill') addUnique(preview.grants.skills, { name, level: SKILL_LEVEL });
    else if (choice.type === 'aptitude' && !preview.grants.aptitudes.includes(name)) preview.grants.aptitudes.push(name);
}

/**
 * Fold the options a preset names into one preview. An unlocked preset is a starting point, so every pick it asks
 * for stays a choice the player can change; a locked one has its filled picks folded into the fixed grants, and
 * only the picks it left open are asked for.
 */
export function buildRegimentPreview(preset: RegimentPresetData, docs: ReadonlyMap<string, PreviewOptionDoc>): RegimentPreview {
    const preview: RegimentPreview = {
        grants: { skills: [], talents: [], traits: [], aptitudes: [], choices: [] },
        characteristics: {},
        selectedChoices: {},
        keyMap: {},
    };
    const held = new Map(Object.entries(preset.choices));

    for (const id of selectedOptionIds(stateFromPreset(preset).selection)) {
        const doc = docs.get(id);
        if (doc === undefined) continue;
        const { grants, modifiers } = doc.system;
        addCharacteristics(preview.characteristics, modifiers?.characteristics);
        for (const skill of grants?.skills ?? []) addUnique(preview.grants.skills, skill);
        for (const talent of grants?.talents ?? []) addUnique(preview.grants.talents, talent);
        for (const trait of grants?.traits ?? []) addUnique(preview.grants.traits, trait);
        for (const aptitude of grants?.aptitudes ?? []) if (!preview.grants.aptitudes.includes(aptitude)) preview.grants.aptitudes.push(aptitude);

        const picked = held.get(id) ?? {};
        for (const resolved of iterateResolvedChoices(grants?.choices ?? [], picked)) {
            const { choice, baseLabel, choiceKey, selectedValues, resolveOption } = resolved;
            if (preset.locked && isFilled(choice, selectedValues)) {
                for (const value of selectedValues) {
                    const option = resolveOption(value);
                    if (option !== undefined) foldPick(preview, choice, option);
                }
                continue;
            }
            const label = `${doc.name}: ${baseLabel}`;
            preview.grants.choices.push({
                ...choice,
                label,
                name: label,
                options: (choice.options ?? []).map((option) => explicitOption(choice.type, option)),
            });
            preview.keyMap[label] = { optionId: id, choiceKey };
            if (selectedValues.length > 0) preview.selectedChoices[label] = selectedValues;
        }
    }
    return preview;
}

/** The origin `system` fields the builder reads, which a preview overwrites. */
export interface PreviewableSystem {
    description?: { value?: string };
    grants?: Record<string, object | string | number | undefined>;
    modifiers?: Record<string, object | undefined>;
    selectedChoices?: Record<string, string[]>;
    regimentPreset?: RegimentPresetData;
    /** Set while a preview is on: the originals to put back, and where each pick belongs. */
    regimentPreview?: {
        original: { description: { value?: string } | undefined; grants: PreviewableSystem['grants']; modifiers: PreviewableSystem['modifiers'] };
        keyMap: RegimentPreview['keyMap'];
    };
}

/** True when this origin's system is a regiment preset that can be previewed. */
export function isPreviewablePreset(system: PreviewableSystem & { step?: string }): system is PreviewableSystem & { regimentPreset: RegimentPresetData } {
    return system.step === 'regiment' && system.regimentPreset !== undefined && isRegimentPreset(system.regimentPreset);
}

/** Put a preview onto an origin's system, keeping what it replaces so it can be taken off again. */
export function applyRegimentPreview(system: PreviewableSystem, preview: RegimentPreview, descriptionHtml: string): void {
    system.regimentPreview = { original: { description: system.description, grants: system.grants, modifiers: system.modifiers }, keyMap: preview.keyMap };
    system.description = { value: descriptionHtml };
    system.grants = { ...system.grants, ...preview.grants, equipment: [], specialAbilities: [], woundsFormula: '', fateFormula: '' };
    system.modifiers = { ...system.modifiers, characteristics: preview.characteristics };
    system.selectedChoices = { ...preview.selectedChoices };
}

/**
 * Take a preview off before the origin is committed: the original grants come back, and what the player picked
 * is written into the preset's own picks. Returns the system unchanged when no preview is on.
 */
export function finishRegimentSelection<T extends PreviewableSystem>(system: T): T {
    const { regimentPreview, regimentPreset } = system;
    if (regimentPreview === undefined || regimentPreset === undefined) return system;
    const choices: Record<string, Record<string, string[]>> = Object.fromEntries(
        Object.entries(regimentPreset.choices).map(([optionId, picks]) => [optionId, { ...picks }]),
    );
    const chosen = new Map(Object.entries(system.selectedChoices ?? {}));
    for (const [label, target] of Object.entries(regimentPreview.keyMap)) {
        const picks = chosen.get(label);
        if (picks === undefined) continue;
        choices[target.optionId] = { ...(choices[target.optionId] ?? {}), [target.choiceKey]: [...picks] };
    }
    const { regimentPreview: _preview, ...rest } = system;
    return {
        ...rest,
        description: regimentPreview.original.description,
        grants: regimentPreview.original.grants,
        modifiers: regimentPreview.original.modifiers,
        selectedChoices: {},
        regimentPreset: { ...regimentPreset, choices },
    } as T;
}

/**
 * The characteristic bonuses the player's picks give, for a preview's choices and picks. The origin builder bakes
 * origin bonuses into the characteristics when it commits; a regiment preset's own picks have no resolved
 * modifiers of their own (they are choices on the options it names), so they are summed here.
 */
export function chosenCharacteristics(
    choices: ReadonlyArray<PreviewChoice>,
    selected: Readonly<Record<string, ReadonlyArray<string>>>,
): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const { selectedValues, resolveOption } of iterateResolvedChoices(choices, selected)) {
        for (const value of selectedValues) addCharacteristics(totals, resolveOption(value)?.grants?.characteristics);
    }
    return totals;
}

/** One line of the preview's description: a heading and the names under it. */
export interface SummarySection {
    readonly label: string;
    readonly items: ReadonlyArray<string>;
}

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The preview's description: each section as a paragraph (one item) or a list (several). */
export function summaryHtml(sections: ReadonlyArray<SummarySection>): string {
    return sections
        .filter((section) => section.items.length > 0)
        .map((section) =>
            section.items.length === 1
                ? `<p><strong>${escapeHtml(section.label)}:</strong> ${escapeHtml(section.items.join(''))}</p>`
                : `<p><strong>${escapeHtml(section.label)}</strong></p><ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
        )
        .join('');
}

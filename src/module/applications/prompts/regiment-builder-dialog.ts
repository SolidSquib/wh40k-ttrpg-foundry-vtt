/**
 * @file RegimentBuilderDialog — Only War Regiment Creation walkthrough (#151).
 *
 * Thin UI shell over the engine in `src/module/rules/ow-regiment-creation.ts`.
 * Each click on an option toggles it; the live 12-point budget, the doctrine
 * limit and the Standard Kit allowance update on re-render. Options that ask
 * the player to choose (a Home World's "any two Characteristics") show their
 * picks under the selected option.
 *
 * Per Direction #7 the dialog never names a Home World, Commanding Officer,
 * Doctrine or kit item — the catalog is read from the OW compendium by
 * `utils/regiment-catalog.ts`. On commit it persists the selection on the
 * actor and copies each chosen option onto it as an owned origin
 * (`actions/ow-regiment-apply.ts`).
 */

import { adoptPreset, commitRegiment, ownedPresetOf } from '../../actions/ow-regiment-apply.ts';
import type { WH40KBaseActor } from '../../documents/base-actor.ts';
import {
    choicesComplete,
    entriesInCategory,
    picksFor,
    type RegimentCatalogEntry,
    type RegimentPicks,
    type RegimentPresetEntry,
    togglePick,
} from '../../rules/ow-regiment-catalog.ts';
import {
    aggregateRegimentGrants,
    computeKitAllowance,
    computeKitBudget,
    computeRegimentBudget,
    emptyRegimentSelection,
    kitOverLimit,
    MAX_DOCTRINES,
    REGIMENT_CATEGORIES,
    type RegimentCategory,
    type RegimentIssue,
    type RegimentSelection,
} from '../../rules/ow-regiment-creation.ts';
import {
    canEditChoice,
    canEditOptions,
    isSoundPreset,
    presetFromState,
    type RegimentPresetData,
    type RegimentState,
    reportState,
    selectedOptionIds,
    stateFromPreset,
} from '../../rules/ow-regiment-preset.ts';
import { loadRegimentCatalog, loadRegimentPresets } from '../../utils/regiment-catalog.ts';
import type { ApplicationV2Ctor } from '../api/application-types.ts';
import ApplicationV2Mixin from '../api/application-v2-mixin.ts';

const { ApplicationV2 } = foundry.applications.api;

/** Map RegimentCategory → i18n label key. */
const CATEGORY_LABEL_KEYS: Readonly<Record<RegimentCategory, string>> = Object.freeze({
    homeWorld: 'WH40K.OW.Regiment.Category.HomeWorld',
    commandingOfficer: 'WH40K.OW.Regiment.Category.CommandingOfficer',
    regimentType: 'WH40K.OW.Regiment.Category.RegimentType',
    trainingDoctrine: 'WH40K.OW.Regiment.Category.TrainingDoctrine',
    specialEquipmentDoctrine: 'WH40K.OW.Regiment.Category.SpecialEquipmentDoctrine',
    drawback: 'WH40K.OW.Regiment.Category.Drawback',
});

const ISSUE_KEYS: Readonly<Record<RegimentIssue, string>> = Object.freeze({
    overBudget: 'WH40K.OW.Regiment.Issue.OverBudget',
    missingHomeWorld: 'WH40K.OW.Regiment.Issue.MissingHomeWorld',
    missingCommandingOfficer: 'WH40K.OW.Regiment.Issue.MissingCommandingOfficer',
    missingRegimentType: 'WH40K.OW.Regiment.Issue.MissingRegimentType',
    tooManyDoctrines: 'WH40K.OW.Regiment.Issue.TooManyDoctrines',
    tooManyDrawbacks: 'WH40K.OW.Regiment.Issue.TooManyDrawbacks',
});

interface ChoiceRow {
    readonly optionId: string;
    readonly key: string;
    readonly label: string;
    readonly count: number;
    /** False when a locked preset has already made this pick and the user may not change it. */
    readonly editable: boolean;
    readonly options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly picked: boolean }>;
}

interface OptionRow {
    readonly id: string;
    readonly label: string;
    readonly cost: number;
    readonly restriction: string;
    readonly selected: boolean;
    readonly kit: ReadonlyArray<{ readonly label: string; readonly scope: string }>;
    readonly choices: ReadonlyArray<ChoiceRow>;
}

interface CategoryRow {
    readonly id: RegimentCategory;
    readonly labelKey: string;
    readonly spent: number;
    readonly options: ReadonlyArray<OptionRow>;
}

interface KitRow {
    readonly id: string;
    readonly label: string;
    readonly cost: number;
    readonly restriction: string;
    readonly count: number;
    readonly maxCount: number;
}

// eslint-disable-next-line no-restricted-syntax -- boundary: Handlebars context is an open bag; Record<string, unknown> matches the mixin's return type
interface RegimentBuilderContext extends Record<string, unknown> {
    readonly budget: { spent: number; total: number; remaining: number; valid: boolean; over: boolean; refund: number };
    readonly doctrines: { count: number; max: number };
    readonly issues: ReadonlyArray<string>;
    readonly categories: ReadonlyArray<CategoryRow>;
    readonly kit: { spent: number; allowance: number; remaining: number; over: boolean; rows: ReadonlyArray<KitRow> };
    readonly canCommit: boolean;
    /** Saved regiments the user can start from (empty when the regiment is locked to them). */
    readonly presets: ReadonlyArray<{ id: string; label: string; locked: boolean; selected: boolean }>;
    /** True when a locked preset stops this user changing the options and kit. */
    readonly locked: boolean;
    readonly canSavePreset: boolean;
}

function isRegimentCategory(value: string): value is RegimentCategory {
    return (REGIMENT_CATEGORIES as ReadonlyArray<string>).includes(value);
}

/** Toggle one option id inside the selection: single-pick slots replace, doctrine slots add or remove. */
function toggleSelection(selection: RegimentSelection, category: RegimentCategory, optionId: string): RegimentSelection {
    if (category === 'trainingDoctrine') return { ...selection, trainingDoctrines: toggled(selection.trainingDoctrines, optionId) };
    if (category === 'specialEquipmentDoctrine') return { ...selection, specialEquipmentDoctrines: toggled(selection.specialEquipmentDoctrines, optionId) };
    if (category === 'drawback') return { ...selection, drawbacks: selection.drawbacks.includes(optionId) ? [] : [optionId] };
    return { ...selection, [category]: selection[category] === optionId ? '' : optionId };
}

function toggled(list: ReadonlyArray<string>, id: string): string[] {
    return list.includes(id) ? list.filter((v) => v !== id) : [...list, id];
}

function isSelected(selection: RegimentSelection, category: RegimentCategory, id: string): boolean {
    if (category === 'trainingDoctrine') return selection.trainingDoctrines.includes(id);
    if (category === 'specialEquipmentDoctrine') return selection.specialEquipmentDoctrines.includes(id);
    if (category === 'drawback') return selection.drawbacks.includes(id);
    return selection[category] === id;
}

// eslint-disable-next-line no-restricted-syntax -- boundary: ApplicationV2 global lacks the typed constructor Mixin needs; cast through unknown is the established pattern (matches colony-growth-dialog)
export default class RegimentBuilderDialog extends ApplicationV2Mixin(ApplicationV2 as unknown as ApplicationV2Ctor) {
    declare selection: RegimentSelection;
    declare catalog: ReadonlyArray<RegimentCatalogEntry>;
    /** Player picks per selected option: option id → choice key → picked values. */
    declare picks: Record<string, Record<string, string[]>>;
    /** Kit entries bought, by option id; an id repeats once per copy. */
    declare kitIds: string[];
    /** Owning actor whose `system.regimentSelection` is the source of truth. Null in story / probe contexts. */
    declare actor: WH40KBaseActor | null;
    /** Saved regiments to start from. */
    declare presets: RegimentPresetEntry[];
    /** The preset loaded in this session, if any. */
    declare loadedPreset: RegimentPresetEntry | null;
    /** The locked preset in force (the actor's own, or one just loaded), or null. */
    declare lockedPreset: RegimentPresetData | null;

    constructor(
        options: ApplicationV2Config.DefaultOptions & {
            actor?: WH40KBaseActor | null;
            selection?: RegimentSelection;
            catalog?: ReadonlyArray<RegimentCatalogEntry>;
            presets?: RegimentPresetEntry[];
        } = {},
    ) {
        super(options);
        this.actor = options.actor ?? null;
        this.selection = options.selection ?? readSelectionFromActor(this.actor) ?? emptyRegimentSelection();
        this.catalog = options.catalog ?? [];
        this.picks = readPicksFromActor(this.actor);
        this.kitIds = readKitFromActor(this.actor);
        this.presets = options.presets ?? [];
        this.loadedPreset = null;
        const owned = this.actor === null ? null : ownedPresetOf(this.actor);
        this.lockedPreset = owned?.locked === true ? owned : null;
    }

    /** May the current user change the options and kit? A locked preset stops players, never the GM. */
    #canEdit(): boolean {
        return canEditOptions(this.lockedPreset !== null, game.user.isGM);
    }

    #state(): RegimentState {
        return { selection: this.selection, picks: this.picks, kitIds: this.kitIds };
    }

    /** @override */
    static override DEFAULT_OPTIONS: ApplicationV2Config.DefaultOptions = {
        tag: 'form',
        classes: ['wh40k-rpg', 'dialog', 'regiment-builder-dialog', 'standard-form'],
        actions: {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            toggleOption: RegimentBuilderDialog.#onToggleOption,
            // eslint-disable-next-line @typescript-eslint/unbound-method
            pickChoice: RegimentBuilderDialog.#onPickChoice,
            // eslint-disable-next-line @typescript-eslint/unbound-method
            addKit: RegimentBuilderDialog.#onAddKit,
            // eslint-disable-next-line @typescript-eslint/unbound-method
            removeKit: RegimentBuilderDialog.#onRemoveKit,
            // eslint-disable-next-line @typescript-eslint/unbound-method
            loadPreset: RegimentBuilderDialog.#onLoadPreset,
            // eslint-disable-next-line @typescript-eslint/unbound-method
            savePreset: RegimentBuilderDialog.#onSavePreset,
            // eslint-disable-next-line @typescript-eslint/unbound-method
            commitRegiment: RegimentBuilderDialog.#onCommit,
            // eslint-disable-next-line @typescript-eslint/unbound-method
            cancelRegiment: RegimentBuilderDialog.#onCancel,
        },
        position: { width: 620 },
        window: {
            title: 'WH40K.OW.Regiment.DialogTitle',
            resizable: true,
        },
    };

    /** @override */
    static override PARTS: Record<string, ApplicationV2Config.PartConfiguration> = {
        form: {
            template: 'systems/wh40k-rpg/templates/prompt/regiment-builder-dialog.hbs',
            classes: [],
            scrollable: ['.tw-flex-col'],
        },
    };

    /** Ids of every selected non-kit option the player still owes picks on. */
    #incompleteChoices(): boolean {
        return selectedOptionIds(this.selection).some((id) => {
            const entry = this.catalog.find((candidate) => candidate.id === id);
            return entry !== undefined && !choicesComplete(entry, this.picks[id]);
        });
    }

    /** @inheritDoc */
    override async _prepareContext(options: ApplicationV2Config.RenderOptions): Promise<RegimentBuilderContext> {
        const baseCtx = (await super._prepareContext(options)) as RegimentBuilderContext;
        const result = computeRegimentBudget(this.selection, this.catalog);

        const categories: CategoryRow[] = REGIMENT_CATEGORIES.map((category) => ({
            id: category,
            labelKey: CATEGORY_LABEL_KEYS[category],
            spent: result.perCategory[category],
            options: entriesInCategory(this.catalog, category).map((entry) => {
                const selected = isSelected(this.selection, category, entry.id);
                return {
                    id: entry.id,
                    label: entry.label,
                    cost: entry.cost,
                    restriction: entry.restriction,
                    selected,
                    kit: entry.kit,
                    choices: selected
                        ? entry.choices.map((choice) => ({
                              optionId: entry.id,
                              key: choice.key,
                              label: choice.label,
                              count: choice.count,
                              editable: canEditChoice(this.lockedPreset, game.user.isGM, entry.id, {
                                  key: choice.key,
                                  count: choice.count,
                                  optionCount: choice.options.length,
                              }),
                              options: choice.options.map((opt) => ({ ...opt, picked: picksFor(this.picks, entry.id, choice.key).includes(opt.value) })),
                          }))
                        : [],
                };
            }),
        }));

        const kitEntries = this.kitIds.map((id) => ({ id, cost: this.catalog.find((entry) => entry.id === id)?.cost ?? 0 }));
        const allowance = computeKitAllowance(result, aggregateRegimentGrants(this.selection, this.catalog));
        const kitBudget = computeKitBudget(kitEntries, allowance);
        const kitRows: KitRow[] = entriesInCategory(this.catalog, 'kitItem').map((entry) => ({
            id: entry.id,
            label: entry.label,
            cost: entry.cost,
            restriction: entry.restriction,
            count: this.kitIds.filter((id) => id === entry.id).length,
            maxCount: entry.maxCount ?? 1,
        }));

        const issues = result.issues.map((issue) => game.i18n.localize(ISSUE_KEYS[issue]));
        const canCommit = result.valid && !this.#incompleteChoices() && kitBudget.valid && kitOverLimit(kitEntries, this.catalog).length === 0;

        return {
            ...baseCtx,
            budget: {
                spent: result.spent,
                total: result.budget,
                remaining: result.remaining,
                valid: result.valid,
                over: result.remaining < 0,
                refund: result.refund,
            },
            doctrines: { count: result.doctrineCount, max: MAX_DOCTRINES },
            issues,
            categories,
            kit: { spent: kitBudget.spent, allowance, remaining: kitBudget.remaining, over: !kitBudget.valid, rows: kitRows },
            canCommit,
            presets: this.#canEdit()
                ? this.presets.map((entry) => ({ id: entry.id, label: entry.label, locked: entry.data.locked, selected: entry.id === this.loadedPreset?.id }))
                : [],
            locked: !this.#canEdit(),
            canSavePreset: game.user.can('ITEM_CREATE') && isSoundPreset(reportState(this.#state(), this.catalog)),
        };
    }

    static async #onToggleOption(this: RegimentBuilderDialog, event: Event, target: HTMLElement): Promise<void> {
        event.preventDefault();
        const categoryStr = target.dataset['category'];
        const optionId = target.dataset['optionId'];
        if (typeof categoryStr !== 'string' || typeof optionId !== 'string' || optionId === '') return;
        if (!isRegimentCategory(categoryStr) || !this.#canEdit()) return;
        this.selection = toggleSelection(this.selection, categoryStr, optionId);
        // Picks belong to a selected option; drop those of any option no longer held.
        const held = new Set(selectedOptionIds(this.selection));
        this.picks = Object.fromEntries(Object.entries(this.picks).filter(([id]) => held.has(id)));
        await this.render();
    }

    static async #onPickChoice(this: RegimentBuilderDialog, event: Event, target: HTMLElement): Promise<void> {
        event.preventDefault();
        const { optionId, choiceKey, value } = target.dataset;
        if (optionId === undefined || choiceKey === undefined || value === undefined) return;
        const choice = this.catalog.find((entry) => entry.id === optionId)?.choices.find((candidate) => candidate.key === choiceKey);
        if (
            choice === undefined ||
            !canEditChoice(this.lockedPreset, game.user.isGM, optionId, { key: choiceKey, count: choice.count, optionCount: choice.options.length })
        )
            return;
        const forOption = this.picks[optionId] ?? {};
        this.picks = { ...this.picks, [optionId]: { ...forOption, [choiceKey]: togglePick(forOption[choiceKey] ?? [], value, choice.count) } };
        await this.render();
    }

    static async #onAddKit(this: RegimentBuilderDialog, event: Event, target: HTMLElement): Promise<void> {
        event.preventDefault();
        const optionId = target.dataset['optionId'];
        if (optionId === undefined || optionId === '' || !this.#canEdit()) return;
        const max = this.catalog.find((entry) => entry.id === optionId)?.maxCount ?? 1;
        if (this.kitIds.filter((id) => id === optionId).length >= max) return;
        this.kitIds = [...this.kitIds, optionId];
        await this.render();
    }

    static async #onRemoveKit(this: RegimentBuilderDialog, event: Event, target: HTMLElement): Promise<void> {
        event.preventDefault();
        const optionId = target.dataset['optionId'];
        const at = this.kitIds.lastIndexOf(optionId ?? '');
        if (at < 0 || !this.#canEdit()) return;
        this.kitIds = this.kitIds.filter((_id, index) => index !== at);
        await this.render();
    }

    /** Start from a saved regiment: its options, picks and kit replace what is on screen. */
    static async #onLoadPreset(this: RegimentBuilderDialog, event: Event, target: HTMLElement): Promise<void> {
        event.preventDefault();
        const entry = this.presets.find((candidate) => candidate.id === target.dataset['presetId']);
        if (entry === undefined || !this.#canEdit()) return;
        const state = stateFromPreset(entry.data);
        this.selection = state.selection;
        this.picks = { ...state.picks };
        this.kitIds = [...state.kitIds];
        this.loadedPreset = entry;
        this.lockedPreset = entry.data.locked ? entry.data : null;
        await this.render();
    }

    /** Save what is on screen as a regiment preset (a world item in the Regiment step), optionally locked. */
    static async #onSavePreset(this: RegimentBuilderDialog, event: Event, _target: HTMLElement): Promise<void> {
        event.preventDefault();
        if (!isSoundPreset(reportState(this.#state(), this.catalog))) return;
        const choice = await promptPresetDetails();
        if (choice === null || choice.name === '') return;
        await Item.create({
            name: choice.name,
            type: 'originPath',
            system: { step: 'regiment', stepIndex: 1, gameSystem: 'ow', positions: [], regimentPreset: presetFromState(this.#state(), choice.locked) },
        });
        ui.notifications.info(game.i18n.format('WH40K.OW.Regiment.Preset.Saved', { name: choice.name }));
        this.presets = await loadRegimentPresets();
        await this.render();
    }

    static async #onCommit(this: RegimentBuilderDialog, event: Event, _target: HTMLElement): Promise<void> {
        event.preventDefault();
        const result = computeRegimentBudget(this.selection, this.catalog);
        if (!result.valid || this.#incompleteChoices()) return; // template also disables the button

        if (this.actor !== null) {
            await commitRegiment(this.actor, this.#state(), this.catalog);
            // a locked preset loaded here stays on the character so its lock holds the next time they open this
            if (this.loadedPreset?.data.locked === true) await adoptPreset(this.actor, this.loadedPreset.id);
        }
        await this.close();
    }

    static async #onCancel(this: RegimentBuilderDialog, event: Event, _target: HTMLElement): Promise<void> {
        event.preventDefault();
        await this.close();
    }

    /** Convenience opener, mirrors `ColonyGrowthDialog.show`. Loads the catalog from the OW packs first. */
    static async show(actor: WH40KBaseActor, catalog?: ReadonlyArray<RegimentCatalogEntry>): Promise<RegimentBuilderDialog> {
        const dialog = new RegimentBuilderDialog({ actor, catalog: catalog ?? (await loadRegimentCatalog()), presets: await loadRegimentPresets() });
        void dialog.render({ force: true });
        return dialog;
    }
}

/** Ask for the new preset's name and whether it is locked. */
async function promptPresetDetails(): Promise<{ name: string; locked: boolean } | null> {
    const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: 'WH40K.OW.Regiment.Preset.SaveTitle' },
        content: `
            <div class="form-group">
                <label>${game.i18n.localize('WH40K.OW.Regiment.Preset.Name')}</label>
                <input type="text" name="presetName" value="" autofocus />
            </div>
            <div class="form-group">
                <label>${game.i18n.localize('WH40K.OW.Regiment.Preset.Locked')}</label>
                <input type="checkbox" name="presetLocked" />
                <p class="hint">${game.i18n.localize('WH40K.OW.Regiment.Preset.LockedHint')}</p>
            </div>
        `,
        ok: {
            label: 'WH40K.OW.Regiment.Preset.Save',
            callback: (_evt: Event, button: HTMLButtonElement) => {
                const form = button.form;
                if (form === null) return null;
                const name = form.elements.namedItem('presetName');
                const locked = form.elements.namedItem('presetLocked');
                return { name: name instanceof HTMLInputElement ? name.value.trim() : '', locked: locked instanceof HTMLInputElement && locked.checked };
            },
        },
        rejectClose: false,
    });
    // eslint-disable-next-line no-restricted-syntax -- boundary: DialogV2 prompt return is typed as unknown; the callback above narrows the shape
    return result === null ? null : (result as unknown as { name: string; locked: boolean });
}

/** Pull the persisted selection off an actor's `system.regimentSelection` / `regimentDrawbacks` slots. */
function readSelectionFromActor(actor: WH40KBaseActor | null): RegimentSelection | undefined {
    if (actor === null) return undefined;
    // eslint-disable-next-line no-restricted-syntax -- boundary: regimentSelection lives on the per-system OW actor schema; not exposed on the abstract WH40KBaseActor system surface
    const sys = actor.system as { regimentSelection?: RegimentSelection; regimentDrawbacks?: string[] };
    const slot = sys.regimentSelection;
    if (slot === undefined) return undefined;
    return {
        homeWorld: slot.homeWorld ?? '',
        commandingOfficer: slot.commandingOfficer ?? '',
        regimentType: slot.regimentType ?? '',
        trainingDoctrines: [...slot.trainingDoctrines],
        specialEquipmentDoctrines: [...slot.specialEquipmentDoctrines],
        drawbacks: [...(sys.regimentDrawbacks ?? [])],
        favouredWeapons: {
            basic: slot.favouredWeapons.basic ?? '',
            heavy: slot.favouredWeapons.heavy ?? '',
        },
    };
}

function readPicksFromActor(actor: WH40KBaseActor | null): Record<string, Record<string, string[]>> {
    // eslint-disable-next-line no-restricted-syntax -- boundary: regimentChoices lives on the per-system OW actor schema; not exposed on the abstract WH40KBaseActor system surface
    const stored = actor === null ? undefined : (actor.system as { regimentChoices?: Record<string, RegimentPicks> }).regimentChoices;
    return Object.fromEntries(
        Object.entries(stored ?? {}).map(([optionId, picks]) => [
            optionId,
            Object.fromEntries(Object.entries(picks).map(([key, values]) => [key, [...values]])),
        ]),
    );
}

function readKitFromActor(actor: WH40KBaseActor | null): string[] {
    // eslint-disable-next-line no-restricted-syntax -- boundary: regimentKit lives on the per-system OW actor schema; not exposed on the abstract WH40KBaseActor system surface
    const stored = actor === null ? undefined : (actor.system as { regimentKit?: ReadonlyArray<{ id: string }> }).regimentKit;
    return (stored ?? []).map((entry) => entry.id);
}

/** Convenience opener for sheets / chat-card buttons. */
export function openRegimentBuilderDialog(
    opts: {
        actor?: WH40KBaseActor | null;
        selection?: RegimentSelection;
        catalog?: ReadonlyArray<RegimentCatalogEntry>;
    } = {},
): void {
    const dialog = new RegimentBuilderDialog(opts);
    void dialog.render({ force: true });
}

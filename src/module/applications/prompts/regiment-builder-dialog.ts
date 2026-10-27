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

import { applyRegimentToActor } from '../../actions/ow-regiment-apply.ts';
import type { WH40KBaseActor } from '../../documents/base-actor.ts';
import { choicesComplete, entriesInCategory, picksFor, type RegimentCatalogEntry, type RegimentPicks, togglePick } from '../../rules/ow-regiment-catalog.ts';
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
import { loadRegimentCatalog } from '../../utils/regiment-catalog.ts';
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

/** Every option id the selection holds, in category order. */
function selectedIds(selection: RegimentSelection): string[] {
    return [
        selection.homeWorld,
        selection.commandingOfficer,
        selection.regimentType,
        ...selection.trainingDoctrines,
        ...selection.specialEquipmentDoctrines,
        ...selection.drawbacks,
    ].filter((id): id is string => id !== undefined && id !== '');
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

    constructor(
        options: ApplicationV2Config.DefaultOptions & {
            actor?: WH40KBaseActor | null;
            selection?: RegimentSelection;
            catalog?: ReadonlyArray<RegimentCatalogEntry>;
        } = {},
    ) {
        super(options);
        this.actor = options.actor ?? null;
        this.selection = options.selection ?? readSelectionFromActor(this.actor) ?? emptyRegimentSelection();
        this.catalog = options.catalog ?? [];
        this.picks = readPicksFromActor(this.actor);
        this.kitIds = readKitFromActor(this.actor);
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
        return selectedIds(this.selection).some((id) => {
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
        };
    }

    static async #onToggleOption(this: RegimentBuilderDialog, event: Event, target: HTMLElement): Promise<void> {
        event.preventDefault();
        const categoryStr = target.dataset['category'];
        const optionId = target.dataset['optionId'];
        if (typeof categoryStr !== 'string' || typeof optionId !== 'string' || optionId === '') return;
        if (!isRegimentCategory(categoryStr)) return;
        this.selection = toggleSelection(this.selection, categoryStr, optionId);
        // Picks belong to a selected option; drop those of any option no longer held.
        const held = new Set(selectedIds(this.selection));
        this.picks = Object.fromEntries(Object.entries(this.picks).filter(([id]) => held.has(id)));
        await this.render();
    }

    static async #onPickChoice(this: RegimentBuilderDialog, event: Event, target: HTMLElement): Promise<void> {
        event.preventDefault();
        const { optionId, choiceKey, value } = target.dataset;
        if (optionId === undefined || choiceKey === undefined || value === undefined) return;
        const choice = this.catalog.find((entry) => entry.id === optionId)?.choices.find((candidate) => candidate.key === choiceKey);
        if (choice === undefined) return;
        const forOption = this.picks[optionId] ?? {};
        this.picks = { ...this.picks, [optionId]: { ...forOption, [choiceKey]: togglePick(forOption[choiceKey] ?? [], value, choice.count) } };
        await this.render();
    }

    static async #onAddKit(this: RegimentBuilderDialog, event: Event, target: HTMLElement): Promise<void> {
        event.preventDefault();
        const optionId = target.dataset['optionId'];
        if (optionId === undefined || optionId === '') return;
        const max = this.catalog.find((entry) => entry.id === optionId)?.maxCount ?? 1;
        if (this.kitIds.filter((id) => id === optionId).length >= max) return;
        this.kitIds = [...this.kitIds, optionId];
        await this.render();
    }

    static async #onRemoveKit(this: RegimentBuilderDialog, event: Event, target: HTMLElement): Promise<void> {
        event.preventDefault();
        const optionId = target.dataset['optionId'];
        const at = this.kitIds.lastIndexOf(optionId ?? '');
        if (at < 0) return;
        this.kitIds = this.kitIds.filter((_id, index) => index !== at);
        await this.render();
    }

    static async #onCommit(this: RegimentBuilderDialog, event: Event, _target: HTMLElement): Promise<void> {
        event.preventDefault();
        const result = computeRegimentBudget(this.selection, this.catalog);
        if (!result.valid || this.#incompleteChoices()) return; // template also disables the button

        if (this.actor !== null) {
            const kit = this.kitIds.map((id) => ({ id, cost: this.catalog.find((entry) => entry.id === id)?.cost ?? 0 }));
            await this.actor.update({
                'system.regimentSelection.homeWorld': this.selection.homeWorld ?? '',
                'system.regimentSelection.commandingOfficer': this.selection.commandingOfficer ?? '',
                'system.regimentSelection.regimentType': this.selection.regimentType ?? '',
                'system.regimentSelection.trainingDoctrines': [...this.selection.trainingDoctrines],
                'system.regimentSelection.specialEquipmentDoctrines': [...this.selection.specialEquipmentDoctrines],
                'system.regimentDrawbacks': [...this.selection.drawbacks],
                'system.regimentKit': kit,
                'system.==regimentChoices': this.picks,
            });
            await applyRegimentToActor(this.actor, selectedIds(this.selection), this.picks);
            await applyRegimentLogistics(this.actor, aggregateRegimentGrants(this.selection, this.catalog).logistics ?? 0);
        }
        await this.close();
    }

    static async #onCancel(this: RegimentBuilderDialog, event: Event, _target: HTMLElement): Promise<void> {
        event.preventDefault();
        await this.close();
    }

    /** Convenience opener, mirrors `ColonyGrowthDialog.show`. Loads the catalog from the OW packs first. */
    static async show(actor: WH40KBaseActor, catalog?: ReadonlyArray<RegimentCatalogEntry>): Promise<RegimentBuilderDialog> {
        const dialog = new RegimentBuilderDialog({ actor, catalog: catalog ?? (await loadRegimentCatalog()) });
        void dialog.render({ force: true });
        return dialog;
    }
}

/** The squad Logistics Rating bonus last applied by a regiment commit, kept so a re-commit swaps rather than stacks. */
const LOGISTICS_FLAG = 'regimentLogisticsApplied';

async function applyRegimentLogistics(actor: WH40KBaseActor, bonus: number): Promise<void> {
    const previous = actor.getFlag('wh40k-rpg', LOGISTICS_FLAG);
    const applied = typeof previous === 'number' ? previous : 0;
    if (applied === bonus) return;
    // eslint-disable-next-line no-restricted-syntax -- boundary: logisticsRating lives on the per-system OW actor schema; not exposed on the abstract WH40KBaseActor system surface
    const current = (actor.system as { logisticsRating?: number }).logisticsRating;
    if (typeof current === 'number') await actor.update({ 'system.logisticsRating': current - applied + bonus });
    await actor.setFlag('wh40k-rpg', LOGISTICS_FLAG, bonus);
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

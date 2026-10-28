import { type OriginChoiceOption, resolveActiveModifiers } from '../../rules/origin-active-modifiers.ts';
import { REGIMENT_OPTION_CATEGORIES, type RegimentOptionCategory } from '../../rules/ow-regiment-creation.ts';
import type { RegimentPresetData } from '../../rules/ow-regiment-preset.ts';
import { formatSigned } from '../../utils/format.ts';
import { ORIGIN_STEP_CHOICES } from '../../utils/origin-step-choices.ts';
import ItemDataModel from '../abstract/item-data-model.ts';
import IdentifierField from '../fields/identifier-field.ts';
import DescriptionTemplate from '../shared/description-template.ts';
import ModifiersTemplate from '../shared/modifiers-template.ts';
import { originStepLabel } from '../shared/origin-steps.ts';

/**
 * Aptitude-derivation surface (#381). The pure logic lives in the Foundry-free
 * sibling `aptitude-derivation.ts` (directly unit-testable, importable by the
 * character actor DataModel without dragging in this heavy class cascade);
 * re-exported here so the origin path stays the discoverable home for "how the
 * origin path's aptitudes are derived".
 */
export { type AptitudeDerivation, type AptitudeGrantSource, collectGrantedAptitudes, deriveAptitudes, extractLegacyElectives } from './aptitude-derivation.ts';

/**
 * A single prerequisite gating a career Rank-1 advance. `type` is one of
 * `characteristic` / `skill` / `talent` / `trait`; `value` is present for
 * characteristic thresholds.
 */
interface CareerAdvancePrerequisite {
    type: string;
    key: string;
    value?: number;
}

/** One stack of a compendium item a regiment kit line issues. */
function regimentGearField(): foundry.data.fields.SchemaField<foundry.data.fields.DataSchema> {
    const fields = foundry.data.fields;
    return new fields.SchemaField({
        uuid: new fields.StringField({ required: true, blank: false }),
        quantity: new fields.NumberField({ required: true, initial: 1, min: 1, integer: true }),
    });
}

/**
 * Data model for Origin Path items (homeworld, birthright, career, etc).
 * @extends ItemDataModel
 * @mixes DescriptionTemplate
 * @mixes ModifiersTemplate
 */
export default class OriginPathData extends ItemDataModel.mixin(DescriptionTemplate, ModifiersTemplate) {
    // Typed property declarations matching defineSchema()
    declare identifier: string;
    declare step: string;
    declare stepIndex: number;
    declare positions: number[];
    declare gameSystem: string;
    declare xpCost: number;
    declare prerequisites: Array<{ type: string; key: string; value?: number }>;
    declare source: { book: string; page: string; custom: string };
    declare isAdvancedOrigin: boolean;
    declare replacesOrigins: string[];
    declare requirements: { text: string; previousSteps: string[]; excludedSteps: string[] };
    declare regimentPreset: RegimentPresetData;
    declare regiment: {
        category: RegimentOptionCategory | '';
        cost: number;
        kitBase: number | null;
        kitModifier: number;
        logistics: number;
        maxCount: number;
        restriction: string;
        favouredSlot: '' | 'basic' | 'heavy';
        replacesMainWeapon: string[];
        craftsmanship: '' | 'good' | 'best';
        additionalItem: string;
        kit: Array<{ label: string; scope: 'character' | 'squad'; mainWeapon: boolean; weapon: string; items: Array<{ uuid: string; quantity: number }> }>;
        items: Array<{ uuid: string; quantity: number }>;
    };
    declare grants: {
        woundsFormula: string;
        wounds: number;
        fateFormula: string;
        fateThreshold: number;
        blessedByEmperor: boolean;
        psyRating: number;
        skills: Array<{ name: string; specialization: string; level: string }>;
        talents: Array<{ name: string; specialization: string; uuid: string }>;
        traits: Array<{ name: string; level: number; uuid: string }>;
        aptitudes: string[];
        equipment: Array<{ name: string; quantity: number; uuid: string; craftsmanship?: string }>;
        specialAbilities: Array<{ name: string; description: string }>;
        choices: Array<{ type: string; label: string; name?: string; options: OriginChoiceOption[]; count: number; xpCost: number }>;
    };
    // Career advancement tables (RT careers only; null on every other origin step).
    // Content lives here on the compendium doc, indexed at `ready` by the career
    // advancement boot cache — see `config/advancements/career-advancement-cache.ts`.
    declare careerAdvancement: {
        characteristicCosts: Record<string, { simple: number; intermediate: number; trained: number; expert: number }>;
        rank1Advances: Array<{
            name: string;
            cost: number;
            type: string;
            specialization?: string;
            multiplier?: number;
            prerequisites: CareerAdvancePrerequisite[];
        }>;
    } | null;
    declare effectText: string;
    declare notes: string;
    declare selectedChoices: Record<string, string[]>;
    declare activeModifiers: Array<{
        source: string;
        type: string;
        key: string;
        value: number | null;
        itemUuid: string | null;
        specialization?: string;
        craftsmanship?: string;
    }>;
    declare homebrew: { throneGelt: string; thrones: string };
    declare rollResults: {
        wounds: { formula: string; rolled: number; breakdown: string; timestamp: number };
        fate: { formula: string; rolled: number; breakdown: string; timestamp: number };
        thrones: { formula: string; rolled: number; breakdown: string; timestamp: number };
    };

    // Properties from ModifiersTemplate
    declare modifiers: {
        characteristics: Record<string, number>;
        skills: Record<string, number>;
        combat: { attack: number; damage: number; penetration: number; defense: number; initiative: number; speed: number };
        resources: { wounds: number; fate: number; insanity: number; corruption: number };
        other: Array<{ key: string; label: string; value: number; mode: string }>;
        situational: {
            characteristics: Array<{ key: string; value: number; condition: string; icon: string }>;
            skills: Array<{ key: string; value: number; condition: string; icon: string }>;
            combat: Array<{ key: string; value: number; condition: string; icon: string }>;
        };
    };

    /** @inheritdoc */
    static override defineSchema(): Record<string, foundry.data.fields.DataField.Any> {
        const fields = foundry.data.fields;
        return {
            ...super.defineSchema(),

            // eslint-disable-next-line no-restricted-syntax -- boundary: IdentifierField extends StringField but Foundry types don't reflect that
            identifier: new (IdentifierField as unknown as typeof foundry.data.fields.StringField)({ required: true, blank: true }),

            // Origin path step
            step: new fields.StringField({
                required: true,
                initial: 'homeWorld',
                choices: [...ORIGIN_STEP_CHOICES],
            }),

            // Step order (for display)
            stepIndex: new fields.NumberField({ required: true, initial: 0, min: 0, max: 8, integer: true }),

            // Position(s) in the step's row (0-8)
            // Array of positions this origin occupies in the flowchart
            // Most origins have a single position [4], multi-position origins have multiple [1, 5]
            // Connectivity is automatically calculated as ±1 from each position
            positions: new fields.ArrayField(new fields.NumberField({ required: true, min: 0, max: 8 }), { required: true, initial: [] }),

            // Which game system this origin path belongs to
            gameSystem: new fields.StringField({
                required: true,
                initial: 'rt',
                choices: ['rt', 'dh2', 'dh1', 'bc', 'ow', 'dw'],
            }),

            // XP cost (for Into The Storm advanced origins)
            xpCost: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),

            /**
             * Structured gates a character must meet to take this step, in the shape
             * `utils/prerequisite-validator.ts` consumes: `{type, key, value}` where
             * `type` is `characteristic` | `skill` | `talent`.
             *
             * Elite Advances are the motivating case (#514): RAW gates each behind
             * characteristic / skill / talent minimums, the definitions lived in a
             * table in `src/` that nothing imported, and the dialog offered every
             * elite to every character on affordability alone. Authoring them here
             * is what lets the live validator do the checking.
             */
            prerequisites: new fields.ArrayField(new fields.ObjectField({ required: true }), { required: false, initial: [] }),

            // Source book information
            source: new fields.SchemaField({
                book: new fields.StringField({ required: false, blank: true }),
                page: new fields.StringField({ required: false, blank: true }),
                custom: new fields.StringField({ required: false, blank: true }),
            }),

            // Flags for alternate origins
            isAdvancedOrigin: new fields.BooleanField({ required: true, initial: false }),
            replacesOrigins: new fields.ArrayField(new fields.StringField({ required: true }), { required: true, initial: [] }),

            // Requirements to select this origin
            requirements: new fields.SchemaField({
                text: new fields.StringField({ required: false, blank: true }),
                previousSteps: new fields.ArrayField(new fields.StringField({ required: true }), { required: true, initial: [] }),
                excludedSteps: new fields.ArrayField(new fields.StringField({ required: true }), { required: true, initial: [] }),
            }),

            // Only War regiment-creation metadata (budget cost, kit effects). Empty on every other origin.
            regiment: new fields.SchemaField(
                {
                    category: new fields.StringField({
                        required: true,
                        blank: true,
                        initial: '',
                        choices: ['', ...REGIMENT_OPTION_CATEGORIES],
                    }),
                    // Regiment Creation points the option costs (a drawback's value is the points it refunds).
                    cost: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                    // Replaces the 30-point Standard Kit base (Penal Colony: 15). Null leaves it unchanged.
                    kitBase: new fields.NumberField({ required: false, nullable: true, initial: null, min: 0, integer: true }),
                    // Added to the Standard Kit allowance.
                    kitModifier: new fields.NumberField({ required: true, initial: 0, integer: true }),
                    // Added to the squad Logistics Rating.
                    logistics: new fields.NumberField({ required: true, initial: 0, integer: true }),
                    // Kit items: how many times the regiment may take the item.
                    maxCount: new fields.NumberField({ required: true, initial: 1, min: 1, integer: true }),
                    // Kit items that grant a further Favoured Weapon of this class when bought.
                    favouredSlot: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'basic', 'heavy'] }),
                    // Rule text limiting who may take the option (kit table "Limitations" column).
                    restriction: new fields.StringField({ required: false, blank: true, initial: '' }),
                    // Kit upgrades that swap the Main Weapon: the weapons (keys) the purchase can replace.
                    replacesMainWeapon: new fields.ArrayField(new fields.StringField({ required: true, blank: false }), { required: true, initial: [] }),
                    // Kit upgrades that improve one chosen kit item from Common to this craftsmanship.
                    craftsmanship: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'good', 'best'] }),
                    // Kit purchases that add one chosen item of this availability (a slug such as `rare`).
                    additionalItem: new fields.StringField({ required: true, blank: true, initial: '' }),
                    // Standard Regimental Kit a regiment type or doctrine issues, or the item a kit upgrade swaps in.
                    kit: new fields.ArrayField(
                        new fields.SchemaField({
                            label: new fields.StringField({ required: true, blank: false }),
                            scope: new fields.StringField({ required: true, initial: 'character', choices: ['character', 'squad'] }),
                            // The line is the Main Weapon; it replaces whichever came before it.
                            mainWeapon: new fields.BooleanField({ required: true, initial: false }),
                            // Which weapon it is (a slug), blank when the player picks between several.
                            weapon: new fields.StringField({ required: true, blank: true, initial: '' }),
                            // The compendium items the line issues (blank when the book names none the packs hold).
                            items: new fields.ArrayField(regimentGearField(), { required: true, initial: [] }),
                        }),
                        { required: true, initial: [] },
                    ),
                    // Kit purchases that add fixed items to the Standard Kit.
                    items: new fields.ArrayField(regimentGearField(), { required: true, initial: [] }),
                },
                { required: true },
            ),

            // Only War regiment preset: a whole regiment (the options chosen, their picks, the kit bought) to
            // start a character from. A preset sits in the Regiment step; empty everywhere else. Plain values:
            // the preset list reads them straight from the pack index.
            regimentPreset: new fields.SchemaField(
                {
                    homeWorld: new fields.StringField({ required: true, blank: true, initial: '' }),
                    commandingOfficer: new fields.StringField({ required: true, blank: true, initial: '' }),
                    regimentType: new fields.StringField({ required: true, blank: true, initial: '' }),
                    trainingDoctrines: new fields.ArrayField(new fields.StringField({ required: true, blank: false }), { required: true, initial: [] }),
                    specialEquipmentDoctrines: new fields.ArrayField(new fields.StringField({ required: true, blank: false }), { required: true, initial: [] }),
                    drawbacks: new fields.ArrayField(new fields.StringField({ required: true, blank: false }), { required: true, initial: [] }),
                    // Standard Kit purchases; an id repeats once per copy.
                    kit: new fields.ArrayField(new fields.StringField({ required: true, blank: false }), { required: true, initial: [] }),
                    // What was chosen for each kit purchase (a kit line to improve, an item UUID), parallel to `kit`.
                    kitPicks: new fields.ArrayField(new fields.StringField({ required: true, blank: true }), { required: true, initial: [] }),
                    // Favoured Weapon UUIDs, one per slot.
                    favouredWeapons: new fields.SchemaField({
                        basic: new fields.ArrayField(new fields.StringField({ required: true, blank: true }), { required: true, initial: [] }),
                        heavy: new fields.ArrayField(new fields.StringField({ required: true, blank: true }), { required: true, initial: [] }),
                    }),
                    // Picks made for the options: option id → choice key → picked values.
                    choices: new fields.ObjectField({ required: true, initial: {} }),
                    // A locked preset cannot be edited by players (the GM may).
                    locked: new fields.BooleanField({ required: true, initial: false }),
                },
                // Required (not `required: false`): an optional SchemaField is left undefined on documents that
                // never had it, and the Regiment Builder reads `.regimentType` / `.locked` off every origin item.
                { required: true },
            ),

            // What this origin grants
            grants: new fields.SchemaField({
                // Characteristic modifiers (already in ModifiersTemplate)

                // Wound formula - supports dice notation like "2xTB+1d5+2"
                woundsFormula: new fields.StringField({ required: false, blank: true, initial: '' }),

                // Fate formula - supports conditional notation like "(1-5|=2),(6-10|=3)"
                fateFormula: new fields.StringField({ required: false, blank: true, initial: '' }),

                // Burn-fate threshold — added to creature.ts:fate.threshold when grants apply.
                // Used by the cheat-death flow (core.md §"Fate Threshold").
                fateThreshold: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),

                // Blessed by Emperor (fate points on critical success)
                blessedByEmperor: new fields.BooleanField({ required: true, initial: false }),

                // Psy Rating granted for free by this step (e.g. the Psyker elite advance
                // sanctions a psyker at PR 1). XP-spend computation subtracts the cost of
                // this granted rating so the free starting rating isn't counted as bought.
                psyRating: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),

                // Skills granted (with training level)
                skills: new fields.ArrayField(
                    new fields.SchemaField({
                        name: new fields.StringField({ required: true }),
                        specialization: new fields.StringField({ required: false, blank: true }),
                        level: new fields.StringField({
                            required: true,
                            initial: 'trained',
                            // RT/DH1e/DW: trained, plus10, plus20
                            // DH2e/BC/OW: known, trained, experienced, veteran
                            choices: ['known', 'trained', 'plus10', 'experienced', 'plus20', 'veteran', 'plus30'],
                        }),
                    }),
                    { required: true, initial: [] },
                ),

                // Talents granted
                talents: new fields.ArrayField(
                    new fields.SchemaField({
                        name: new fields.StringField({ required: true }),
                        specialization: new fields.StringField({ required: false, blank: true }),
                        uuid: new fields.StringField({ required: false, blank: true }),
                    }),
                    { required: true, initial: [] },
                ),

                // Talents this step makes AVAILABLE TO PURCHASE (at their XP cost), not
                // grants — e.g. the Sister of Battle elite advance unlocks its nine
                // talents (DH2 Enemies Within pp38-39). Never added to the actor.
                unlockedTalents: new fields.ArrayField(
                    new fields.SchemaField({
                        name: new fields.StringField({ required: true }),
                        uuid: new fields.StringField({ required: false, blank: true }),
                    }),
                    { required: true, initial: [] },
                ),

                // Traits granted
                traits: new fields.ArrayField(
                    new fields.SchemaField({
                        name: new fields.StringField({ required: true }),
                        level: new fields.NumberField({ required: false, initial: null }),
                        uuid: new fields.StringField({ required: false, blank: true }),
                    }),
                    { required: true, initial: [] },
                ),

                // Aptitudes granted
                aptitudes: new fields.ArrayField(new fields.StringField({ required: true }), { required: true, initial: [] }),

                // Starting equipment
                equipment: new fields.ArrayField(
                    new fields.SchemaField({
                        name: new fields.StringField({ required: true }),
                        quantity: new fields.NumberField({ required: true, initial: 1 }),
                        uuid: new fields.StringField({ required: false, blank: true }),
                        // Issued at this craftsmanship (blank = the item's own)
                        craftsmanship: new fields.StringField({ required: false, blank: true }),
                    }),
                    { required: true, initial: [] },
                ),

                // Special abilities (text descriptions)
                specialAbilities: new fields.ArrayField(
                    new fields.SchemaField({
                        name: new fields.StringField({ required: true }),
                        description: new fields.HTMLField({ required: true }),
                    }),
                    { required: true, initial: [] },
                ),

                // Choices the player must make
                choices: new fields.ArrayField(
                    new fields.SchemaField({
                        type: new fields.StringField({ required: true }),
                        label: new fields.StringField({ required: true }),
                        options: new fields.ArrayField(new fields.ObjectField({ required: true }), { required: true }),
                        count: new fields.NumberField({ required: true, initial: 1, min: 1 }),
                        xpCost: new fields.NumberField({ required: false, initial: 0, min: 0 }),
                    }),
                    { required: true, initial: [] },
                ),
            }),

            // Career advancement tables (RT careers only). Content authored on the
            // compendium doc; the career advancement boot cache reads it at `ready`.
            // Null on every non-career origin step (only careers populate it).
            careerAdvancement: new fields.SchemaField(
                {
                    // characteristic key → { simple, intermediate, trained, expert } cost tiers.
                    characteristicCosts: new fields.ObjectField({ required: false, initial: {} }),
                    // Rank 1 skill/talent advance options.
                    rank1Advances: new fields.ArrayField(
                        new fields.SchemaField({
                            name: new fields.StringField({ required: true }),
                            cost: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                            type: new fields.StringField({ required: true, choices: ['skill', 'talent'] }),
                            specialization: new fields.StringField({ required: false, blank: true }),
                            multiplier: new fields.NumberField({ required: false, initial: null, min: 1, integer: true }),
                            prerequisites: new fields.ArrayField(new fields.ObjectField({ required: true }), { required: false, initial: [] }),
                        }),
                        { required: false, initial: [] },
                    ),
                },
                { required: false, nullable: true, initial: null },
            ),

            // Effect/flavor text
            effectText: new fields.HTMLField({ required: false, blank: true }),

            // Notes
            notes: new fields.StringField({ required: false, blank: true }),

            // Choice tracking - records player's selections for grants.choices
            selectedChoices: new fields.ObjectField({
                required: true,
                initial: {},
                // Structure: { "choiceLabel": ["selected option 1", "selected option 2"] }
            }),

            // Active modifiers from choices (calculated in prepareDerivedData)
            activeModifiers: new fields.ArrayField(
                new fields.SchemaField({
                    source: new fields.StringField({ required: true }), // Which choice this came from
                    type: new fields.StringField({ required: true }), // characteristic/skill/talent/equipment
                    key: new fields.StringField({ required: true }),
                    value: new fields.NumberField({ required: false }),
                    itemUuid: new fields.StringField({ required: false, blank: true }), // For fetching item details
                    specialization: new fields.StringField({ required: false, blank: true }), // For talents with composite specs e.g. "Weapon Training (Chain)"
                    craftsmanship: new fields.StringField({ required: false, blank: true }), // For equipment picks: issued at this craftsmanship (`value` is the quantity)
                }),
                { required: true, initial: [] },
            ),

            // Homebrew extensions (campaign-specific fields not in RAW)
            homebrew: new fields.SchemaField({
                throneGelt: new fields.StringField({ required: false, blank: true, initial: '' }),
                thrones: new fields.StringField({ required: false, blank: true, initial: '' }),
            }),

            // Roll results storage for interactive rolling
            rollResults: new fields.SchemaField({
                wounds: new fields.SchemaField({
                    formula: new fields.StringField({ required: false, blank: true }),
                    rolled: new fields.NumberField({ required: false, initial: null }),
                    breakdown: new fields.StringField({ required: false, blank: true }),
                    timestamp: new fields.NumberField({ required: false, initial: null }),
                }),
                fate: new fields.SchemaField({
                    formula: new fields.StringField({ required: false, blank: true }),
                    rolled: new fields.NumberField({ required: false, initial: null }),
                    breakdown: new fields.StringField({ required: false, blank: true }),
                    timestamp: new fields.NumberField({ required: false, initial: null }),
                }),
                thrones: new fields.SchemaField({
                    formula: new fields.StringField({ required: false, blank: true }),
                    rolled: new fields.NumberField({ required: false, initial: null }),
                    breakdown: new fields.StringField({ required: false, blank: true }),
                    timestamp: new fields.NumberField({ required: false, initial: null }),
                }),
            }),
        };
    }

    /* -------------------------------------------- */
    /*  Properties                                  */
    /* -------------------------------------------- */

    /**
     * Get all positions this origin occupies (for multi-parent support).
     * Returns array of positions where this origin appears in the chart.
     * @type {number[]}
     */
    get allPositions(): number[] {
        return this.positions.length > 0 ? [...this.positions].sort((a, b) => a - b) : [4]; // Default to center position if not set
    }

    /**
     * Get the primary (first) position for this origin.
     * Used for card placement in the chart.
     * @type {number}
     */
    get primaryPosition(): number {
        return this.allPositions[0] || 4;
    }

    /**
     * Get the step label.
     * @type {string}
     */
    get stepLabel(): string {
        return originStepLabel(this.step);
    }

    /**
     * Is this an advanced origin from Into The Storm?
     * @type {boolean}
     */
    get isAdvanced(): boolean {
        return this.isAdvancedOrigin || this.xpCost > 0;
    }

    /**
     * Get display string for XP cost.
     * @type {string}
     */
    get xpCostLabel(): string {
        return this.xpCost > 0 ? `${this.xpCost} XP` : '—';
    }

    /**
     * Does this origin have requirements?
     * @type {boolean}
     */
    get hasRequirements(): boolean {
        const reqs = this.requirements;
        return Boolean(reqs.text) || reqs.previousSteps.length > 0 || reqs.excludedSteps.length > 0;
    }

    /**
     * Does this origin have choices?
     * @type {boolean}
     */
    get hasChoices(): boolean {
        return this.grants.choices.length > 0;
    }

    /**
     * Get choices that still need selection.
     * @type {object[]}
     */
    get pendingChoices(): typeof this.grants.choices {
        return this.grants.choices.filter((choice) => {
            const selected = this.selectedChoices[choice.label];
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess: indexed access is `string[] | undefined` under main tsconfig, `string[]` under tsconfig.test.json (flag off); the guard satisfies both
            return (selected?.length ?? 0) < choice.count;
        });
    }

    /**
     * Check if all choices have been made.
     * @type {boolean}
     */
    get choicesComplete(): boolean {
        return this.pendingChoices.length === 0;
    }

    /**
     * Get the active modifiers derived from selected choices.
     * @type {object[]}
     */
    get derivedModifiers(): typeof this.activeModifiers {
        return this.activeModifiers;
    }

    /**
     * Get a summary of grants.
     * @type {object}
     */
    get grantsSummary(): string[] {
        const grants = this.grants;
        const summary: string[] = [];

        // Characteristics from modifiers
        const charMods = this.modifiers.characteristics;
        for (const [char, numVal] of Object.entries(charMods)) {
            if (numVal !== 0) {
                summary.push(`${char}: ${formatSigned(numVal)}`);
            }
        }

        if (grants.skills.length > 0) {
            summary.push(`Skills: ${grants.skills.map((s) => s.name).join(', ')}`);
        }

        if (grants.talents.length > 0) {
            summary.push(`Talents: ${grants.talents.map((t) => t.name).join(', ')}`);
        }

        if (grants.traits.length > 0) {
            summary.push(`Traits: ${grants.traits.map((t) => t.name).join(', ')}`);
        }

        if (grants.aptitudes.length > 0) {
            summary.push(`Aptitudes: ${grants.aptitudes.join(', ')}`);
        }

        return summary;
    }

    /* -------------------------------------------- */
    /*  Data Preparation                            */
    /* -------------------------------------------- */

    /** @override */
    override prepareDerivedData(): void {
        super.prepareDerivedData();
        this._calculateActiveModifiers();
    }

    /**
     * Calculate active modifiers from selected choices.
     * This populates the activeModifiers array based on what the player has chosen.
     * @private
     */
    _calculateActiveModifiers(): void {
        const activeModifiers = resolveActiveModifiers(this.grants.choices, this.selectedChoices);
        // Store the calculated modifiers
        // Note: This is safe because prepareDerivedData is called after the item is initialized
        // and we're just updating a derived field, not modifying source data
        if (JSON.stringify(this.activeModifiers) !== JSON.stringify(activeModifiers)) {
            this.activeModifiers = activeModifiers;
        }
    }

    /* -------------------------------------------- */
    /*  Data Migration                              */
    /* -------------------------------------------- */

    /**
     * Normalize origin path data shape.
     * @param {object} source  The source data
     * @protected
     */
    // eslint-disable-next-line no-restricted-syntax -- boundary: Foundry migration source is untyped legacy data
    static override _migrateData(source: Record<string, unknown>): void {
        super._migrateData(source);
    }

    /* -------------------------------------------- */
    /*  Data Cleaning                               */
    /* -------------------------------------------- */

    /**
     * Clean origin path data.
     * @param {object} source     The source data
     * @param {object} options    Additional options
     * @protected
     */
    // eslint-disable-next-line no-restricted-syntax -- boundary: Foundry _cleanData receives untyped legacy source
    static override _cleanData(source: Record<string, unknown> | undefined, options: DataModelV14.CleaningOptions): void {
        super._cleanData(source, options);
    }

    /* -------------------------------------------- */
    /*  Chat Properties                             */
    /* -------------------------------------------- */

    /** @override */
    get chatProperties(): string[] {
        return [this.stepLabel, ...this.grantsSummary];
    }

    /* -------------------------------------------- */
    /*  Header Labels                               */
    /* -------------------------------------------- */

    /** @override */
    // eslint-disable-next-line no-restricted-syntax -- boundary: headerLabels is a free-form record consumed by sheet templates
    get headerLabels(): Record<string, unknown> | Array<Record<string, unknown>> {
        return {
            step: this.stepLabel,
            stepIndex: this.stepIndex + 1,
        };
    }
}

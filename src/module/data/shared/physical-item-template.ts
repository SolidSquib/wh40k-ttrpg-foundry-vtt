import { availabilityDisplayLabel, type PlaceRating, placeRatingLabels } from '../../utils/config-choices.ts';
import SystemDataModel from '../abstract/system-data-model.ts';

/** Availability rating keys: the configured ratings, or the full RAW list before CONFIG is ready. */
function availabilityChoices(): string[] {
    const keys = Object.keys(CONFIG.wh40k.availabilities);
    return keys.length > 0
        ? keys
        : ['ubiquitous', 'abundant', 'plentiful', 'common', 'average', 'scarce', 'rare', 'very-rare', 'extremely-rare', 'near-unique', 'unique', 'uncommon'];
}

/**
 * Template for physical items with weight and availability.
 * @mixin
 */
export default class PhysicalItemTemplate extends SystemDataModel {
    // Typed property declarations matching defineSchema()
    declare weight: number;
    declare availability: string;
    declare availabilityByPlace: PlaceRating[];
    declare availabilityRestriction: string;
    declare craftsmanship: string;
    declare quantity: number;
    declare bound: boolean;
    declare variantOf: string;
    declare homebrew: {
        inventory: {
            profiles: Set<string>;
            weight: number | null;
        };
    };
    declare cost: {
        logistics: number | null;
    };

    /** @inheritdoc */
    static override defineSchema(): Record<string, foundry.data.fields.DataField.Any> {
        const fields = foundry.data.fields;
        return {
            weight: new fields.NumberField({
                required: true,
                nullable: false,
                initial: 0,
                min: 0,
            }),
            // The general rating — for a place-qualified print, the "elsewhere" value.
            availability: new fields.StringField({
                required: true,
                initial: 'common',
                choices: availabilityChoices,
            }),
            // Ratings a book prints for named places ("Scarce (Volg) or Very Rare
            // (elsewhere)"); `availability` above stays the general value.
            availabilityByPlace: new fields.ArrayField(
                new fields.SchemaField({
                    place: new fields.StringField({ required: true, blank: false }),
                    availability: new fields.StringField({ required: true, initial: 'common', choices: availabilityChoices }),
                }),
                { required: false, initial: [] },
            ),
            // The restriction words a book prints in place of a rarity ("Special",
            // "Inquisition only"); blank when it prints a rarity. When set, the item
            // shows these words and its `availability` is the unprinted default.
            availabilityRestriction: new fields.StringField({ required: true, blank: true, initial: '' }),
            craftsmanship: new fields.StringField({
                required: true,
                initial: 'common',
                choices: () => {
                    const keys = Object.keys(CONFIG.wh40k.craftsmanships);
                    return keys.length > 0 ? keys : ['poor', 'common', 'good', 'best'];
                },
            }),
            quantity: new fields.NumberField({
                required: true,
                nullable: false,
                initial: 1,
                min: 0,
                integer: true,
            }),
            // Bound (undroppable / untradable) flag. Content-agnostic primitive:
            // when true the item cannot be dropped to the scene or transferred to
            // another actor (#390) — used for the default Unarmed weapon (#228),
            // quest items, and bound gear. GM-editable on the item sheet.
            bound: new fields.BooleanField({ required: true, initial: false }),
            // Variant linkage (see docs/pack-authoring.md "Variants"). `variantOf`
            // is the Foundry UUID of the standard / most-vanilla variant this
            // item is a variant of — '' when this item IS that base variant.
            // A manufacturing pattern (Godwyn-Pattern Bolter) is just one kind
            // of variant; the variant's identity lives in its own `name`, and
            // `variantOf` points back to the vanilla base. Shared identity,
            // never variantized; resolved at render time via uuidNameCache like
            // other UUID-primary references.
            variantOf: new fields.StringField({ required: false, blank: true, initial: '' }),
            // Inventory-generator tagging. Content-agnostic primitive: a free
            // set of profile tags + an optional relative draw weight. The tag
            // *values* (vendor types / armoury tiers) live in compendium
            // `_source/*.json`, never in `src/` (Direction #7). The generator
            // discovers the available profiles by scanning the packs at
            // runtime — nothing here enumerates them.
            homebrew: new fields.SchemaField({
                inventory: new fields.SchemaField({
                    profiles: new fields.SetField(new fields.StringField({ required: true, blank: false }), {
                        required: true,
                        initial: [],
                    }),
                    weight: new fields.NumberField({ required: false, nullable: true, initial: null, min: 0 }),
                }),
            }),
            cost: new fields.SchemaField({
                logistics: new fields.NumberField({ required: false, nullable: true, initial: null, min: 0 }),
            }),
        };
    }

    /* -------------------------------------------- */
    /*  Data Migration                              */
    /* -------------------------------------------- */

    /**
     * Migrate physical item data.
     * @param {object} source  The source data
     * @protected
     */
    // eslint-disable-next-line no-restricted-syntax -- boundary: Foundry DataModel._migrateData receives raw unknown source data before schema validation
    static override _migrateData(source: Record<string, unknown>): void {
        super._migrateData(source);
        PhysicalItemTemplate.#migrateCost(source);
        PhysicalItemTemplate.#migrateHomebrew(source);
    }

    /**
     * Normalize the homebrew inventory-tag field shape so legacy documents
     * authored before the field existed validate under V14 strict mode.
     * @param {object} source  The source data
     */
    // eslint-disable-next-line no-restricted-syntax -- boundary: migration helper receives raw source from _migrateData before schema validation
    static #migrateHomebrew(source: Record<string, unknown>): void {
        interface HomebrewShape {
            inventory?: {
                profiles?: unknown; // eslint-disable-line no-restricted-syntax -- boundary: pre-migration field value may be any type before schema validation
                weight?: unknown; // eslint-disable-line no-restricted-syntax -- boundary: pre-migration field value may be any type before schema validation
            };
        }
        const raw = (source['homebrew'] ?? {}) as HomebrewShape;
        const inv = raw.inventory ?? {};

        const profilesRaw = inv.profiles;
        const profiles = Array.isArray(profilesRaw)
            ? profilesRaw.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim())
            : [];

        const weightRaw = inv.weight;
        let weight: number | null = null;
        if (weightRaw !== null && weightRaw !== undefined && weightRaw !== '') {
            const numeric = Number(weightRaw);
            if (Number.isFinite(numeric) && numeric >= 0) weight = numeric;
        }

        source['homebrew'] = { inventory: { profiles, weight } };
    }

    /**
     * Normalize the cost block to `{ logistics }`.
     *
     * Older data carried a per-line block (`cost.ow.logistics`, plus other lines'
     * and a throne-gelt value). Those are read here and discarded: Only War's
     * branch wins, then an already-flat value.
     * @param {object} source  The source data
     */
    // eslint-disable-next-line no-restricted-syntax -- boundary: migration helper receives raw source from _migrateData
    static #migrateCost(source: Record<string, unknown>): void {
        // eslint-disable-next-line no-restricted-syntax -- boundary: normalizeNullableNumber receives raw field values from pre-migration source data
        const normalizeNullableNumber = (value: unknown): number | null => {
            if (value === null || value === undefined || value === '') return null;
            const numericValue = Number(value);
            if (!Number.isFinite(numericValue)) return null;
            return numericValue;
        };

        if (source['cost'] === null || source['cost'] === undefined || typeof source['cost'] !== 'object') {
            source['cost'] = { logistics: null };
            return;
        }

        interface LegacyCost {
            logistics?: unknown; // eslint-disable-line no-restricted-syntax -- boundary: pre-migration numeric field value may be any type
            ow?: { logistics?: unknown }; // eslint-disable-line no-restricted-syntax -- boundary: pre-migration numeric field value may be any type
        }
        const cost = source['cost'] as LegacyCost;

        source['cost'] = {
            logistics: normalizeNullableNumber(cost.ow?.logistics) ?? normalizeNullableNumber(cost.logistics),
        };
    }

    /* -------------------------------------------- */
    /*  Data Cleaning                               */
    /* -------------------------------------------- */

    /**
     * Clean physical item template data.
     * @param {object} source     The source data
     * @param {object} options    Additional options
     * @protected
     */
    // eslint-disable-next-line no-restricted-syntax -- boundary: Foundry DataModel._cleanData receives raw source before schema validation
    static override _cleanData(source: Record<string, unknown> | undefined, options?: DataModelV14.CleaningOptions): void {
        super._cleanData(source, options);
    }

    /* -------------------------------------------- */

    /**
     * Get the total weight considering quantity.
     * @type {number}
     */
    get totalWeight(): number {
        return this.weight * (this.quantity || 1);
    }

    /* -------------------------------------------- */

    /**
     * Get the availability label: the printed restriction words when the item
     * carries them, else the localized rarity.
     * @type {string}
     */
    get availabilityLabel(): string {
        // Read the rating's own label key: capitalising the id broke hyphenated
        // ratings (`very-rare` → `WH40K.Availability.Very-rare`, an unknown key).
        return availabilityDisplayLabel(CONFIG.wh40k.availabilities, this.availability, this.availabilityRestriction);
    }

    /**
     * Localized place-qualified ratings, e.g. "Scarce (Volg)".
     * @type {string[]}
     */
    get availabilityByPlaceLabels(): string[] {
        return placeRatingLabels(CONFIG.wh40k.availabilities, this.availabilityByPlace);
    }

    /* -------------------------------------------- */

    /**
     * Get localized craftsmanship label.
     * @type {string}
     */
    get craftsmanshipLabel(): string {
        return game.i18n.localize(`WH40K.Craftsmanship.${this.craftsmanship.capitalize()}`);
    }

    /* -------------------------------------------- */

    /**
     * Properties for chat display.
     * @type {string[]}
     */
    get chatProperties(): string[] {
        const props: string[] = [];
        if (this.weight) props.push(`${this.weight} kg`);
        if (this.availability) props.push(this.availabilityLabel);
        props.push(...this.availabilityByPlaceLabels);
        if (this.craftsmanship && this.craftsmanship !== 'common') {
            props.push(this.craftsmanshipLabel);
        }
        return props;
    }

    /* -------------------------------------------- */

    /**
     * Baseline Foundry-standard price for third-party economy/merchant plugins
     * (Item Piles, Loot Sheet, …). Derived, never authored: the item's Logistics
     * cost. The structured `system.cost` remains the source of truth.
     * @type {{ value: number | null; denomination: string }}
     */
    get price(): { value: number | null; denomination: string } {
        return { value: this.cost.logistics, denomination: 'logistics' };
    }
}

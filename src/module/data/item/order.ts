import { SHIP_ACTION_EFFECTS, type ShipActionEffect } from '../../rules/ship-crew-morale.ts';
import { formatSigned } from '../../utils/format.ts';
import ItemDataModel from '../abstract/item-data-model.ts';
import IdentifierField from '../fields/identifier-field.ts';
import DescriptionTemplate from '../shared/description-template.ts';

/** Only War ground-order fields (Comrade orders bought with XP). Empty on every ship order. */
export interface GroundOrder {
    /** The printed Type: a plain Order, a Sweeping Order, an Attack Order, or a Passive. */
    type: '' | 'order' | 'sweeping' | 'attack' | 'passive';
    /** The action the Order costs, as printed. */
    action: '' | 'half' | 'full' | 'free' | 'special' | 'halfOrFull';
    /** Basic or Veteran, where the book prints it (a Veteran Order needs a Veteran Comrade). */
    level: '' | 'basic' | 'veteran';
    /** Which chapter section lists it. */
    group: '' | 'general' | 'enginseer' | 'priest' | 'ogryn' | 'ratling' | 'servitor';
    prerequisites: { text: string; characteristics: Record<string, number>; skills: string[]; talents: string[] };
    aptitudes: string[];
    /** XP price by number of matching Aptitudes. */
    xpCost: { two: number; one: number; zero: number };
}

/**
 * Data model for Order items (ship orders/commands, and Only War ground orders).
 * @extends ItemDataModel
 * @mixes DescriptionTemplate
 */
export default class OrderData extends ItemDataModel.mixin(DescriptionTemplate) {
    // Typed property declarations matching defineSchema()
    declare identifier: string;
    declare category: string;
    declare actionType: string;
    declare test: { skill: string; characteristic: string; modifier: number };
    declare requirements: string;
    declare effect: string;
    declare failure: string;
    declare notes: string;

    /**
     * Optional content-agnostic effect identifier (issue #189). Compendium
     * Hold Fast! / Triage entries tag themselves with the matching primitive
     * (`cancelPriorTurnDamage` / `replenishMorale`) so the document layer
     * can route the dispatch into the RT Crew/Morale economy without
     * string-matching display names. Empty string ⇒ no built-in effect.
     */
    declare shipActionEffect: ShipActionEffect | '';

    /** Only War ground-order details; `type` is empty on a ship order. */
    declare ground: GroundOrder;

    /** @inheritdoc */
    static override defineSchema(): Record<string, foundry.data.fields.DataField.Any> {
        const fields = foundry.data.fields;
        return {
            ...super.defineSchema(),

            // eslint-disable-next-line no-restricted-syntax -- boundary: IdentifierField extends `any`; the as-unknown chain satisfies DataField.Any brand without runtime effect
            identifier: new IdentifierField({ required: true, blank: true }) as unknown as foundry.data.fields.DataField.Any,

            // Order category
            category: new fields.StringField({
                required: true,
                initial: 'combat',
                choices: ['combat', 'maneuver', 'command', 'support', 'special', 'ground'],
            }),

            // Action type
            actionType: new fields.StringField({
                required: true,
                initial: 'extended-action',
                choices: ['extended-action', 'reaction', 'shooting-action', 'maneuver-action'],
            }),

            // Required test
            test: new fields.SchemaField({
                skill: new fields.StringField({ required: true, initial: 'command', blank: true }),
                characteristic: new fields.StringField({ required: false, blank: true }),
                modifier: new fields.NumberField({ required: true, initial: 0, integer: true }),
            }),

            // Requirements
            requirements: new fields.HTMLField({ required: false, blank: true }),

            // Effect on success
            effect: new fields.HTMLField({ required: true, blank: true }),

            // Failure consequences
            failure: new fields.HTMLField({ required: false, blank: true }),

            // Notes
            notes: new fields.StringField({ required: false, blank: true }),

            // RT Crew/Morale economy hook (issue #189). Compendium opt-in.
            shipActionEffect: new fields.StringField({
                required: false,
                initial: '',
                blank: true,
                choices: ['', ...SHIP_ACTION_EFFECTS],
            }),

            // Only War ground orders (issued to a Comrade, bought with XP). Plain values: the catalog and
            // the Advancement dialog read them straight from the pack index.
            ground: new fields.SchemaField({
                type: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'order', 'sweeping', 'attack', 'passive'] }),
                action: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'half', 'full', 'free', 'special', 'halfOrFull'] }),
                level: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'basic', 'veteran'] }),
                group: new fields.StringField({
                    required: true,
                    blank: true,
                    initial: '',
                    choices: ['', 'general', 'enginseer', 'priest', 'ogryn', 'ratling', 'servitor'],
                }),
                prerequisites: new fields.SchemaField({
                    text: new fields.StringField({ required: false, blank: true, initial: '' }),
                    characteristics: new fields.ObjectField({ required: false, initial: {} }),
                    skills: new fields.ArrayField(new fields.StringField({ required: true, blank: false }), { required: false, initial: [] }),
                    talents: new fields.ArrayField(new fields.StringField({ required: true, blank: false }), { required: false, initial: [] }),
                }),
                aptitudes: new fields.ArrayField(new fields.StringField({ required: true, blank: false }), { required: true, initial: [] }),
                xpCost: new fields.SchemaField({
                    two: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                    one: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                    zero: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
                }),
            }),
        };
    }

    /* -------------------------------------------- */
    /*  Properties                                  */
    /* -------------------------------------------- */

    /** @override */
    get isRollable(): boolean {
        return true;
    }

    /**
     * Get the category label.
     * @type {string}
     */
    get categoryLabel(): string {
        return game.i18n.localize(`WH40K.OrderCategory.${this.category.capitalize()}`);
    }

    /** True for an Only War ground order (a Comrade order bought with XP). */
    get isGround(): boolean {
        return this.ground.type !== '';
    }

    /** "Sweeping Order (Free Action)" — the Type line as printed, from the ground-order fields. */
    get groundLabel(): string {
        const { type, action } = this.ground;
        const typeLabel = game.i18n.localize(`WH40K.OrderGround.Type.${type.capitalize()}`);
        return action === '' ? typeLabel : `${typeLabel} (${game.i18n.localize(`WH40K.OrderGround.Action.${action.capitalize()}`)})`;
    }

    /**
     * Pill descriptor consumed by item-list-row.hbs for the category badge.
     */
    get pill(): { bgClass: string; textClass: string; icon: string; label: string } {
        const map: Record<string, { bgClass: string; textClass: string; icon: string }> = {
            combat: { bgClass: 'tw-bg-[rgba(239,68,68,0.2)]', textClass: 'tw-text-[#ef4444]', icon: 'fa-crosshairs' },
            maneuver: { bgClass: 'tw-bg-[rgba(59,130,246,0.2)]', textClass: 'tw-text-[#3b82f6]', icon: 'fa-route' },
            command: { bgClass: 'tw-bg-[rgba(245,158,11,0.2)]', textClass: 'tw-text-[#f59e0b]', icon: 'fa-bullhorn' },
            support: { bgClass: 'tw-bg-[rgba(34,197,94,0.2)]', textClass: 'tw-text-[#22c55e]', icon: 'fa-hands-helping' },
            special: { bgClass: 'tw-bg-[rgba(139,92,246,0.2)]', textClass: 'tw-text-[#8b5cf6]', icon: 'fa-star' },
            ground: { bgClass: 'tw-bg-[rgba(245,158,11,0.2)]', textClass: 'tw-text-[#f59e0b]', icon: 'fa-people-arrows' },
        };
        const fallback = { bgClass: 'tw-bg-[rgba(0,0,0,0.1)]', textClass: 'tw-text-[color:var(--wh40k-text-muted)]', icon: 'fa-ship' };
        return { ...(map[this.category] ?? fallback), label: this.categoryLabel };
    }

    /**
     * Get the action type label.
     * @type {string}
     */
    get actionTypeLabel(): string {
        return game.i18n.localize(
            `WH40K.ActionType.${this.actionType
                .split('-')
                .map((s) => s.capitalize())
                .join('')}`,
        );
    }

    /**
     * Get the test description.
     * @type {string}
     */
    get testLabel(): string {
        const { skill, modifier } = this.test;
        let label = skill;
        if (modifier !== 0) {
            label += ` ${formatSigned(modifier)}`;
        }
        return label;
    }

    /* -------------------------------------------- */
    /*  Chat Properties                             */
    /* -------------------------------------------- */

    /** @override */
    get chatProperties(): string[] {
        if (this.isGround) return [this.groundLabel, ...(this.ground.aptitudes.length > 0 ? [this.ground.aptitudes.join(', ')] : [])];
        const props = [this.categoryLabel, this.actionTypeLabel, `Test: ${this.testLabel}`];

        return props;
    }

    /* -------------------------------------------- */
    /*  Header Labels                               */
    /* -------------------------------------------- */

    // eslint-disable-next-line no-restricted-syntax -- boundary: headerLabels is a free-form record consumed by sheet templates
    get headerLabels(): Record<string, unknown> | Array<Record<string, unknown>> {
        if (this.isGround) return { category: this.categoryLabel, action: this.groundLabel };
        return {
            category: this.categoryLabel,
            action: this.actionTypeLabel,
            test: this.testLabel,
        };
    }
}

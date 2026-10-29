/**
 * @file AmmoSheet - ApplicationV2 sheet for ammunition items
 */

import type AmmunitionData from '../../data/item/ammunition.ts';
import type { WH40KItemDocument } from '../../types/global.d.ts';
import { loadQualityChoices, weaponQualityPack } from '../../utils/weapon-quality-choices.ts';
import { WH40KSettings } from '../../wh40k-rpg-settings.ts';
import SetFieldActionsMixin from '../api/set-field-actions-mixin.ts';
import BaseItemSheet from './base-item-sheet.ts';

/** Ammunition item with its system data typed to the AmmunitionData DataModel. */
type AmmoItem = WH40KItemDocument & { system: AmmunitionData };

/** Tab label localization keys, hoisted so the static TABS entries reference identifiers. */
const TAB_LABEL_MODIFIERS = 'WH40K.Tabs.Modifiers';
const TAB_LABEL_COMPATIBILITY = 'WH40K.Tabs.Compatibility';
const TAB_LABEL_QUALITIES = 'WH40K.Tabs.Qualities';
const TAB_LABEL_DETAILS = 'WH40K.Tabs.Details';

/**
 * Sheet for ammunition items.
 * Displays modifiers with stat bar and weapon compatibility.
 */
export default class AmmoSheet extends SetFieldActionsMixin(BaseItemSheet<AmmoItem>) {
    /** @override */
    /* eslint-disable @typescript-eslint/unbound-method -- ApplicationV2 actions accept method references and bind `this` itself */
    static override DEFAULT_OPTIONS = {
        ...BaseItemSheet.DEFAULT_OPTIONS,
        classes: ['wh40k-rpg', 'sheet', 'item', 'ammunition'],
        position: {
            width: 620,
            height: 760,
        },
        actions: {
            ...BaseItemSheet.DEFAULT_OPTIONS.actions,
            addQuality: AmmoSheet.#addQuality,
            removeAddedQuality: AmmoSheet.#removeAddedQuality,
            removeRemovedQuality: AmmoSheet.#removeRemovedQuality,
        },
    } satisfies typeof BaseItemSheet.DEFAULT_OPTIONS & Partial<ApplicationV2Config.DefaultOptions>;
    /* eslint-enable @typescript-eslint/unbound-method */

    /* -------------------------------------------- */

    /** @override */
    static override PARTS = {
        sheet: {
            template: 'systems/wh40k-rpg/templates/item/item-ammo-sheet.hbs',
            scrollable: ['.wh40k-tab-content'],
        },
    };

    /* -------------------------------------------- */

    /** @override */
    static override TABS = [
        { tab: 'modifiers', group: 'primary', label: TAB_LABEL_MODIFIERS },
        { tab: 'compatibility', group: 'primary', label: TAB_LABEL_COMPATIBILITY },
        { tab: 'qualities', group: 'primary', label: TAB_LABEL_QUALITIES },
        { tab: 'details', group: 'primary', label: TAB_LABEL_DETAILS },
    ];

    /* -------------------------------------------- */

    /** @override */
    override tabGroups: Record<string, string> = {
        primary: 'modifiers',
    };

    /* -------------------------------------------- */
    /*  Context Preparation                         */
    /* -------------------------------------------- */

    /** @override */
    // eslint-disable-next-line no-restricted-syntax -- boundary: _prepareContext returns free-form template context; Record<string, unknown> is the required base shape
    override async _prepareContext(options: ApplicationV2Config.RenderOptions): Promise<Record<string, unknown>> {
        const context = await super._prepareContext(options);

        // Add CONFIG reference for templates
        context['CONFIG'] = CONFIG;

        // The Set fields as plain lists: Handlebars cannot call a context function as a helper
        const system = this.item.system;
        context['addedQualities'] = Array.from(system.addedQualities);
        context['removedQualities'] = Array.from(system.removedQualities);
        context['weaponTypeOptions'] = Object.entries(CONFIG.wh40k.weaponTypes).map(([key, config]) => ({
            key,
            label: config.label,
            selected: system.weaponTypes.has(key),
        }));

        // Quality picker (authoring only) and the damage-type options of the override profile
        context['qualityChoices'] = this.canEdit ? await loadQualityChoices(weaponQualityPack(WH40KSettings.getPrimaryGameSystem())) : [];
        context['damageTypes'] = CONFIG.wh40k.damageTypes;

        return context;
    }

    /* -------------------------------------------- */

    /** @override */
    // eslint-disable-next-line no-restricted-syntax -- boundary: ApplicationV2 _onRender accepts the untyped context record
    override async _onRender(context: Record<string, unknown>, options: ApplicationV2Config.RenderOptions): Promise<void> {
        await super._onRender(context, options);

        // The new-quality inputs are not document fields: typing in them must not submit (and re-render) the form
        this.element.querySelectorAll<HTMLInputElement>('[name="new-added-quality"], [name="new-removed-quality"]').forEach((input) => {
            input.addEventListener('change', (event) => event.stopPropagation());
        });
    }

    /* -------------------------------------------- */
    /*  Action Handlers                             */
    /* -------------------------------------------- */

    /**
     * Add a quality to the added or removed list. The shared Set add/persist core
     * lives in {@link SetFieldActionsMixin}; this handler resolves the target field
     * from `data-type` and pulls the value from the matching text input.
     */
    static async #addQuality(this: AmmoSheet, _event: Event, target: HTMLElement): Promise<void> {
        const type = target.dataset['type']; // 'added' or 'removed'
        const input = this.element.querySelector<HTMLInputElement>(`[name="new-${type}-quality"]`);
        const quality = input?.value.trim() ?? '';

        if (quality === '') return;

        const field = type === 'added' ? 'addedQualities' : 'removedQualities';
        await this.addToSetField(field, quality);

        // Clear input
        if (input !== null) input.value = '';
    }

    /**
     * Remove a quality from the added list.
     */
    static async #removeAddedQuality(this: AmmoSheet, _event: Event, target: HTMLElement): Promise<void> {
        await this.removeFromSetField('addedQualities', target.dataset['quality']);
    }

    /**
     * Remove a quality from the removed list.
     */
    static async #removeRemovedQuality(this: AmmoSheet, _event: Event, target: HTMLElement): Promise<void> {
        await this.removeFromSetField('removedQualities', target.dataset['quality']);
    }
}

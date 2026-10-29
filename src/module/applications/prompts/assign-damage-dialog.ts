/**
 * @file AssignDamageDialog - V2 dialog for damage assignment
 */

import { normalizeDamageType } from '../../rules/damage-type.ts';
import { hitDropdown } from '../../rules/hit-locations.ts';
import { flattenNestedForms } from '../../utils/dom-forms.ts';
import BaseRollDialog from './base-roll-dialog.ts';

/**
 * Dialog for assigning damage to a target.
 */
// eslint-disable-next-line no-restricted-syntax -- boundary: BaseRollDialog options are passed through to ApplicationV2 super; no narrower type available
type AssignDamageDialogOptions = Record<string, unknown>;

export default class AssignDamageDialog extends BaseRollDialog {
    /**
     * @param {object} assignDamageData  The damage assignment data.
     * @param {AssignDamageDialogOptions} [options={}]      Dialog options.
     */
    constructor(assignDamageData = {}, options: AssignDamageDialogOptions = {}) {
        super(assignDamageData, options);
    }

    /* -------------------------------------------- */

    /** @override */
    static override DEFAULT_OPTIONS = {
        classes: ['assign-damage'],
        window: {
            title: 'WH40K.Dialog.AssignDamageTitle',
        },
    };

    /* -------------------------------------------- */

    /** @override */
    static override PARTS = {
        form: {
            template: 'systems/wh40k-rpg/templates/prompt/assign-damage-prompt.hbs',
            scrollable: [''],
        },
    };

    /* -------------------------------------------- */

    /** @inheritDoc */
    // eslint-disable-next-line no-restricted-syntax -- boundary: ApplicationV2._prepareContext must return Record<string,unknown> per framework contract
    override async _prepareContext(options: ApplicationV2Config.RenderOptions): Promise<Record<string, unknown>> {
        const context = await super._prepareContext(options);
        // A hit's damage type arrives in whatever case the weapon wrote it ("energy"); the dropdown's keys are the
        // canonical names ("Energy"), so a plain value would match no option and the select would show its first.
        const hit = context['hit'] as { damageType?: string } | undefined;
        // The location dropdown labels are localized at render time, not baked into the damage data.
        return { ...context, locations: hitDropdown(), hitDamageType: normalizeDamageType(hit?.damageType) ?? 'Impact' };
    }

    /* -------------------------------------------- */
    /*  Event Listeners                             */
    /* -------------------------------------------- */

    /** @inheritDoc */
    // eslint-disable-next-line no-restricted-syntax -- boundary: ApplicationV2 _onRender context/options are untyped Record at the base class level
    override async _onRender(context: Record<string, unknown>, options: Record<string, unknown>): Promise<void> {
        await super._onRender(context, options);

        // The template wraps its content in a second <form>. Its fields would not belong to this dialog's own form,
        // so the form reader saw none of them and every change to a dropdown or number was discarded on re-render.
        flattenNestedForms(this.element);

        // Set up button listeners
        this.element.querySelector('#assign-damage')?.addEventListener('click', (e) => {
            void this._onAssignDamage(e);
        });
        this.element.querySelector('#cancel-prompt')?.addEventListener('click', (e) => {
            void this._onCancelPrompt(e);
        });
    }

    /* -------------------------------------------- */

    /**
     * Handle assign damage button click.
     * @param {Event} event  The click event.
     * @protected
     */
    async _onAssignDamage(event: Event): Promise<void> {
        event.preventDefault();
        await this._performRoll();
    }

    /* -------------------------------------------- */

    /**
     * Handle cancel button click.
     * @param {Event} event  The click event.
     * @protected
     */
    async _onCancelPrompt(event: Event): Promise<void> {
        event.preventDefault();
        await this.close();
    }
}

/* -------------------------------------------- */
/*  Helper Function                             */
/* -------------------------------------------- */

/**
 * Open an assign damage dialog.
 * @param {object} assignDamageData  The damage assignment data.
 */
// eslint-disable-next-line no-restricted-syntax -- boundary: assignDamageData is a plain legacy object passed from call sites; no narrower type available
export function prepareAssignDamageRoll(assignDamageData: Record<string, unknown>): void {
    const prompt = new AssignDamageDialog(assignDamageData);
    void prompt.render({ force: true });
}

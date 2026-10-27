import type { Meta, StoryObj } from '@storybook/html-vite';
import { expect } from 'storybook/test';
import templateSrc from '../../../../src/templates/prompt/regiment-builder-dialog.hbs?raw';
import { renderSheet } from '../../../../stories/test-helpers';

interface ChoiceRow {
    optionId: string;
    key: string;
    label: string;
    count: number;
    editable: boolean;
    options: Array<{ value: string; label: string; picked: boolean }>;
}

interface OptionRow {
    id: string;
    label: string;
    cost: number;
    selected: boolean;
    restriction: string;
    kit: Array<{ label: string; scope: string }>;
    choices: ChoiceRow[];
}

interface CategoryRow {
    id: 'homeWorld' | 'commandingOfficer' | 'regimentType' | 'trainingDoctrine' | 'specialEquipmentDoctrine' | 'drawback';
    labelKey: string;
    spent: number;
    options: OptionRow[];
}

interface Args {
    budget: { spent: number; total: number; remaining: number; valid: boolean; over: boolean; refund: number };
    doctrines: { count: number; max: number };
    issues: string[];
    categories: CategoryRow[];
    kit: {
        spent: number;
        allowance: number;
        remaining: number;
        over: boolean;
        rows: Array<{
            id: string;
            label: string;
            cost: number;
            restriction: string;
            count: number;
            maxCount: number;
            limited: boolean;
            once: boolean;
            atLimit: boolean;
            blocked: boolean;
            picks: Array<{
                position: number;
                kind: 'line' | 'item';
                editable: boolean;
                empty: boolean;
                options: Array<{ value: string; label: string; selected: boolean }>;
            }>;
        }>;
    };
    canCommit: boolean;
    presets: Array<{ id: string; label: string; locked: boolean; selected: boolean }>;
    locked: boolean;
    canSavePreset: boolean;
    presetMode: boolean;
    presetLocked: boolean;
    favoured: Array<{
        weaponClass: 'basic' | 'heavy';
        labelKey: string;
        slots: Array<{ weaponClass: 'basic' | 'heavy'; index: number; editable: boolean; options: Array<{ id: string; name: string; selected: boolean }> }>;
    }>;
    kitGroups: Array<{ id: string; source: string; lines: Array<{ label: string; scope: string; count?: number }> }>;
    favouredList: Array<{ weaponClass: 'basic' | 'heavy'; labelKey: string; name: string }>;
}

const EMPTY_CATEGORIES: CategoryRow[] = [
    { id: 'homeWorld', labelKey: 'WH40K.OW.Regiment.Category.HomeWorld', spent: 0, options: [] },
    { id: 'commandingOfficer', labelKey: 'WH40K.OW.Regiment.Category.CommandingOfficer', spent: 0, options: [] },
    { id: 'regimentType', labelKey: 'WH40K.OW.Regiment.Category.RegimentType', spent: 0, options: [] },
    { id: 'trainingDoctrine', labelKey: 'WH40K.OW.Regiment.Category.TrainingDoctrine', spent: 0, options: [] },
    { id: 'specialEquipmentDoctrine', labelKey: 'WH40K.OW.Regiment.Category.SpecialEquipmentDoctrine', spent: 0, options: [] },
    { id: 'drawback', labelKey: 'WH40K.OW.Regiment.Category.Drawback', spent: 0, options: [] },
];

const SAMPLE_CATEGORIES: CategoryRow[] = [
    {
        id: 'homeWorld',
        labelKey: 'WH40K.OW.Regiment.Category.HomeWorld',
        spent: 3,
        options: [
            { id: 'opt:hw:death-world', label: 'Death World', cost: 3, selected: true, restriction: '', kit: [], choices: [] },
            { id: 'opt:hw:feral-world', label: 'Feral World', cost: 3, selected: false, restriction: '', kit: [], choices: [] },
            { id: 'opt:hw:imperial-world', label: 'Imperial World', cost: 1, selected: false, restriction: '', kit: [], choices: [] },
        ],
    },
    {
        id: 'commandingOfficer',
        labelKey: 'WH40K.OW.Regiment.Category.CommandingOfficer',
        spent: 2,
        options: [
            { id: 'opt:co:billet-officer', label: 'Billet Officer', cost: 1, selected: false, restriction: '', kit: [], choices: [] },
            { id: 'opt:co:phlegmatic', label: 'Phlegmatic CO', cost: 2, selected: true, restriction: '', kit: [], choices: [] },
            { id: 'opt:co:maverick', label: 'Maverick CO', cost: 3, selected: false, restriction: '', kit: [], choices: [] },
        ],
    },
    {
        id: 'regimentType',
        labelKey: 'WH40K.OW.Regiment.Category.RegimentType',
        spent: 2,
        options: [
            { id: 'opt:rt:line-infantry', label: 'Line Infantry', cost: 2, selected: true, restriction: '', kit: [], choices: [] },
            { id: 'opt:rt:armoured', label: 'Armoured', cost: 4, selected: false, restriction: '', kit: [], choices: [] },
            { id: 'opt:rt:drop', label: 'Drop Troops', cost: 4, selected: false, restriction: '', kit: [], choices: [] },
        ],
    },
    {
        id: 'trainingDoctrine',
        labelKey: 'WH40K.OW.Regiment.Category.TrainingDoctrine',
        spent: 2,
        options: [
            { id: 'opt:td:close-order', label: 'Close-Order Drill', cost: 1, selected: true, restriction: '', kit: [], choices: [] },
            { id: 'opt:td:guerrilla', label: 'Guerrilla', cost: 1, selected: true, restriction: '', kit: [], choices: [] },
            { id: 'opt:td:hardened', label: 'Hardened Fighters', cost: 2, selected: false, restriction: '', kit: [], choices: [] },
        ],
    },
    {
        id: 'specialEquipmentDoctrine',
        labelKey: 'WH40K.OW.Regiment.Category.SpecialEquipmentDoctrine',
        spent: 2,
        options: [
            { id: 'opt:sed:medikits', label: 'Bonus Medikits', cost: 1, selected: true, restriction: '', kit: [], choices: [] },
            { id: 'opt:sed:demolitions', label: 'Demolitions Kit', cost: 1, selected: true, restriction: '', kit: [], choices: [] },
            { id: 'opt:sed:exo-armour', label: 'Exo-armour', cost: 3, selected: false, restriction: '', kit: [], choices: [] },
        ],
    },
    {
        id: 'drawback',
        labelKey: 'WH40K.OW.Regiment.Category.Drawback',
        spent: 0,
        options: [
            { id: 'opt:db:suspicion', label: 'Cloud of Suspicion', cost: 3, selected: false, restriction: '', kit: [], choices: [] },
            { id: 'opt:db:rivalry', label: 'Regimental Rivalry', cost: 2, selected: false, restriction: '', kit: [], choices: [] },
        ],
    },
];

const NO_FAVOURED: Args['favoured'] = [
    {
        weaponClass: 'basic',
        labelKey: 'WH40K.OW.Regiment.Favoured.Basic',
        slots: [{ weaponClass: 'basic', index: 0, editable: true, options: [{ id: 'w:las', name: 'M36 Lasgun', selected: false }] }],
    },
    {
        weaponClass: 'heavy',
        labelKey: 'WH40K.OW.Regiment.Favoured.Heavy',
        slots: [{ weaponClass: 'heavy', index: 0, editable: true, options: [{ id: 'w:hs', name: 'Heavy Stubber', selected: false }] }],
    },
];

const EMPTY_KIT: Args['kit'] = { spent: 0, allowance: 54, remaining: 54, over: false, rows: [] };

const meta = {
    title: 'Prompts/RegimentBuilderDialog',
    render: (args) => renderSheet(templateSrc, args),
    args: {
        budget: { spent: 0, total: 12, remaining: 12, valid: false, over: false, refund: 0 },
        doctrines: { count: 0, max: 3 },
        issues: [],
        categories: EMPTY_CATEGORIES,
        kit: EMPTY_KIT,
        canCommit: false,
        presets: [],
        locked: false,
        canSavePreset: false,
        presetMode: false,
        presetLocked: false,
        favoured: NO_FAVOURED,
        kitGroups: [],
        favouredList: [],
    },
} satisfies Meta<Args>;
export default meta;

type Story = StoryObj<Args>;

/** Empty catalog — stub state seen by callers who didn't pre-load compendium options. */
export const EmptyCatalog: Story = {
    args: {
        budget: { spent: 0, total: 12, remaining: 12, valid: false, over: false, refund: 0 },
        doctrines: { count: 0, max: 3 },
        issues: ['Choose a Home World or Origin.', 'Choose a Commanding Officer.', 'Choose a Regiment Type.'],
        categories: EMPTY_CATEGORIES,
        kit: EMPTY_KIT,
        canCommit: false,
        presets: [],
        locked: false,
        canSavePreset: false,
        presetMode: false,
        presetLocked: false,
        favoured: NO_FAVOURED,
        kitGroups: [],
        favouredList: [],
    },
};

/** Mid-build — 10 / 12 spent, three doctrines held, unspent points feeding the kit. */
export const PartialBuild: Story = {
    args: {
        budget: { spent: 10, total: 12, remaining: 2, valid: true, over: false, refund: 0 },
        doctrines: { count: 3, max: 3 },
        issues: [],
        categories: SAMPLE_CATEGORIES,
        kit: {
            spent: 5,
            allowance: 34,
            remaining: 29,
            over: false,
            rows: [
                {
                    id: 'kit:knife',
                    label: 'Add an additional knife',
                    cost: 2,
                    restriction: '',
                    count: 1,
                    maxCount: 2,
                    limited: true,
                    once: false,
                    atLimit: false,
                    blocked: false,
                    picks: [],
                },
                {
                    id: 'kit:flak',
                    label: 'Improve flak armour to Good craftsmanship',
                    cost: 3,
                    restriction: '',
                    count: 1,
                    maxCount: 1,
                    limited: true,
                    once: true,
                    atLimit: true,
                    blocked: false,
                    picks: [],
                },
                {
                    id: 'kit:grenades',
                    label: 'Add a crate of frag grenades',
                    cost: 1,
                    restriction: '',
                    count: 3,
                    maxCount: 99,
                    limited: false,
                    once: false,
                    atLimit: false,
                    blocked: false,
                    picks: [],
                },
                {
                    id: 'kit:carbine',
                    label: 'Replace laspistol (Main Weapon) with lascarbine (Main Weapon)',
                    cost: 5,
                    restriction: '',
                    count: 0,
                    maxCount: 99,
                    limited: false,
                    once: false,
                    atLimit: false,
                    blocked: true,
                    picks: [],
                },
                {
                    id: 'kit:good',
                    label: 'Improve a single item of standard kit wargear from Common Craftsmanship to Good Craftsmanship',
                    cost: 5,
                    restriction: '',
                    count: 2,
                    maxCount: 99,
                    limited: false,
                    once: false,
                    atLimit: false,
                    blocked: false,
                    picks: [
                        {
                            position: 0,
                            kind: 'line',
                            editable: true,
                            empty: false,
                            options: [
                                { value: 'One flak vest', label: 'One flak vest', selected: true },
                                { value: 'One knife', label: 'One knife', selected: false },
                            ],
                        },
                        {
                            position: 1,
                            kind: 'line',
                            editable: true,
                            empty: true,
                            options: [{ value: 'One knife', label: 'One knife', selected: false }],
                        },
                    ],
                },
                {
                    id: 'kit:rare',
                    label: 'Add an additional item of Rare availability to standard kit',
                    cost: 15,
                    restriction: 'GM’s Discretion',
                    count: 1,
                    maxCount: 99,
                    limited: false,
                    once: false,
                    atLimit: false,
                    blocked: false,
                    picks: [
                        {
                            position: 2,
                            kind: 'item',
                            editable: false,
                            empty: false,
                            options: [{ value: 'Compendium.x.Item.1', label: 'Grapnel', selected: true }],
                        },
                    ],
                },
            ],
        },
        canCommit: false,
        presets: [],
        locked: false,
        canSavePreset: false,
        presetMode: false,
        presetLocked: false,
        favoured: NO_FAVOURED,
        kitGroups: [],
        favouredList: [],
    },
    play: async ({ canvasElement }) => {
        const row = (id: string): HTMLElement => {
            const found = canvasElement.querySelector<HTMLElement>(`[data-kit-option="${id}"]`);
            if (found === null) throw new Error(`no kit row ${id}`);
            return found;
        };
        const add = (id: string): HTMLButtonElement | null => row(id).querySelector<HTMLButtonElement>('[data-action="addKit"]');
        // once-only purchase already taken: badge shown, + disabled
        await expect(row('kit:flak').querySelector('[data-kit-limit]')).not.toBeNull();
        await expect(add('kit:flak')?.disabled).toBe(true);
        // twice-only purchase taken once: badge shown, + still available
        await expect(row('kit:knife').querySelector('[data-kit-limit]')).not.toBeNull();
        await expect(add('kit:knife')?.disabled).toBe(false);
        // unlimited purchase: no badge, never disabled
        await expect(row('kit:grenades').querySelector('[data-kit-limit]')).toBeNull();
        await expect(add('kit:grenades')?.disabled).toBe(false);
        // a Main Weapon upgrade with no matching weapon to replace: note shown, + disabled
        await expect(row('kit:carbine').querySelector('[data-kit-blocked]')).not.toBeNull();
        await expect(add('kit:carbine')?.disabled).toBe(true);
        // a craftsmanship upgrade shows one picker per copy: the first chosen, the second still open
        const picker = (position: number): HTMLSelectElement | null =>
            canvasElement.querySelector<HTMLSelectElement>(`select[data-kit-pick][data-position="${position}"]`);
        await expect(picker(0)?.value).toBe('One flak vest');
        await expect(picker(1)?.value).toBe('');
        // a locked pick cannot be changed
        await expect(picker(2)?.disabled).toBe(true);
    },
};

/** All 12 points spent — Commit button enabled. */
export const ValidRegiment: Story = {
    args: {
        budget: { spent: 12, total: 12, remaining: 0, valid: true, over: false, refund: 0 },
        doctrines: { count: 3, max: 3 },
        issues: [],
        categories: SAMPLE_CATEGORIES.map((c) => ({ ...c })),
        kit: {
            spent: 5,
            allowance: 30,
            remaining: 25,
            over: false,
            rows: [
                {
                    id: 'kit:knife',
                    label: 'Add an additional knife',
                    cost: 2,
                    restriction: '',
                    count: 1,
                    maxCount: 2,
                    limited: true,
                    once: false,
                    atLimit: false,
                    blocked: false,
                    picks: [],
                },
                {
                    id: 'kit:flak',
                    label: 'Improve flak armour to Good craftsmanship',
                    cost: 3,
                    restriction: '',
                    count: 1,
                    maxCount: 1,
                    limited: true,
                    once: true,
                    atLimit: true,
                    blocked: false,
                    picks: [],
                },
                {
                    id: 'kit:grenades',
                    label: 'Add a crate of frag grenades',
                    cost: 1,
                    restriction: '',
                    count: 3,
                    maxCount: 99,
                    limited: false,
                    once: false,
                    atLimit: false,
                    blocked: false,
                    picks: [],
                },
            ],
        },
        canCommit: true,
    },
};

/** Saved regiments to start from, one of them locked; a valid regiment can be saved as a new preset. */
export const WithPresets: Story = {
    args: {
        budget: { spent: 10, total: 12, remaining: 2, valid: true, over: false, refund: 0 },
        doctrines: { count: 3, max: 3 },
        issues: [],
        categories: SAMPLE_CATEGORIES,
        kit: { spent: 0, allowance: 34, remaining: 34, over: false, rows: [] },
        canCommit: true,
        presets: [
            { id: 'preset:line', label: 'Line Infantry Company', locked: false, selected: true },
            { id: 'preset:crimson', label: 'Crimson Guard', locked: true, selected: false },
        ],
        locked: false,
        canSavePreset: true,
        presetMode: false,
        presetLocked: false,
        favoured: NO_FAVOURED,
        kitGroups: [],
        favouredList: [],
    },
};

/** A locked preset: players cannot change the options or kit (the GM can). */
export const LockedToPreset: Story = {
    args: {
        budget: { spent: 10, total: 12, remaining: 2, valid: true, over: false, refund: 0 },
        doctrines: { count: 3, max: 3 },
        issues: [],
        categories: SAMPLE_CATEGORIES,
        kit: {
            spent: 0,
            allowance: 34,
            remaining: 34,
            over: false,
            rows: [
                {
                    id: 'kit:knife',
                    label: 'Add an additional knife',
                    cost: 2,
                    restriction: '',
                    count: 0,
                    maxCount: 2,
                    limited: true,
                    once: false,
                    atLimit: false,
                    blocked: false,
                    picks: [],
                },
            ],
        },
        canCommit: true,
        presets: [],
        locked: true,
        canSavePreset: false,
        presetMode: false,
        presetLocked: false,
        favoured: NO_FAVOURED,
        kitGroups: [],
        favouredList: [],
    },
};

/** Editing a preset item with no character: Save Preset replaces Commit, a Locked toggle appears, and open picks are fine. */
export const EditingAPreset: Story = {
    args: {
        budget: { spent: 10, total: 12, remaining: 2, valid: true, over: false, refund: 0 },
        doctrines: { count: 3, max: 3 },
        issues: [],
        categories: SAMPLE_CATEGORIES,
        kit: { spent: 0, allowance: 34, remaining: 34, over: false, rows: [] },
        canCommit: true,
        presets: [],
        locked: false,
        canSavePreset: false,
        presetMode: true,
        presetLocked: true,
        favoured: NO_FAVOURED,
        kitGroups: [],
        favouredList: [],
    },
};

/** The regiment's Standard Kit by source, and the Favoured Weapons chosen — each its own list. */
export const KitAndFavouredWeapons: Story = {
    args: {
        budget: { spent: 10, total: 12, remaining: 2, valid: true, over: false, refund: 0 },
        doctrines: { count: 3, max: 3 },
        issues: [],
        categories: SAMPLE_CATEGORIES,
        kit: { spent: 7, allowance: 34, remaining: 27, over: false, rows: [] },
        canCommit: true,
        presets: [],
        locked: false,
        canSavePreset: false,
        presetMode: false,
        presetLocked: false,
        favoured: [
            {
                weaponClass: 'basic',
                labelKey: 'WH40K.OW.Regiment.Favoured.Basic',
                slots: [
                    { weaponClass: 'basic', index: 0, editable: true, options: [{ id: 'w:las', name: 'M36 Lasgun', selected: true }] },
                    { weaponClass: 'basic', index: 1, editable: true, options: [{ id: 'w:las', name: 'M36 Lasgun', selected: false }] },
                ],
            },
            {
                weaponClass: 'heavy',
                labelKey: 'WH40K.OW.Regiment.Favoured.Heavy',
                slots: [{ weaponClass: 'heavy', index: 0, editable: true, options: [{ id: 'w:hs', name: 'Heavy Stubber', selected: true }] }],
            },
        ],
        kitGroups: [
            {
                id: 'uni',
                source: 'Universal Standard Kit',
                lines: [
                    { label: 'One uniform', scope: 'character' },
                    { label: 'One knife', scope: 'character' },
                ],
            },
            {
                id: 'rt',
                source: 'Line Infantry',
                lines: [
                    { label: 'One M36 lasgun and four charge packs per Player Character (Main Weapon)', scope: 'character' },
                    { label: 'One Chimera', scope: 'squad' },
                ],
            },
            { id: 'purchased', source: '', lines: [{ label: 'Add an additional knife', scope: 'character', count: 2 }] },
        ],
        favouredList: [
            { weaponClass: 'basic', labelKey: 'WH40K.OW.Regiment.Favoured.Basic', name: 'M36 Lasgun' },
            { weaponClass: 'heavy', labelKey: 'WH40K.OW.Regiment.Favoured.Heavy', name: 'Heavy Stubber' },
        ],
    },
};

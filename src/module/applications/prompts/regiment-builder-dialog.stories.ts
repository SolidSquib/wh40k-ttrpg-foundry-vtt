import type { Meta, StoryObj } from '@storybook/html-vite';
import templateSrc from '../../../../src/templates/prompt/regiment-builder-dialog.hbs?raw';
import { renderSheet } from '../../../../stories/test-helpers';

interface ChoiceRow {
    optionId: string;
    key: string;
    label: string;
    count: number;
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
        rows: Array<{ id: string; label: string; cost: number; restriction: string; count: number; maxCount: number }>;
    };
    canCommit: boolean;
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
            rows: [{ id: 'kit:knife', label: 'Add an additional knife', cost: 2, restriction: '', count: 1, maxCount: 2 }],
        },
        canCommit: false,
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
            rows: [{ id: 'kit:knife', label: 'Add an additional knife', cost: 2, restriction: '', count: 1, maxCount: 2 }],
        },
        canCommit: true,
    },
};

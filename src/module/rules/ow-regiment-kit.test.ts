import { describe, expect, it } from 'vitest';
import { type RegimentCatalogEntry, regimentEntryFromDoc } from './ow-regiment-catalog';
import { emptyRegimentSelection } from './ow-regiment-creation';
import {
    dropInapplicableUpgrades,
    type KitLine,
    KIT_UNLIMITED,
    kitPickKind,
    kitPurchaseLimit,
    kitPurchases,
    mainWeaponUpgradeApplies,
    resolveKit,
} from './ow-regiment-kit';

const entry = (
    id: string,
    name: string,
    category: string,
    kit: Array<{ label: string; scope: 'character' | 'squad' }> = [],
    favouredSlot?: string,
): RegimentCatalogEntry =>
    regimentEntryFromDoc(id, {
        name,
        system: { regiment: { category, cost: 1, kit, ...(favouredSlot === undefined ? {} : { favouredSlot }) } },
    }) as RegimentCatalogEntry;

const catalog = [
    entry('uni', 'Universal Standard Kit', 'universalKit', [{ label: 'One uniform', scope: 'character' }]),
    entry('rt', 'Line Infantry', 'regimentType', [
        { label: 'One lasgun', scope: 'character' },
        { label: 'One Chimera', scope: 'squad' },
    ]),
    entry('td', 'Sharpshooters', 'trainingDoctrine'),
    entry('sed', 'Chameleoline', 'specialEquipmentDoctrine', [{ label: 'Chameleoline cloaks', scope: 'character' }]),
    entry('knife', 'Add an additional knife', 'kitItem'),
    entry('fav', 'Add one Favoured Basic Weapon', 'kitItem', [], 'basic'),
];

const standardKitGroups = (...args: Parameters<typeof resolveKit>): ReturnType<typeof resolveKit>['groups'] => resolveKit(...args).groups;

describe('standardKitGroups', () => {
    it('starts with the universal kit', () => {
        expect(standardKitGroups(emptyRegimentSelection(), [], catalog)).toEqual([
            { id: 'uni', source: 'Universal Standard Kit', lines: [{ label: 'One uniform', scope: 'character' }] },
        ]);
    });

    it('adds the Regiment Type and each doctrine that issues kit, skipping those that issue none', () => {
        const groups = standardKitGroups(
            { ...emptyRegimentSelection(), regimentType: 'rt', trainingDoctrines: ['td'], specialEquipmentDoctrines: ['sed'] },
            [],
            catalog,
        );
        expect(groups.map((g) => g.source)).toEqual(['Universal Standard Kit', 'Line Infantry', 'Chameleoline']);
        expect(groups[1]?.lines.map((l) => l.label)).toEqual(['One lasgun', 'One Chimera']);
    });

    it('lists purchases last, counting repeats and leaving Favoured Weapon purchases to their own list', () => {
        const groups = standardKitGroups(emptyRegimentSelection(), ['knife', 'knife', 'fav'], catalog);
        expect(groups.at(-1)).toEqual({ id: 'purchased', source: '', lines: [{ label: 'Add an additional knife', scope: 'character', count: 2 }] });
    });

    it('updates as selections change', () => {
        const withType = standardKitGroups({ ...emptyRegimentSelection(), regimentType: 'rt' }, [], catalog);
        const without = standardKitGroups(emptyRegimentSelection(), [], catalog);
        expect(withType).toHaveLength(without.length + 1);
    });

    it('ignores ids the catalog does not hold', () => {
        expect(standardKitGroups({ ...emptyRegimentSelection(), regimentType: 'ghost' }, ['ghost'], catalog)).toHaveLength(1);
    });
});

describe('kitPurchaseLimit', () => {
    it('a once-only purchase is limited, and full after one is taken', () => {
        expect(kitPurchaseLimit(0, 1)).toEqual({ limited: true, once: true, atLimit: false });
        expect(kitPurchaseLimit(1, 1)).toEqual({ limited: true, once: true, atLimit: true });
    });

    it('a twice-only purchase is limited but not once, and full after two', () => {
        expect(kitPurchaseLimit(1, 2)).toEqual({ limited: true, once: false, atLimit: false });
        expect(kitPurchaseLimit(2, 2).atLimit).toBe(true);
    });

    it('an unlimited purchase never reads as limited or full', () => {
        expect(kitPurchaseLimit(0, KIT_UNLIMITED)).toEqual({ limited: false, once: false, atLimit: false });
        expect(kitPurchaseLimit(40, KIT_UNLIMITED).atLimit).toBe(false);
    });
});

describe('Main Weapon replacement', () => {
    type Line = { label: string; scope: 'character' | 'squad'; mainWeapon?: boolean; weapon?: string };
    const weapon = (label: string, key: string): Line => ({ label, scope: 'character', mainWeapon: true, weapon: key });
    const swap = (id: string, name: string, replaces: string[], to: Line): RegimentCatalogEntry =>
        regimentEntryFromDoc(id, {
            name,
            system: { regiment: { category: 'kitItem', cost: 5, replacesMainWeapon: replaces, kit: [to] } },
        }) as RegimentCatalogEntry;
    const issuing = (id: string, name: string, category: string, kit: Line[]): RegimentCatalogEntry =>
        regimentEntryFromDoc(id, { name, system: { regiment: { category, cost: 1, kit } } }) as RegimentCatalogEntry;

    const weapons: RegimentCatalogEntry[] = [
        issuing('uni', 'Universal Standard Kit', 'universalKit', [
            weapon('One laspistol (Main Weapon)', 'laspistol'),
            { label: 'One knife', scope: 'character' },
        ]),
        issuing('line', 'Line Infantry', 'regimentType', [weapon('One M36 lasgun (Main Weapon)', 'm36-lasgun')]),
        issuing('pick', 'Vanguard', 'regimentType', [weapon('One lascarbine or one shotgun (Main Weapon)', '')]),
        swap('pistol-carbine', 'Replace laspistol with lascarbine', ['laspistol'], weapon('One lascarbine (Main Weapon)', 'lascarbine')),
        swap('carbine-lasgun', 'Replace lascarbine with M36 lasgun', ['lascarbine'], weapon('One M36 lasgun (Main Weapon)', 'm36-lasgun')),
        swap(
            'either-shotgun',
            'Replace lasgun or lascarbine with combat shotgun',
            ['m36-lasgun', 'lascarbine'],
            weapon('One combat shotgun (Main Weapon)', 'combat-shotgun'),
        ),
    ];
    const keptIds = (selection: ReturnType<typeof emptyRegimentSelection>, ids: string[]): string[] =>
        dropInapplicableUpgrades(selection, kitPurchases(ids), weapons).map((purchase) => purchase.id);
    const labels = (groups: ReturnType<typeof standardKitGroups>): string[] => groups.flatMap((g) => g.lines.map((l) => l.label));
    const none = emptyRegimentSelection();
    const line = { ...none, regimentType: 'line' };

    it("a Regiment Type's Main Weapon replaces the universal laspistol", () => {
        expect(labels(standardKitGroups(line, [], weapons))).toEqual(['One knife', 'One M36 lasgun (Main Weapon)']);
    });

    it('an upgrade swaps the Main Weapon it names, and only that one', () => {
        expect(labels(standardKitGroups(none, ['pistol-carbine'], weapons))).toEqual(['One knife', 'One lascarbine (Main Weapon)']);
        expect(resolveKit(line, ['pistol-carbine'], weapons).inapplicable).toEqual([0]);
    });

    it('upgrades chain: each one needs the weapon the last one left', () => {
        const chain = ['pistol-carbine', 'carbine-lasgun', 'either-shotgun'];
        expect(resolveKit(none, chain, weapons).inapplicable).toEqual([]);
        expect(labels(standardKitGroups(none, chain, weapons))).toEqual(['One knife', 'One combat shotgun (Main Weapon)']);
        expect(resolveKit(none, ['carbine-lasgun', 'pistol-carbine'], weapons).inapplicable).toEqual([0]);
    });

    it('an upgrade can list several weapons it replaces', () => {
        expect(resolveKit(line, ['either-shotgun'], weapons).inapplicable).toEqual([]);
        expect(resolveKit(none, ['either-shotgun'], weapons).inapplicable).toEqual([0]);
    });

    it('a Main Weapon the player picks cannot be upgraded', () => {
        const vanguard = { ...none, regimentType: 'pick' };
        expect(resolveKit(vanguard, ['pistol-carbine'], weapons).inapplicable).toEqual([0]);
        expect(labels(standardKitGroups(vanguard, [], weapons))).toEqual(['One knife', 'One lascarbine or one shotgun (Main Weapon)']);
    });

    it('says whether the next purchase would apply', () => {
        expect(mainWeaponUpgradeApplies(none, kitPurchases([]), weapons, 'pistol-carbine')).toBe(true);
        expect(mainWeaponUpgradeApplies(none, kitPurchases([]), weapons, 'carbine-lasgun')).toBe(false);
        expect(mainWeaponUpgradeApplies(none, kitPurchases(['pistol-carbine']), weapons, 'carbine-lasgun')).toBe(true);
        expect(mainWeaponUpgradeApplies(none, kitPurchases([]), weapons, 'pick')).toBe(true);
    });

    it('drops upgrades that lost their weapon, and those built on them', () => {
        expect(keptIds(line, ['pistol-carbine', 'carbine-lasgun'])).toEqual([]);
        expect(keptIds(none, ['pistol-carbine', 'carbine-lasgun'])).toEqual(['pistol-carbine', 'carbine-lasgun']);
        expect(keptIds(none, ['carbine-lasgun', 'pistol-carbine'])).toEqual(['pistol-carbine']);
    });
});

describe('craftsmanship upgrades and additional items', () => {
    interface PurchaseFields {
        craftsmanship?: 'good' | 'best';
        additionalItem?: string;
        replacesMainWeapon?: string[];
        kit?: Array<{ label: string; scope: 'character'; mainWeapon: boolean; weapon: string }>;
    }
    const purchase = (id: string, name: string, extra: PurchaseFields): RegimentCatalogEntry =>
        regimentEntryFromDoc(id, { name, system: { regiment: { category: 'kitItem', cost: 5, ...extra } } }) as RegimentCatalogEntry;
    const items: RegimentCatalogEntry[] = [
        regimentEntryFromDoc('uni', {
            name: 'Universal Standard Kit',
            system: {
                regiment: {
                    category: 'universalKit',
                    cost: 0,
                    kit: [
                        { label: 'One laspistol (Main Weapon)', scope: 'character', mainWeapon: true, weapon: 'laspistol' },
                        { label: 'One flak vest', scope: 'character' },
                    ],
                },
            },
        }) as RegimentCatalogEntry,
        purchase('good', 'Improve to Good', { craftsmanship: 'good' }),
        purchase('best', 'Improve to Best', { craftsmanship: 'best' }),
        purchase('rare', 'Add an additional item of Rare availability', { additionalItem: 'rare' }),
        purchase('swap', 'Replace laspistol', {
            replacesMainWeapon: ['laspistol'],
            kit: [{ label: 'One lascarbine (Main Weapon)', scope: 'character', mainWeapon: true, weapon: 'lascarbine' }],
        }),
    ];
    const none = emptyRegimentSelection();
    const lineOf = (kit: ReturnType<typeof resolveKit>, label: string): KitLine | undefined =>
        kit.groups.flatMap((g) => g.lines).find((l) => l.label === label);

    it('marks the chosen item with the craftsmanship it was raised to', () => {
        const kit = resolveKit(none, ['good'], items, { picks: ['One flak vest'] });
        expect(lineOf(kit, 'One flak vest')?.craftsmanship).toBe('good');
        expect(kit.unpicked).toEqual([]);
    });

    it('waits for a choice: a purchase with nothing chosen is reported and changes nothing', () => {
        const kit = resolveKit(none, ['good'], items);
        expect(kit.unpicked).toEqual([0]);
        expect(lineOf(kit, 'One flak vest')?.craftsmanship).toBeUndefined();
    });

    it('one item cannot be improved twice, and the picker offers only items still at Common', () => {
        const kit = resolveKit(none, ['good', 'best'], items, { picks: ['One flak vest', 'One flak vest'] });
        expect(kit.unpicked).toEqual([1]);
        expect(lineOf(kit, 'One flak vest')?.craftsmanship).toBe('good');
        expect(kit.improvable.find((l) => l.label === 'One flak vest')?.takenBy).toBe(0);
    });

    it('an improved Main Weapon that a later swap replaces leaves its upgrade with nothing to improve', () => {
        const kit = resolveKit(none, ['good', 'swap'], items, { picks: ['One laspistol (Main Weapon)', ''] });
        expect(kit.unpicked).toEqual([0]);
    });

    it('clears a craftsmanship choice whose item is gone, but keeps the purchase', () => {
        const kept = dropInapplicableUpgrades(none, [{ id: 'good', pick: 'One lasgun' }], items);
        expect(kept).toEqual([{ id: 'good', pick: '' }]);
    });

    it('an additional item is listed by the name of the item chosen', () => {
        const names = new Map([['Compendium.x.Item.1', 'Grapnel']]);
        const kit = resolveKit(none, ['rare'], items, { picks: ['Compendium.x.Item.1'], itemNames: names });
        expect(lineOf(kit, 'Grapnel')).toBeDefined();
        expect(kit.unpicked).toEqual([]);
    });

    it('an additional item not yet chosen is listed generically and reported', () => {
        const kit = resolveKit(none, ['rare', 'rare'], items);
        expect(kit.unpicked).toEqual([0, 1]);
        expect(kit.groups.at(-1)?.lines).toHaveLength(2);
    });

    it('says which kind of choice a purchase asks for', () => {
        const byId = (id: string): RegimentCatalogEntry => {
            const found = items.find((candidate) => candidate.id === id);
            if (found === undefined) throw new Error(`no entry ${id}`);
            return found;
        };
        expect(kitPickKind(byId('good'))).toBe('line');
        expect(kitPickKind(byId('rare'))).toBe('item');
        expect(kitPickKind(byId('swap'))).toBeUndefined();
    });
});

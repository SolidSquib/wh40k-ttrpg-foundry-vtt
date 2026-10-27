/**
 * Only War · the regiment's Standard Kit, as a list.
 *
 * Every regiment starts from the universal kit; its Regiment Type and doctrines each add the kit lines they
 * print; and anything bought from the kit table is added on top. A Main Weapon replaces the one before it, a
 * kit upgrade can swap the Main Weapon again, a craftsmanship upgrade improves one chosen line, and an
 * "additional item" purchase adds one chosen item. Armour replacement is not worked out here — each source
 * simply lists what it gives.
 */

import type { RegimentCatalogEntry, RegimentKitItem } from './ow-regiment-catalog.ts';
import type { RegimentSelection } from './ow-regiment-creation.ts';

/** One line of kit. `count` is set when the same purchase was taken more than once. */
export interface KitLine {
    readonly label: string;
    readonly scope: 'character' | 'squad';
    readonly count?: number;
    /** Set when a craftsmanship upgrade has improved this item. */
    readonly craftsmanship?: Craftsmanship;
}

/** The craftsmanship a kit upgrade raises an item to (kit items start at Common). */
export type Craftsmanship = 'good' | 'best';

/** One kit purchase: the option bought and, for purchases that ask for one, what the player chose for it. */
export interface KitPurchase {
    readonly id: string;
    /** A kit line's label (craftsmanship upgrades) or an item's UUID (additional items); blank until chosen. */
    readonly pick: string;
}

/** Pair parallel id and pick lists into purchases; a missing pick is blank. */
export function kitPurchases(kitIds: ReadonlyArray<string>, picks: ReadonlyArray<string> = []): KitPurchase[] {
    return kitIds.map((id, index) => ({ id, pick: picks.at(index) ?? '' }));
}

/** What a purchase asks the player to choose, if anything: one of the kit's lines or one item. */
export function kitPickKind(entry: Pick<RegimentCatalogEntry, 'craftsmanship' | 'additionalItem'>): 'line' | 'item' | undefined {
    if (entry.craftsmanship !== '') return 'line';
    if (entry.additionalItem !== '') return 'item';
    return undefined;
}

/** The kit one source gives: the universal kit, a Regiment Type or doctrine, or the purchases. */
export interface KitGroup {
    readonly id: string;
    /** The source's name, empty for the group of purchases (the dialog labels that one). */
    readonly source: string;
    readonly lines: ReadonlyArray<KitLine>;
}

/** A kit line while the kit is being worked out; frozen into a {@link KitLine} on the way out. */
type WorkingLine = { -readonly [K in keyof KitLine]: KitLine[K] };

/** The Main Weapon line currently standing, and the list it sits in so a later Main Weapon can take it out. */
interface MainWeaponHolder {
    readonly lines: WorkingLine[];
    readonly line: WorkingLine;
    /** The weapon's key; blank when it is not one a kit upgrade can replace. */
    readonly weapon: string;
}

/** Extra inputs to {@link resolveKit}. */
export interface KitResolveOptions {
    /** What the player chose for each purchase, parallel to the kit ids. */
    readonly picks?: ReadonlyArray<string>;
    /** Display names for item UUIDs, so an additional item is listed by name. */
    readonly itemNames?: ReadonlyMap<string, string>;
}

/** A line a craftsmanship upgrade could improve, and which purchase (if any) already has. */
export interface ImprovableLine {
    readonly label: string;
    /** Position in the kit of the upgrade that improves it, if one does. */
    readonly takenBy: number | undefined;
}

/** The regiment's kit as listed, and the purchases that could not be applied. */
export interface ResolvedKit {
    readonly groups: KitGroup[];
    /** Positions in the kit of Main Weapon upgrades with no matching Main Weapon to replace at that point. */
    readonly inapplicable: ReadonlyArray<number>;
    /** Positions of purchases that need a choice and have none that works (nothing picked, or the chosen line is gone). */
    readonly unpicked: ReadonlyArray<number>;
    /** Every line of the finished kit, for the craftsmanship picker. */
    readonly improvable: ReadonlyArray<ImprovableLine>;
}

/**
 * The regiment's kit, grouped by source: the universal kit first, then the Regiment Type and each doctrine that
 * issues kit, then purchases in the order they were taken. A Main Weapon replaces whichever came before it, so the
 * universal laspistol drops out when the Regiment Type issues a lasgun. A kit upgrade that swaps the Main Weapon
 * only applies when the Main Weapon at that point is one it lists; otherwise it is reported as inapplicable and
 * adds nothing. A craftsmanship upgrade marks the line it was pointed at; an additional-item purchase adds the
 * item chosen. Favoured Weapon purchases are left out — they appear in the Favoured Weapons list.
 */
export function resolveKit(
    selection: RegimentSelection,
    kitIds: ReadonlyArray<string>,
    catalog: ReadonlyArray<RegimentCatalogEntry>,
    options: KitResolveOptions = {},
): ResolvedKit {
    const groups: Array<{ id: string; source: string; lines: WorkingLine[] }> = [];
    // Held in an object, not a `let`: the closure below reassigns it, which TypeScript's narrowing does not follow.
    const standing: { holder?: MainWeaponHolder } = {};

    /** Add `items` as a group, letting a Main Weapon among them replace the one standing. */
    const issue = (id: string, source: string, items: ReadonlyArray<RegimentKitItem>, into?: WorkingLine[]): void => {
        const lines = into ?? [];
        for (const item of items) {
            const line: WorkingLine = { label: item.label, scope: item.scope };
            if (item.mainWeapon === true) {
                if (standing.holder !== undefined) standing.holder.lines.splice(standing.holder.lines.indexOf(standing.holder.line), 1);
                standing.holder = { lines, line, weapon: item.weapon ?? '' };
            }
            lines.push(line);
        }
        if (into === undefined) groups.push({ id, source, lines });
    };

    for (const entry of catalog.filter((candidate) => candidate.category === 'universalKit' && candidate.kit.length > 0))
        issue(entry.id, entry.label, entry.kit);

    const issuing = [selection.regimentType, ...selection.trainingDoctrines, ...selection.specialEquipmentDoctrines].filter(
        (id): id is string => id !== undefined && id !== '',
    );
    for (const id of issuing) {
        const entry = catalog.find((candidate) => candidate.id === id);
        if (entry !== undefined && entry.kit.length > 0) issue(entry.id, entry.label, entry.kit);
    }

    const purchased: WorkingLine[] = [];
    const counts = new Map<string, WorkingLine>();
    const inapplicable: number[] = [];
    const unpicked: number[] = [];
    /** Craftsmanship upgrades and the line each one marked, to check the line survived any later Main Weapon swap. */
    const improved: Array<{ position: number; line: WorkingLine }> = [];
    const allLines = (): WorkingLine[] => [...groups.flatMap((group) => group.lines), ...purchased];

    kitIds.forEach((id, position) => {
        const entry = catalog.find((candidate) => candidate.id === id);
        if (entry === undefined || entry.favouredSlot !== undefined) return;
        const pick = options.picks?.at(position) ?? '';
        if (entry.replacesMainWeapon.length > 0) {
            const { holder } = standing;
            if (holder === undefined || holder.weapon === '' || !entry.replacesMainWeapon.includes(holder.weapon)) inapplicable.push(position);
            else issue('purchased', '', entry.kit, purchased);
            return;
        }
        if (entry.craftsmanship !== '') {
            const target = pick === '' ? undefined : allLines().find((line) => line.label === pick && line.craftsmanship === undefined);
            if (target === undefined) unpicked.push(position);
            else {
                target.craftsmanship = entry.craftsmanship;
                improved.push({ position, line: target });
            }
            return;
        }
        if (entry.additionalItem !== '') {
            if (pick === '') unpicked.push(position);
            purchased.push({ label: pick === '' ? entry.label : options.itemNames?.get(pick) ?? entry.label, scope: 'character' });
            return;
        }
        const taken = counts.get(id);
        if (taken === undefined) {
            const line: WorkingLine = { label: entry.label, scope: 'character' };
            counts.set(id, line);
            purchased.push(line);
        } else taken.count = (taken.count ?? 1) + 1;
    });

    // an improved line that a later Main Weapon swap removed leaves its upgrade with nothing to improve
    const present = new Set(allLines());
    for (const { position, line } of improved) if (!present.has(line)) unpicked.push(position);

    if (purchased.length > 0) groups.push({ id: 'purchased', source: '', lines: purchased });
    const takenBy = new Map(improved.filter(({ line }) => present.has(line)).map(({ position, line }) => [line, position]));
    return {
        groups,
        inapplicable,
        unpicked: unpicked.sort((a, b) => a - b),
        improvable: allLines().map((line) => ({ label: line.label, takenBy: takenBy.get(line) })),
    };
}

/** Would buying `optionId` next be allowed, as far as the Main Weapon goes? Always true for anything but a Main Weapon upgrade. */
export function mainWeaponUpgradeApplies(
    selection: RegimentSelection,
    kit: ReadonlyArray<KitPurchase>,
    catalog: ReadonlyArray<RegimentCatalogEntry>,
    optionId: string,
): boolean {
    const next = [...kit.map((purchase) => purchase.id), optionId];
    return !resolveKit(selection, next, catalog).inapplicable.includes(kit.length);
}

/**
 * The kit without Main Weapon upgrades that no longer have a weapon to replace (the Regiment Type or an earlier
 * upgrade changed), and with the choice cleared on a craftsmanship upgrade whose item is gone.
 */
export function dropInapplicableUpgrades(
    selection: RegimentSelection,
    kit: ReadonlyArray<KitPurchase>,
    catalog: ReadonlyArray<RegimentCatalogEntry>,
): KitPurchase[] {
    let kept = [...kit];
    for (;;) {
        const first = resolveKit(
            selection,
            kept.map((purchase) => purchase.id),
            catalog,
            { picks: kept.map((purchase) => purchase.pick) },
        ).inapplicable.at(0);
        if (first === undefined) break;
        kept = kept.filter((_purchase, index) => index !== first);
    }
    const { unpicked } = resolveKit(
        selection,
        kept.map((purchase) => purchase.id),
        catalog,
        { picks: kept.map((purchase) => purchase.pick) },
    );
    return kept.map((purchase, index) => {
        const entry = catalog.find((candidate) => candidate.id === purchase.id);
        // only a stale line pick is cleared; an item pick is a UUID that stays valid
        return unpicked.includes(index) && entry !== undefined && entry.craftsmanship !== '' ? { id: purchase.id, pick: '' } : purchase;
    });
}

/** The `maxCount` the kit table's "no limit" rows carry (a row with no printed limitation). */
export const KIT_UNLIMITED = 99;

/** How a kit purchase stands against its printed limit, for the row that buys it. */
export interface KitPurchaseLimit {
    /** The table limits how often this can be bought (once or twice), rather than leaving it open. */
    readonly limited: boolean;
    /** It may only be bought a single time. */
    readonly once: boolean;
    /** No more can be bought: the limit is already reached. */
    readonly atLimit: boolean;
}

/** Work out where a kit row stands: `count` already taken against its `maxCount`. */
export function kitPurchaseLimit(count: number, maxCount: number): KitPurchaseLimit {
    const limited = maxCount < KIT_UNLIMITED;
    return { limited, once: limited && maxCount === 1, atLimit: count >= maxCount };
}

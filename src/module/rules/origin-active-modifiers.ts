/**
 * Only the picks a player made on an origin's choices, resolved into what they grant.
 *
 * Pure: shared by the origin-path DataModel (which stores the result as its derived `activeModifiers`) and by the
 * character-creation builder, whose selections are plain compendium payloads that never run `prepareDerivedData`.
 */
import { iterateResolvedChoices } from '../utils/origin-choices.ts';

/**
 * Grants an individual choice option can confer when selected. Mirrors the
 * `grants.*` array shapes the player picks resolve into.
 */
interface OriginChoiceOptionGrants {
    characteristics?: Record<string, number>;
    skills?: Array<{ name: string }>;
    talents?: Array<{ name: string; uuid?: string }>;
    traits?: Array<{ name: string; level?: number; uuid?: string }>;
    equipment?: Array<{ name: string; quantity?: number; uuid?: string; craftsmanship?: string }>;
}

/**
 * A single selectable option inside a `grants.choices[].options` array. Stored
 * as a free-form `ObjectField` in the schema; this is the structured shape the
 * runtime reads. RT packs key on `value`, DH2e/BC/OW on `name`.
 */
export interface OriginChoiceOption {
    value?: string;
    name?: string;
    uuid?: string;
    /** For an equipment option: how many are issued, and at what craftsmanship. */
    quantity?: number;
    craftsmanship?: string;
    grants?: OriginChoiceOptionGrants;
}

/** A `grants.choices` entry as the resolver reads it: any of the DataModel's choices, or a plain compendium payload's. */
export interface ResolvableChoice {
    type?: string | undefined;
    label?: string | undefined;
    name?: string | undefined;
    count?: number | undefined;
    options?: ReadonlyArray<OriginChoiceOption> | undefined;
}

/** One thing a pick grants: a characteristic, skill, talent, trait or item. */
export type ActiveModifier = {
    source: string;
    type: string;
    key: string;
    value: number | null;
    itemUuid: string | null;
    specialization?: string;
    craftsmanship?: string;
};

/** What a set of picks resolves to: one active modifier per thing the chosen options grant. */
// eslint-disable-next-line complexity -- choice resolution spans fixed grants, generic choice synthesis, and specialization splitting; refactoring it is larger than this lint-focused change
export function resolveActiveModifiers(grantsChoices: ReadonlyArray<ResolvableChoice>, selectedChoices: Record<string, string[]>): ActiveModifier[] {
    const activeModifiers: ActiveModifier[] = [];

    /**
     * Composite picks land in selectedChoices as e.g. "Weapon Training (Chain)".
     * Split into base name + specialization so the granted talent on the actor
     * carries the player's chosen variant rather than the generic "(any)" item.
     */
    const splitComposite = (raw: string): { base: string; specialization?: string } => {
        const match = raw.match(/^(.+?)\s*\((.+)\)\s*$/);
        if (match === null) return { base: raw };
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess: capture-group access is `string | undefined` under strict tsconfig, `string` under regular tsconfig; the fallback satisfies both
        const base = match[1] ?? raw;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess: see above
        const specialization = match[2] ?? '';
        return { base: base.trim(), specialization: specialization.trim() };
    };

    // Label disambiguation + scoped/legacy pick lookup is shared (#305); the
    // narrow `value ?? name` matcher stays inline here so the synthesized
    // active-modifier path is byte-identical.
    for (const { choice, choiceKey, selectedValues } of iterateResolvedChoices(grantsChoices, selectedChoices)) {
        for (const selectedStr of selectedValues) {
            const option = (choice.options ?? []).find((opt) => (opt.value ?? opt.name) === selectedStr);
            // When the option carries no explicit grants, synthesize an
            // activeModifier from the choice's declared type so picks like
            // "Sleight of Hand" on a generic skill choice or
            // "Weapon Training (Chain)" on a talent choice still attach to
            // the actor. The composite "(specialization)" suffix is
            // preserved in the key so downstream consumers can stamp the
            // specialization onto the granted item.
            if (option?.grants === undefined) {
                const choiceType = typeof choice.type === 'string' ? choice.type : '';
                if (choiceType === '') continue;
                const parts = splitComposite(selectedStr);
                const optionUuid = typeof option?.uuid === 'string' ? option.uuid : null;
                const base = { source: choiceKey, type: choiceType, key: parts.base, value: option?.quantity ?? null, itemUuid: optionUuid };
                const withGear = option?.craftsmanship === undefined || option.craftsmanship === '' ? base : { ...base, craftsmanship: option.craftsmanship };
                activeModifiers.push(parts.specialization === undefined ? withGear : { ...withGear, specialization: parts.specialization });
                continue;
            }
            const grants = option.grants;

            // Extract characteristic modifiers
            if (grants.characteristics !== undefined) {
                for (const [char, value] of Object.entries(grants.characteristics)) {
                    if (value !== 0) {
                        activeModifiers.push({
                            source: choiceKey,
                            type: 'characteristic',
                            key: char,
                            value,
                            itemUuid: null,
                        });
                    }
                }
            }

            // Extract skill grants
            if (grants.skills !== undefined) {
                for (const skill of grants.skills) {
                    activeModifiers.push({
                        source: choiceKey,
                        type: 'skill',
                        key: skill.name,
                        value: null,
                        itemUuid: null,
                    });
                }
            }

            // Extract talent grants — split composite picks like
            // "Weapon Training (Chain)" so the spec lands on the actor item.
            if (grants.talents !== undefined) {
                for (const talent of grants.talents) {
                    const parts = splitComposite(talent.name);
                    // If the talent name already carries a (spec), prefer that;
                    // otherwise fall back to splitting the option's selected
                    // value so picks like "Weapon Training" → "Weapon Training (Chain)"
                    // promoted via the dialog still record the spec.
                    const composite = parts.specialization !== undefined ? parts : splitComposite(selectedStr);
                    const base = { source: choiceKey, type: 'talent', key: composite.base, value: null, itemUuid: talent.uuid ?? null };
                    activeModifiers.push(composite.specialization === undefined ? base : { ...base, specialization: composite.specialization });
                }
            }

            // Extract trait grants
            if (grants.traits !== undefined) {
                for (const trait of grants.traits) {
                    activeModifiers.push({
                        source: choiceKey,
                        type: 'trait',
                        key: trait.name,
                        value: trait.level ?? null,
                        itemUuid: trait.uuid ?? null,
                    });
                }
            }

            // Extract equipment grants
            if (grants.equipment !== undefined) {
                for (const equip of grants.equipment) {
                    activeModifiers.push({
                        source: choiceKey,
                        type: 'equipment',
                        key: equip.name,
                        value: equip.quantity ?? null,
                        itemUuid: equip.uuid ?? null,
                        ...(equip.craftsmanship === undefined || equip.craftsmanship === '' ? {} : { craftsmanship: equip.craftsmanship }),
                    });
                }
            }
        }
    }

    return activeModifiers;
}

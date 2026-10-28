/**
 * @file Only War system configuration — the single game-system config.
 * Aptitude-based advancement (any skill/talent, cost by matching aptitudes),
 * 4 skill ranks, 5 characteristic tiers. Cost and aptitude tables are the
 * DH2e core tables Only War shares.
 */

import type { WH40KBaseActor } from '../../documents/base-actor.ts';
import { FATIGUE_MODES } from '../../rules/fatigue.ts';
import type {
    AdvanceCostResult,
    AdvanceOption,
    CharacteristicTierDef,
    FatigueModelDef,
    FatePointUseDef,
    OriginStepConfig,
    SidebarHeaderField,
    SkillRankDef,
} from './types.ts';

interface TalentLike {
    system?: { aptitudes?: string[]; tier?: number };
}

/** Extracts typed advanceAptitudes from a context bag, if present. */
function extractContextAptitudes(
    // eslint-disable-next-line no-restricted-syntax -- boundary: context is an open bag from callers; advanceAptitudes is validated by Array.isArray below
    context: Record<string, unknown> | undefined,
): string[] | undefined {
    const apts = context?.['advanceAptitudes'];
    return Array.isArray(apts) ? (apts as string[]) : undefined;
}

export class OWSystemConfig {
    readonly usesAptitudes = true;
    readonly usesCareerTables = false;

    readonly id = 'ow' as const;
    readonly label = 'WH40K.SETTINGS.PrimaryGameSystem.Choices.ow';
    readonly cssClass = 'only-war';
    readonly theme = {
        primary: 'brass',
        accent: 'brass-l20',
        border: 'brass-d15',
    } as const;

    getOriginStepConfig(): OriginStepConfig {
        return {
            coreSteps: [
                { key: 'regiment', step: 'regiment', icon: 'fa-shield', descKey: 'RegimentDesc', stepIndex: 1 },
                { key: 'speciality', step: 'speciality', icon: 'fa-crosshairs', descKey: 'SpecialityDesc', stepIndex: 2 },
            ],
            optionalStep: null,
            // Only War has no Divination table; starting Fate comes from Table 3–13.
            hasDivination: false,
            packs: [
                'ow-core-origins-homeworlds',
                'ow-core-origins-regiment-types',
                'ow-core-origins-specialities',
                'ow-core-origins-commanding-officers',
                'ow-core-origins-training-doctrines',
                'ow-core-origins-special-equipment-doctrines',
                'ow-core-origins-regimental-kit',
                'ow-core-origins-regiments',
                'ow-hammer-origins-homeworlds',
                'ow-hammer-origins-regiment-types',
                'ow-hammer-origins-training-doctrines',
                'ow-hammer-origins-special-equipment-doctrines',
                'ow-hammer-origins-regimental-drawbacks',
                'ow-hammer-origins-regiments',
                'ow-shield-origins-homeworlds',
                'ow-shield-origins-regiment-types',
                'ow-shield-origins-training-doctrines',
                'ow-shield-origins-special-equipment-doctrines',
                'ow-shield-origins-regimental-drawbacks',
                'ow-shield-origins-regiments',
            ],
        };
    }

    getHeaderFields(actor: WH40KBaseActor): SidebarHeaderField[] {
        return [
            this.makeOriginField(actor, 'WH40K.OriginPath.HomeWorld', 'homeWorld'),
            this.makeOriginField(actor, 'WH40K.OriginPath.Regiment', 'background'),
            this.makeOriginField(actor, 'WH40K.OriginPath.Speciality', 'role'),
            this.makeOriginField(actor, 'WH40K.OriginPath.Demeanour', 'motivation'),
        ];
    }

    /**
     * OW: psyker unlock is the "Sanctioned Psyker" speciality (step='speciality').
     * Compendium item: ow-core-specialities/sanctioned-psyker.
     */
    isPsyker(actor: WH40KBaseActor): boolean {
        return this.ownsOriginPathItem(actor, 'speciality', 'sanctioned psyker');
    }

    // ── Starting Resources ────────────────────────────────────────

    /** Starting XP for a new character in this system */
    get startingXP(): number {
        return 0;
    }

    // ── Skill Ranks ──────────────────────────────────────────────

    /**
     * {@link getSkillRanks} with `label`/`tooltip` localized — the form every UI
     * consumer reads. Call at render time (the langpack is not loaded when sheet
     * classes are defined).
     */
    getLocalizedSkillRanks(): SkillRankDef[] {
        return this.getSkillRanks().map((rank) => ({ ...rank, label: game.i18n.localize(rank.label), tooltip: game.i18n.localize(rank.tooltip) }));
    }

    /** Maximum skill rank (3 for RT/DH1e/DW, 4 for DH2e/BC/OW) */
    get skillRankCount(): number {
        return this.getSkillRanks().length;
    }

    // ── Characteristic Tiers ─────────────────────────────────────

    /** Tier key array (convenience) */
    get characteristicTierOrder(): string[] {
        return this.getCharacteristicTiers().map((t) => t.key);
    }

    // ── Origin Path ──────────────────────────────────────────────

    // ── Advancement Costs ────────────────────────────────────────

    // ── Psyker Gating ────────────────────────────────────────────

    /**
     * Whether the actor owns an origin-path item at `step` whose name matches
     * `name` case-insensitively. Centralizes the psyker-unlock predicate the
     * aptitude systems share (DH2 'Psyker' elite, OW 'Sanctioned Psyker'
     * speciality, BC 'Psyker' archetype) — each supplies its own step + name.
     * The single `system.step` narrowing lives here rather than at every
     * `isPsyker` call site.
     */
    private ownsOriginPathItem(actor: WH40KBaseActor, step: string, name: string): boolean {
        const target = name.toLowerCase();
        return actor.items.some((i) => i.isOriginPath && (i.system as { step?: string }).step === step && i.name.toLowerCase() === target);
    }

    // ── Skill Visibility ─────────────────────────────────────────

    // ── Sidebar Header Fields ────────────────────────────────────

    /**
     * Build a single header-field row. All systems share the same shape; this helper is the only
     * place the row defaults live so per-system configs stay declarative.
     */
    private makeField(
        label: string,
        name: string,
        value: string | number,
        placeholder: string = label,
        type: SidebarHeaderField['type'] = 'text',
    ): SidebarHeaderField {
        return {
            label,
            name,
            type,
            value,
            placeholder,
            ...(name === 'system.rank' ? { inputClass: 'wh40k-rank-input' } : {}),
        };
    }

    /**
     * Read a field from the character's originPath as a string or number, coercing
     * missing or non-scalar values to the empty string. Centralized so per-system
     * header builders don't repeat the same null-safety dance against the freeform
     * `originPath` record.
     */
    private readOriginPathField(actor: WH40KBaseActor, key: string): string | number {
        const source = actor.system.originPath;
        if (source == null) return '';
        const value = source[key];
        if (typeof value === 'string' || typeof value === 'number') return value;
        return '';
    }

    /**
     * Build one origin-path header row declaratively (#298): localizes `labelKey`, targets the
     * `system.originPath.{originKey}` schema slot (the form parser is path-sensitive on `name=`),
     * and reads the current value via {@link readOriginPathField}. Lets each per-system
     * `getHeaderFields` be a flat row list with no `readOriginPathField` closure and no repeated
     * `system.originPath.` prefix. Placeholder defaults to the label (via {@link makeField}).
     */
    private makeOriginField(actor: WH40KBaseActor, labelKey: string, originKey: string): SidebarHeaderField {
        return this.makeField(game.i18n.localize(labelKey), `system.originPath.${originKey}`, this.readOriginPathField(actor, originKey));
    }

    // ── UI Labels ─────────────────────────────────────────────────

    /**
     * Short labels for step navigation buttons.
     * Default implementation uses i18n keys: WH40K.OriginPath.Short.{StepKey}
     * Override in subclasses only if the i18n keys are insufficient.
     */
    getStepShortLabels(): Record<string, string> {
        const config = this.getOriginStepConfig();
        const labels: Record<string, string> = {};
        const allSteps = [...config.coreSteps];
        if (config.optionalStep) allSteps.push(config.optionalStep);
        if (config.equipmentStep) allSteps.push(config.equipmentStep);

        for (const step of allSteps) {
            const key = `WH40K.OriginPath.Short.${step.key}`;
            const localized = game.i18n.localize(key);
            labels[step.key] = localized !== key ? localized : step.key;
        }
        return labels;
    }

    // ── Fate Point Uses ──────────────────────────────────────────

    /**
     * Canonical list of ways a Fate Point can be spent in this game system.
     * The default returns the DH2e core uses (which match BC / OW / DW / DH1e
     * within minor wording differences and are a safe baseline for RT and IM
     * until a per-system override lands). Subclasses override to surface
     * system-specific entries (e.g. IM's Patron Boons).
     */
    getFatePointUses(): FatePointUseDef[] {
        return [
            { key: 'reroll', label: 'WH40K.FateUses.RerollTitle', description: 'WH40K.FateUses.RerollDesc', icon: 'fa-dice-d10' },
            { key: 'addBonus', label: 'WH40K.FateUses.AddBonusTitle', description: 'WH40K.FateUses.AddBonusDesc', icon: 'fa-plus' },
            { key: 'countHit', label: 'WH40K.FateUses.CountHitTitle', description: 'WH40K.FateUses.CountHitDesc', icon: 'fa-crosshairs' },
            { key: 'recoverWounds', label: 'WH40K.FateUses.RecoverWoundsTitle', description: 'WH40K.FateUses.RecoverWoundsDesc', icon: 'fa-heart' },
            { key: 'recoverStun', label: 'WH40K.FateUses.RecoverStunTitle', description: 'WH40K.FateUses.RecoverStunDesc', icon: 'fa-bolt' },
            { key: 'survive', label: 'WH40K.FateUses.SurviveTitle', description: 'WH40K.FateUses.SurviveDesc', icon: 'fa-skull', burn: true },
        ];
    }

    // ── Fatigue Model (#114) ─────────────────────────────────────

    /**
     * The line's RAW fatigue rule set. The default is the `flat` model
     * (RT / OW / BC — a single −10 for any fatigue, threshold TB, no death,
     * 6-hour full recovery). DH1/DH2 override to `halving`, IM to `condition`,
     * DW to the flat model with faster recovery + drop-one-level waking. The
     * active model can be overridden at runtime by the world "fatigue mode"
     * setting via `resolveFatigueModel`.
     */
    getFatigueModel(): FatigueModelDef {
        return FATIGUE_MODES.flat;
    }

    // ── Skill Level Mapping ──────────────────────────────────────

    /**
     * Map an origin path skill level string to a numeric rank.
     * Handles both RT ('trained','plus10','plus20') and
     * DH2e ('known','trained','experienced','veteran') terminology.
     */
    static skillLevelToRank(level: string): number {
        const map: Record<string, number> = {
            known: 1,
            trained: 1,
            plus10: 2,
            experienced: 3,
            plus20: 3,
            veteran: 4,
            plus30: 4,
        };
        return map[level] ?? 0;
    }

    // ── 4-Level Skill Ranks ──────────────────────────────────────

    getSkillRanks(): SkillRankDef[] {
        return [
            { level: 1, key: 'trained', label: 'WH40K.Skills.RankShort.Known', tooltip: 'WH40K.Skills.Rank.Known', bonus: 0 },
            { level: 2, key: 'plus10', label: 'WH40K.Skills.RankShort.Trained', tooltip: 'WH40K.Skills.Rank.Trained', bonus: 10 },
            { level: 3, key: 'plus20', label: 'WH40K.Skills.RankShort.Experienced', tooltip: 'WH40K.Skills.Rank.Experienced', bonus: 20 },
            { level: 4, key: 'plus30', label: 'WH40K.Skills.RankShort.Veteran', tooltip: 'WH40K.Skills.Rank.Veteran', bonus: 30 },
        ];
    }

    // ── 5-Tier Characteristic Advancement ────────────────────────

    getCharacteristicTiers(): CharacteristicTierDef[] {
        return [
            { key: 'simple', label: 'WH40K.Advancement.Tier.Simple' },
            { key: 'intermediate', label: 'WH40K.Advancement.Tier.Intermediate' },
            { key: 'trained', label: 'WH40K.Advancement.Tier.Trained' },
            { key: 'proficient', label: 'WH40K.Advancement.Tier.Proficient' },
            { key: 'expert', label: 'WH40K.Advancement.Tier.Expert' },
        ];
    }

    // ── Cost Tables ──────────────────────────────────────────────

    /**
     * Skill advance cost table: [matchingAptitudes][rankIndex].
     * Default is DH2e Table 2-4. Subclasses can override.
     */
    getSkillCostTable(): Record<number, number[]> {
        return {
            2: [100, 200, 300, 400],
            1: [200, 400, 600, 800],
            0: [300, 600, 900, 1200],
        };
    }

    /**
     * Characteristic advance cost table: [matchingAptitudes][tierIndex].
     * Default is DH2e Table 2-2. Subclasses can override.
     */
    getCharacteristicCostTable(): Record<number, number[]> {
        return {
            2: [100, 250, 500, 750, 1250],
            1: [250, 500, 750, 1000, 1500],
            0: [500, 750, 1000, 1500, 2500],
        };
    }

    /**
     * Talent advance cost table: [matchingAptitudes] at each tier.
     * Default is DH2e Table 2-6. Subclasses can override.
     */
    getTalentCostTable(): Record<number, Record<number, number>> {
        return {
            1: { 2: 200, 1: 300, 0: 600 },
            2: { 2: 300, 1: 450, 0: 900 },
            3: { 2: 400, 1: 600, 0: 1200 },
        };
    }

    // ── Aptitude Resolution ──────────────────────────────────────

    /**
     * The 2 aptitudes associated with each characteristic (DH2e Core Table 2-3).
     * Default shared by DH2e / BC / OW / IM; override only on genuine divergence.
     */
    getCharacteristicAptitudes(charKey: string): [string, string] {
        const map: Record<string, [string, string]> = {
            weaponSkill: ['Weapon Skill', 'Offence'],
            ballisticSkill: ['Ballistic Skill', 'Finesse'],
            strength: ['Strength', 'Offence'],
            toughness: ['Toughness', 'Defence'],
            agility: ['Agility', 'Finesse'],
            intelligence: ['Intelligence', 'Knowledge'],
            perception: ['Perception', 'Fieldcraft'],
            willpower: ['Willpower', 'Psyker'],
            fellowship: ['Fellowship', 'Social'],
        };
        return map[charKey] ?? ['General', 'General'];
    }

    /**
     * Get the 2 aptitudes associated with a skill.
     * Default implementation reads from a skill aptitude table.
     * Subclasses can override if their table differs.
     */
    getSkillAptitudes(skillKey: string): [string, string] {
        return this.getSkillAptitudeTable()[skillKey] ?? ['General', 'General'];
    }

    /**
     * Skill aptitude pairs (DH2e Core Table 2-5). Default shared by DH2e / BC / OW / IM;
     * override only on genuine divergence. Keys are schema skill keys (camelCase).
     */
    getSkillAptitudeTable(): Record<string, [string, string]> {
        return {
            acrobatics: ['Agility', 'General'],
            athletics: ['Strength', 'General'],
            awareness: ['Perception', 'Fieldcraft'],
            charm: ['Fellowship', 'Social'],
            command: ['Fellowship', 'Leadership'],
            commerce: ['Intelligence', 'Knowledge'],
            commonLore: ['Intelligence', 'General'],
            deceive: ['Fellowship', 'Social'],
            dodge: ['Agility', 'Defence'],
            forbiddenLore: ['Intelligence', 'Knowledge'],
            inquiry: ['Fellowship', 'Social'],
            interrogation: ['Willpower', 'Social'],
            intimidate: ['Strength', 'General'],
            linguistics: ['Intelligence', 'General'],
            logic: ['Intelligence', 'Knowledge'],
            medicae: ['Intelligence', 'Fieldcraft'],
            navigate: ['Intelligence', 'Fieldcraft'],
            operate: ['Agility', 'Fieldcraft'],
            parry: ['Weapon Skill', 'Defence'],
            psyniscience: ['Perception', 'Psyker'],
            scholasticLore: ['Intelligence', 'Knowledge'],
            scrutiny: ['Perception', 'General'],
            security: ['Intelligence', 'Tech'],
            sleightOfHand: ['Agility', 'Knowledge'],
            stealth: ['Agility', 'Fieldcraft'],
            survival: ['Perception', 'Fieldcraft'],
            techUse: ['Intelligence', 'Tech'],
            trade: ['Intelligence', 'General'],
        };
    }

    /**
     * Aptitudes every actor in an aptitude-based system possesses regardless of
     * origin path. Per DH2 Core p.79 (and the equivalent BC/DW/OW/IM rules) the
     * General aptitude is universal — it is never granted by home world /
     * background / role / elite, so it is injected at read time rather than
     * stored on the actor. Most basic skill and talent advances list General as
     * one of their two aptitudes, so without this they would always be mispriced
     * as a 0-match (most expensive) advance. Subclasses may override only on
     * genuine divergence.
     */
    readonly universalAptitudes: readonly string[] = ['General'];

    /**
     * Collect all aptitudes the actor possesses: the origin-path-granted aptitudes
     * stored on `system.aptitudes` plus the always-present {@link universalAptitudes}
     * (General). Works for both characters and NPCs — NPCs carry no aptitudes array,
     * so they resolve to just the universal set. Case-insensitive dedupe keeps a
     * granted "General" from doubling the injected one.
     */
    getCharacterAptitudes(actor: WH40KBaseActor): string[] {
        const apts = actor.system.aptitudes;
        const granted = apts === undefined ? [] : Array.isArray(apts) ? [...apts] : [...apts];
        const result = [...granted];
        for (const universal of this.universalAptitudes) {
            if (!result.some((a) => a.toLowerCase() === universal.toLowerCase())) result.push(universal);
        }
        return result;
    }

    /**
     * Count how many of the advance's aptitudes the character shares (0, 1, or 2).
     */
    countMatchingAptitudes(characterAptitudes: string[], advanceAptitudes: string[]): number {
        const charSet = new Set(characterAptitudes.map((a) => a.toLowerCase()));
        return advanceAptitudes.filter((a) => charSet.has(a.toLowerCase())).length;
    }

    /**
     * Compute match metadata for an advance's aptitudes. Used by the advancement
     * dialog to render 2/1/0 indicator dots and show which aptitudes matched.
     */
    getAdvanceMatchInfo(actor: WH40KBaseActor, advanceAptitudes: string[]): { matches: number; matched: string[]; unmatched: string[]; all: string[] } {
        const characterAptitudes = this.getCharacterAptitudes(actor);
        const charSet = new Set(characterAptitudes.map((a) => a.toLowerCase()));
        const matched: string[] = [];
        const unmatched: string[] = [];
        for (const apt of advanceAptitudes) {
            if (charSet.has(apt.toLowerCase())) matched.push(apt);
            else unmatched.push(apt);
        }
        return { matches: matched.length, matched, unmatched, all: [...advanceAptitudes] };
    }

    // ── Cost Implementations ─────────────────────────────────────

    getCharacteristicAdvanceCost(actor: WH40KBaseActor, charKey: string, currentTier: number): AdvanceCostResult | null {
        const tiers = this.characteristicTierOrder;
        if (currentTier >= tiers.length) return null;

        const charAptitudes = this.getCharacterAptitudes(actor);
        const advAptitudes = this.getCharacteristicAptitudes(charKey);
        const matches = this.countMatchingAptitudes(charAptitudes, advAptitudes);

        const costRow = this.getCharacteristicCostTable()[matches] as number[] | undefined;
        const cost = costRow?.[currentTier];
        const tier = tiers[currentTier] as string | undefined;
        if (cost === undefined || tier === undefined) return null;

        return { cost, tier };
    }

    // eslint-disable-next-line no-restricted-syntax -- boundary: context matches abstract base signature; advanceAptitudes extracted and typed by extractContextAptitudes
    getSkillAdvanceCost(actor: WH40KBaseActor, skillKey: string, currentRank: number, context?: Record<string, unknown>): number | null {
        if (currentRank >= this.skillRankCount) return null;

        const charAptitudes = this.getCharacterAptitudes(actor);
        const advAptitudes = extractContextAptitudes(context) ?? this.getSkillAptitudes(skillKey);
        const matches = this.countMatchingAptitudes(charAptitudes, advAptitudes);

        return (this.getSkillCostTable()[matches] as number[] | undefined)?.[currentRank] ?? null;
    }

    // eslint-disable-next-line no-restricted-syntax -- boundary: talent and context match abstract base signature; talent cast to TalentLike below; context validated by extractContextAptitudes
    getTalentAdvanceCost(actor: WH40KBaseActor, talent: unknown, context?: Record<string, unknown>): number | null {
        const charAptitudes = this.getCharacterAptitudes(actor);
        const talentSystem = (talent as TalentLike | undefined)?.system;
        const advAptitudes = extractContextAptitudes(context) ?? talentSystem?.aptitudes ?? [];
        const matches = this.countMatchingAptitudes(charAptitudes, advAptitudes);

        const tier = typeof talentSystem?.tier === 'number' ? talentSystem.tier : 1;
        return (this.getTalentCostTable()[tier] as Record<number, number> | undefined)?.[matches] ?? null;
    }

    getAvailableAdvances(_actor: WH40KBaseActor): AdvanceOption[] {
        // Aptitude-based: all skills/talents available. The advancement dialog
        // queries compendiums and computes costs dynamically.
        return [];
    }

    // ── DH2e/BC/OW Skill Visibility ─────────────────────────────

    /** Skills available in 4-rank aptitude-based systems (DH2e, BC, OW) */
    getVisibleSkills(): Set<string> {
        return new Set([
            // Standard skills
            'acrobatics',
            'athletics',
            'awareness',
            'charm',
            'command',
            'commerce',
            'deceive',
            'dodge',
            'inquiry',
            'interrogation',
            'intimidate',
            'logic',
            'medicae',
            'parry',
            'psyniscience',
            'scrutiny',
            'security',
            'sleightOfHand',
            'stealth',
            'survival',
            'techUse',
            // Specialist groups
            'commonLore',
            'forbiddenLore',
            'linguistics',
            'navigate',
            'operate',
            'scholasticLore',
            'trade',
        ]);
    }
}

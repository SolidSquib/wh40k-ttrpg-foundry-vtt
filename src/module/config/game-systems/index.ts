/**
 * @file System configuration registry.
 * Provides type-safe access to per-system configuration via singleton instances.
 */

import { OWSystemConfig } from './ow-config.ts';
import type { GameSystemId, SystemThemeRole } from './types.ts';

/** Singleton instances, one per game system */
const SYSTEM_CONFIGS: Record<GameSystemId, OWSystemConfig> = {
    ow: new OWSystemConfig(),
};

/**
 * System config registry.
 * Entry point for all system-specific behavior.
 */
export const SystemConfigRegistry = {
    /**
     * Get a system config by ID.
     * @throws If the ID is unknown
     */
    get(id: GameSystemId): OWSystemConfig {
        return SYSTEM_CONFIGS[id];
    },

    /** Get a system config by ID, or null if unknown */
    getOrNull(id: string): OWSystemConfig | null {
        if (!(id in SYSTEM_CONFIGS)) return null;
        return SYSTEM_CONFIGS[id as GameSystemId];
    },

    /** Get all registered system configs */
    getAll(): OWSystemConfig[] {
        return Object.values(SYSTEM_CONFIGS);
    },

    /** Get all system IDs */
    getIds(): GameSystemId[] {
        return Object.keys(SYSTEM_CONFIGS) as GameSystemId[];
    },

    /** Check if a system ID is registered */
    has(id: string): boolean {
        return id in SYSTEM_CONFIGS;
    },
} as const;

/**
 * Tailwind utility prefixes for each `SystemThemeRole`.
 * Extend this map when a new role becomes useful (e.g. ring/divider/text).
 */
const ROLE_PREFIX: Record<SystemThemeRole, string> = {
    primary: 'tw-bg-',
    accent: 'tw-text-',
    border: 'tw-border-',
};

/**
 * Resolve a per-system theme role into a concrete Tailwind utility class.
 *
 * Used by Handlebars helpers and TS sheet code so templates ask for a
 * semantic role (`'border'`, `'accent'`) rather than naming a specific
 * color, and palette changes happen in one place
 * (`<id>-config.ts` `theme` block).
 *
 * @example
 *   themeClassFor('dh2', 'border')  // → 'tw-border-gold-raw-d10'
 *   themeClassFor('rt', 'primary')   // → 'tw-bg-accent-dynasty'
 */
export function themeClassFor(systemId: GameSystemId, role: SystemThemeRole): string {
    const config = SystemConfigRegistry.get(systemId);
    return `${ROLE_PREFIX[role]}${config.theme[role]}`;
}

// Re-exports
export { OWSystemConfig } from './ow-config.ts';
export type {
    GameSystemId,
    SkillRankDef,
    CharacteristicTierDef,
    FatePointUseDef,
    OriginStepDef,
    OriginStepConfig,
    AdvanceCostResult,
    AdvanceOption,
    Prerequisite,
    ChaosAlignment,
    SidebarHeaderField,
    SystemTheme,
    SystemThemeRole,
} from './types.ts';

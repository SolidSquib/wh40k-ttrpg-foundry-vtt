/**
 * @file Per-game-system sheet variants.
 *
 * Only War gets concrete sheets for player characters, NPCs and craft that
 * share a system config (CSS class + header template + skill-rank labels). The
 * factory generates them from the same config so one touch to the CSS class or
 * skill ranks updates them in lock-step.
 */

import { SystemConfigRegistry } from '../../config/game-systems/index.ts';
import type { GameSystemId } from '../../config/game-systems/types.ts';
import CharacterSheet from './character-sheet.ts';
import CraftActorSheet from './craft-sheet.ts';
import NPCSheet from './npc-sheet.ts';

const HEADER = 'systems/wh40k-rpg/templates/actor/player/';

interface SystemSheetConfig {
    cssClass: string;
    headerFile: string;
    gameSystemId: GameSystemId;
}

type SkillRanks = ReturnType<ReturnType<typeof SystemConfigRegistry.get>['getSkillRanks']>;

interface SystemVariantBase {
    /* eslint-disable @typescript-eslint/no-explicit-any -- TypeScript mixin requirement: must accept any[] for `class extends baseCls` */
    // biome-ignore lint/suspicious/noExplicitAny: TypeScript mixin requirement: must accept any[] for `class extends baseCls`
    new (...args: any[]): object;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    DEFAULT_OPTIONS?: Partial<ApplicationV2Config.DefaultOptions>;
    PARTS: Record<string, { template?: string }>;
}

/**
 * Which sidebar header a sheet family renders: the line's player header (PC and
 * NPC sheets), or the base class's own (craft and voidcraft headers carry hull,
 * locomotion and quick-stat fields a player header has no slot for).
 */
type HeaderSource = 'line-player-header' | 'own-header';

/**
 * Build a concrete sheet class on top of a base sheet, adding the system's CSS
 * class, skill-rank config and — for PC/NPC families only — the line's header.
 */
function makeSystemVariant<TBase extends SystemVariantBase>(baseCls: TBase, className: string, cfg: SystemSheetConfig, headerSource: HeaderSource): TBase {
    const header = headerSource === 'line-player-header' ? { ...baseCls.PARTS['header'], template: HEADER + cfg.headerFile } : baseCls.PARTS['header'];
    const cls = class extends baseCls {
        static override DEFAULT_OPTIONS: Partial<ApplicationV2Config.DefaultOptions> = {
            ...baseCls.DEFAULT_OPTIONS,
            classes: [...(baseCls.DEFAULT_OPTIONS?.classes ?? []), cfg.cssClass],
        };
        static override PARTS = { ...baseCls.PARTS, header };
    };
    const systemConfig = SystemConfigRegistry.get(cfg.gameSystemId);
    const proto = cls.prototype as { _getSkillTrainingConfig?: () => SkillRanks; _gameSystemId?: GameSystemId };
    // Resolved per render: the langpack is not loaded yet when sheet classes are defined.
    proto._getSkillTrainingConfig = () => systemConfig.getLocalizedSkillRanks();
    proto._gameSystemId = cfg.gameSystemId;
    Object.defineProperty(cls, 'name', { value: className });
    return cls;
}

const ONLY_WAR: SystemSheetConfig = { cssClass: 'only-war', headerFile: 'header-dh.hbs', gameSystemId: 'ow' };

// -- Player, NPC and craft sheets (the craft header carries hull, locomotion and quick-stat fields) --

export const OnlyWarPlayerSheet = makeSystemVariant(CharacterSheet, 'OnlyWarPlayerSheet', ONLY_WAR, 'line-player-header');
export const OnlyWarNPCSheet = makeSystemVariant(NPCSheet, 'OnlyWarNPCSheet', ONLY_WAR, 'line-player-header');
export const OnlyWarCraftSheet = makeSystemVariant(CraftActorSheet, 'OnlyWarCraftSheet', ONLY_WAR, 'own-header');

// -- Back-compat alias ---------------------------------------------------
// Keeps `flags.core.sheetClass = 'wh40k-rpg.OnlyWarSheet'` values on player actors resolving.

export const OnlyWarSheet = OnlyWarPlayerSheet;

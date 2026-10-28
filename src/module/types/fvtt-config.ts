/**
 * Module augmentation for fvtt-types.
 *
 * Registers the system's document classes and data model subtypes with
 * the fvtt-types configuration interfaces so that TypeScript can resolve
 * Actor.system / Item.system to the correct DataModel type.
 *
 * This file must be kept in sync with the runtime registrations in
 * hooks-manager.ts (CONFIG.Actor.documentClass, CONFIG.Item.documentClass,
 * CONFIG.Actor.dataModels, CONFIG.Item.dataModels).
 *
 * **It has no importers, by design, and must not acquire one.** The file exports
 * nothing: its entire body is `declare module 'fvtt-types/configuration'`, which
 * takes effect purely by being inside the compilation. TypeScript reaches it via
 * `tsconfig.json`'s `include`, not via an import — `import`ing an augmentation is
 * not how augmentations apply. So it is listed in `knip.json`'s `ignore`
 * alongside `foundry-v14-overrides.d.ts` / `i18n-keys.d.ts` / `icon-keys.d.ts`:
 * a file that *cannot* have an importer is a knip false positive, not an unused
 * file. That is the only thing an `ignore` entry may be used for — never to
 * silence a module that could be wired, merged, or deleted.
 */

// Actor data models (concrete per-system classes)
import type { OWAircraftData, OWCharacterData, OWNPCData, OWTerracraftData } from '../data/actor/_module.ts';
// Item data models
import type {
    AmmunitionData,
    AptitudeData,
    ArmourData,
    ArmourModificationData,
    AttackSpecialData,
    BackpackData,
    ConditionData,
    CriticalInjuryData,
    CyberneticData,
    ForceFieldData,
    GearData,
    JournalEntryItemData,
    LocationData,
    MalignancyData,
    MentalDisorderData,
    MutationData,
    NPCTemplateData,
    OrderData,
    OriginPathData,
    PsychicPowerData,
    SkillData,
    SpecialAbilityData,
    StorageLocationData,
    TalentData,
    TraitData,
    VehicleTraitData,
    VehicleUpgradeData,
    WeaponData,
    WeaponModificationData,
    WeaponQualityData,
} from '../data/item/_module.ts';
// Document classes
import type { WH40KActiveEffect } from '../documents/active-effect.ts';
import type { WH40KBaseActor } from '../documents/base-actor.ts';
import type { ChatMessageWH40K } from '../documents/chat-message.ts';
import type { WH40KItem } from '../documents/item.ts';
import type { TokenDocumentWH40K } from '../documents/token.ts';

declare module 'fvtt-types/configuration' {
    interface SystemNameConfig {
        name: 'wh40k-rpg';
    }

    interface SettingConfig {
        [key: `wh40k-rpg.${string}`]: foundry.helpers.ClientSettings.Type;
    }

    /* eslint-disable no-restricted-syntax -- boundary: Foundry FlagConfig requires Record<string,unknown> shapes per fvtt-types interface */
    interface FlagConfig {
        Actor: {
            'wh40k-rpg': Record<string, unknown>;
            'rt'?: Record<string, unknown>;
        };
        Item: {
            'wh40k-rpg': Record<string, unknown>;
            'rt'?: Record<string, unknown>;
        };
        ChatMessage: {
            'wh40k-rpg': Record<string, unknown>;
        };
        User: {
            'wh40k-rpg': Record<string, unknown>;
        };
        // The GM-only campaign event graph lives in a JournalEntry flag (#33) —
        // declaring the scope here is what lets `entry.flags['wh40k-rpg']` be read
        // without a cast at the one site that reads it.
        JournalEntry: {
            'wh40k-rpg': Record<string, unknown>;
        };
        // Token-scoped state (the rounded-rect ring mode, #587; the bust frame)
        // written through TokenDocument#updateSource.
        Token: {
            'wh40k-rpg': Record<string, unknown>;
        };
        // Scene-scoped state (Warp weakness, #137; celestial-body binding and latitude, #588), and
        // the Zephyr Cartography module's own scene flags, whose `sun` the sun sync reads back.
        Scene: {
            'wh40k-rpg': Record<string, unknown>;
            'zephyr-cartography'?: Record<string, unknown>;
        };
    }
    /* eslint-enable no-restricted-syntax */

    interface DocumentClassConfig {
        // WH40KActorProxy is a Proxy around WH40KBaseActor — its type is typeof WH40KBaseActor
        Actor: typeof WH40KBaseActor;
        Item: typeof WH40KItem;
        ActiveEffect: typeof WH40KActiveEffect;
        ChatMessage: typeof ChatMessageWH40K;
        TokenDocument: typeof TokenDocumentWH40K;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- type param required by fvtt-types parent interface; body maps to single document type
    interface ConfiguredActor<SubType extends Actor.SubType> {
        document: WH40KBaseActor;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- type param required by fvtt-types parent interface; body maps to single document type
    interface ConfiguredItem<SubType extends Item.SubType> {
        document: WH40KItem;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- type param required by fvtt-types parent interface; body maps to single document type
    interface ConfiguredActiveEffect<SubType extends ActiveEffect.SubType> {
        document: WH40KActiveEffect;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- type param required by fvtt-types parent interface; body maps to single document type
    interface ConfiguredChatMessage<SubType extends ChatMessage.SubType> {
        document: ChatMessageWH40K;
    }

    interface DataModelConfig {
        Actor: {
            'ow-character': typeof OWCharacterData;
            'ow-npc': typeof OWNPCData;
            'ow-terracraft': typeof OWTerracraftData;
            'ow-aircraft': typeof OWAircraftData;
        };
        Item: {
            weapon: typeof WeaponData;
            armour: typeof ArmourData;
            ammunition: typeof AmmunitionData;
            gear: typeof GearData;
            consumable: typeof GearData;
            tool: typeof GearData;
            drug: typeof GearData;
            cybernetic: typeof CyberneticData;
            forceField: typeof ForceFieldData;
            backpack: typeof BackpackData;
            storageLocation: typeof StorageLocationData;
            talent: typeof TalentData;
            trait: typeof TraitData;
            skill: typeof SkillData;
            originPath: typeof OriginPathData;
            aptitude: typeof AptitudeData;
            condition: typeof ConditionData;
            psychicPower: typeof PsychicPowerData;
            order: typeof OrderData;
            vehicleTrait: typeof VehicleTraitData;
            vehicleUpgrade: typeof VehicleUpgradeData;
            weaponModification: typeof WeaponModificationData;
            armourModification: typeof ArmourModificationData;
            weaponQuality: typeof WeaponQualityData;
            attackSpecial: typeof AttackSpecialData;
            specialAbility: typeof SpecialAbilityData;
            criticalInjury: typeof CriticalInjuryData;
            mutation: typeof MutationData;
            malignancy: typeof MalignancyData;
            mentalDisorder: typeof MentalDisorderData;
            journalEntry: typeof JournalEntryItemData;
            location: typeof LocationData;
            npcTemplate: typeof NPCTemplateData;
        };
    }
}

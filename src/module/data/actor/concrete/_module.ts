/**
 * Concrete data models, one per (system, kind) pair.
 *
 * Naming: {System}{Kind}Data, file {system}-{kind}.ts.
 * Each is a thin class extending its kind base (CharacterBaseData /
 * NPCBaseData / TerracraftData / VoidcraftData) and stamped with a
 * `gameSystem` static identifier. Per-system schema divergence is added
 * by overriding defineSchema in the relevant concrete class when needed.
 *
 * Conventional craft default to the land subtype (`*-terracraft.ts`,
 * extending `TerracraftData`). Per-line aircraft / watercraft concrete
 * models are added only when that line authors air/water content.
 */

// Only War
export { default as OWCharacterData } from './ow-character.ts';
export { default as OWNPCData } from './ow-npc.ts';
export { default as OWTerracraftData } from './ow-terracraft.ts';
export { default as OWAircraftData } from './ow-aircraft.ts';

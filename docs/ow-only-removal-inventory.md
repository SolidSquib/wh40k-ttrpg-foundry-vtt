# Only War-only refactor: removal inventory

Status: **analysis only, nothing deleted.** Generated from the repo at this commit. Decisions confirmed by the owner: keep the `ow-*` actor type ids; keep Corruption/Insanity content (malignancy, mutation, mentalDisorder + sheets, chat cards, schema); keep aircraft/watercraft/terracraft craft types; upstream merges are not needed.

## 1. Delete outright: system-prefixed files (175)

Every file named `bc-`, `dw-`, `rt-`, `dh1-`, `dh2-`, `im-` outside `src/packs*`. Counts by directory:

- `src/module/rules/` - 36 files, 7452 lines
- `src/templates/actor/panel/` - 33 files, 3670 lines
- `src/module/data/actor/concrete/` - 23 files, 230 lines
- `tests/e2e/` - 19 files, 3574 lines
- `src/templates/chat/` - 18 files, 1472 lines
- `src/module/actions/` - 17 files, 2663 lines
- `src/module/data/actor/mixins/` - 15 files, 1213 lines
- `src/module/config/game-systems/` - 10 files, 1536 lines
- `tests/` - 2 files, 150 lines
- `stories/actor-panels/` - 1 files, 168 lines
- `stories/chat-cards/` - 1 files, 122 lines

## 2. Delete: unprefixed files that only serve other lines (curated)

**Actor documents & data (Rogue Trader starships, other-line craft)**

- src/module/data/actor/voidcraft.ts
- src/module/data/actor/voidcraft.test.ts
- src/module/documents/voidcraft.ts
- src/module/documents/bases/voidcraft-doc-base.ts
- src/module/applications/actor/voidcraft-sheet.ts
- src/templates/actor/voidcraft/ (whole dir)
- src/module/data/actor/mixins/dw-*.ts, bc-*.ts (all)
- src/module/data/actor/concrete/{bc,dh1,dh2,dw,im,rt}-*.ts

**Item types with no Only War use**

- data/item: ship-component, ship-role, ship-upgrade, ship-weapon, navigator-power, endeavour, oath, ritual, peer-enemy, lead (+ ship-stat-modifiers-template)
- applications/item: ship-*-sheet, endeavour-sheet, lead-sheet, peer-enemy-sheet (+ stories)
- templates/item: ship-*-sheet.hbs, item-endeavour-sheet.hbs, item-lead-sheet.hbs, item-peer-enemy-sheet.hbs
- utils/ship-choices.ts

**Rules / dialogs only other lines use**

- rules: ship-{boarding,crew-morale,hit-and-run,manoeuvres,ramming}, navigator-powers, daemonhost, daemon-weapon(+attribute-tables), daemonic-{immunities,mastery}, sanctic-{daemonology,purity}, malefic-corruption, summoning-ritual, exorcism, chaos-backgrounds, crusader, dark-pact, ace-role, fanatic, sister-of-battle, assassins-strike, subtlety-adjusters(+effects), without-talents, beyond-homeworlds, homeworld-compendium, homeworlds-common, acquisition-{resources,scale}, requisition-{rail,test,transfer}, radical-services, xenos-equipment
- applications/dialogs: acquisition-dialog, right-stuff-dialog, radical-services-dialog
- applications/prompts: colony-growth-dialog, daemon-weapon-attribute-dialog, daemonhost-binding-dialog, mutant-background-dialog, sister-of-battle-dialog
- templates/chat: acquisition-test, colony-growth-chat, crusader-chat, daemonhost-binding-chat, daemon-weapon-attribute-chat, fanatic-chat, mutant-background-chat, navigator-power-chat, aerial/manoeuvre ship cards (check), medicae-mechadendrite-chat

## 3. Keep despite looking foreign (review before touching)

- `rules/{burst-spread,auto-fire,hit-allocation,climbing,damage-type,difficulties,target-size,weapon-jam,xp-costs,untrained-skill,action-budget,high-ground,gang-up,manacles,npc-advancement,armoury}.ts` - Header cites DH2, but the maths is the shared FFG core rules Only War also uses (DH2 is the engine's reference implementation). KEEP; only rename/strip "per line" tables.
- `rules/medicae-mechadendrite.ts, cybernetics-install-dialog.ts` - Mechadendrite is an Adeptus Mechanicus/OW Tech-Priest item. Likely KEEP - confirm.
- `default-grants.ts, data/shared/{characteristics,experience-math,skill-math,equippable-template,physical-item-template}.ts` - Shared; contain DW renown / DH2 branches to cut out, not delete.
- `config/game-systems/{career-based,aptitude-based,base}-system-config.ts` - Collapse into one OW config (class hierarchy exists only to serve seven lines).
- `config/advancements/career-advancement-cache.ts` - Career advancement (DH1/RT/DW). Delete with career-based config unless OW advanced specialities use it - check.
- `utils/{item-variant-utils,game-system-pack-prefix}.ts, documents/item.ts createDocuments` - Per-line variant machinery. Collapse to plain values - touches the owned-item create path; needs its own tests.

## 4. Shared files that must be edited (the real work)

- `applications/actor/character-sheet.ts` - 24 imports of other-line code + 8 literal branches. Largest single edit.
- `applications/character-creation/origin-path-builder.ts` - 8 other-line branches; rewritten anyway by the Regiment/Speciality split.
- `applications/prompts/unified-roll-dialog.ts` - 5 branches (gang-up / high-ground / per-line modifiers).
- `data/actor/character.ts` - Drop ~20 schema-mixin spreads, gameSystem choices; lines 838/962-973 gameSystem derivation.
- `data/actor/npc.ts, data/actor/mixins/horde-template.ts, rolls/assign-damage-data.ts` - Import dw-vehicle-template / dw-horde-magnitude. Horde magnitude is also an OW rule - MOVE it to a neutral name instead of deleting.
- `data/shared/physical-item-template.ts` - Imports dw-renown (item renown requirement). Remove field.
- `documents/base-actor.ts` - 3 branches; isCharacterActorType() accepts "character" + "*-character".
- `config/game-systems/index.ts, types.ts, ow-config.ts` - Registry of seven configs; ALL_SYSTEM_IDS / GameSystemId used in ~150 call sites.
- `applications/components/wh40k-tooltip.ts, hooks-manager.ts, wh40k-rpg.ts` - Hook/registration lists for removed dialogs, sheets, data models.
- `rules/attack-options.ts, combat-actions.ts` - Remove modifierByLine/tooltipByLine; Standard Attack becomes +10 flat.
- `system.json, src/lang/en.json, src/module/types/i18n-keys.d.ts (generated)` - documentTypes, ~600 per-line lang keys, pack declarations.

## 5. Document types after the cut

**Actor (keep):** `ow-character`, `ow-npc`, `ow-vehicle`, `ow-terracraft`, `ow-aircraft`, plus a watercraft type (needs an `ow-` concrete model - none exists today, only the generic `watercraft`), and `loot`.

**Actor (delete):** all `dh1-/dh2-/rt-/bc-/dw-/im-*` types, generic `character/npc/vehicle/starship`, `terracraft/aircraft/voidcraft` generics (only if no OW concrete needs them as base; `TerracraftData` and `AircraftData` stay as bases), `rt-starship`.

**Item (keep):** ammunition, aptitude, armour, armourModification, attackSpecial, backpack, condition, consumable, criticalInjury, cybernetic, drug, forceField, gear, journalEntry, location, malignancy, mentalDisorder, miscellaneous, mutation, npcTemplate, order, originPath (to be split), psychicPower, skill, specialAbility, storageLocation, talent, tool, trait, vehicleTrait, vehicleUpgrade, weapon, weaponModification, weaponQuality.

**Item (delete):** endeavour, enemy, lead, navigatorPower, oath, peer, ritual, shipComponent, shipRole, shipUpgrade, shipWeapon. (`drug`, `aptitude`, `npcTemplate`, `vehicleUpgrade` kept pending a usage check.)

## 6. Appendix: all prefixed files

### src/module/actions
- bc-daemon-prince-actions.ts
- bc-psychic-actions.ts
- bc-ritual-actions.ts
- dw-ammo-actions.ts
- dw-astartes-actions.ts
- dw-cohesion-actions.test.ts
- dw-cohesion-actions.ts
- dw-distinction-actions.ts
- dw-mission-actions.test.ts
- dw-mission-actions.ts
- dw-mode-actions.ts
- dw-oath-actions.test.ts
- dw-oath-actions.ts
- dw-renown-actions.ts
- dw-requisition-actions.ts
- dw-vehicle-actions.test.ts
- dw-vehicle-actions.ts
### src/module/config/game-systems
- bc-advancement-config.test.ts
- bc-advancement-config.ts
- bc-config.test.ts
- bc-config.ts
- dh1-config.ts
- dh2-config.test.ts
- dh2-config.ts
- dw-config.ts
- im-config.ts
- rt-config.ts
### src/module/data/actor/concrete
- bc-character.ts
- bc-npc.ts
- bc-terracraft.ts
- dh1-character.ts
- dh1-npc.ts
- dh1-terracraft.ts
- dh2-aircraft.ts
- dh2-character.ts
- dh2-npc.ts
- dh2-terracraft.ts
- dw-aircraft.ts
- dw-character.ts
- dw-npc.ts
- dw-terracraft.ts
- im-character.ts
- im-npc.ts
- im-terracraft.ts
- rt-aircraft.ts
- rt-character.ts
- rt-npc.ts
- rt-terracraft.test.ts
- rt-terracraft.ts
- rt-voidcraft.ts
### src/module/data/actor/mixins
- bc-daemon-prince-template.ts
- bc-gifts-template.ts
- bc-psychic-template.ts
- bc-ritual-template.ts
- bc-supplements-template.ts
- dw-ammo-template.ts
- dw-astartes-template.ts
- dw-cohesion-template.ts
- dw-distinction-template.ts
- dw-mission-template.ts
- dw-mode-template.ts
- dw-oath-template.ts
- dw-renown-template.ts
- dw-requisition-template.ts
- dw-vehicle-template.ts
### src/module/rules
- bc-alignment-derivation.test.ts
- bc-alignment-derivation.ts
- bc-chaos-ritual.test.ts
- bc-chaos-ritual.ts
- bc-daemon-prince.test.ts
- bc-daemon-prince.ts
- bc-gifts.test.ts
- bc-gifts.ts
- bc-psychic-strength.test.ts
- bc-psychic-strength.ts
- bc-supplement-mechanics.test.ts
- bc-supplement-mechanics.ts
- dw-astartes.test.ts
- dw-astartes.ts
- dw-cohesion.test.ts
- dw-cohesion.ts
- dw-distinction.test.ts
- dw-distinction.ts
- dw-horde-magnitude.test.ts
- dw-horde-magnitude.ts
- dw-mission.test.ts
- dw-mission.ts
- dw-oath.test.ts
- dw-oath.ts
- dw-renown.test.ts
- dw-renown.ts
- dw-requisition.test.ts
- dw-requisition.ts
- dw-special-ammo.test.ts
- dw-special-ammo.ts
- dw-squad-mode.test.ts
- dw-squad-mode.ts
- dw-vehicle-crit.test.ts
- dw-vehicle-crit.ts
- rt-colony.test.ts
- rt-colony.ts
### src/templates/actor/panel
- bc-alignment-panel.hbs
- bc-alignment-panel.stories.ts
- bc-daemon-prince-panel.hbs
- bc-daemon-prince-panel.stories.ts
- bc-gifts-panel.hbs
- bc-gifts-panel.stories.ts
- bc-psychic-panel.hbs
- bc-psychic-panel.stories.ts
- bc-ritual-panel.hbs
- bc-ritual-panel.stories.ts
- bc-supplements-panel.hbs
- bc-supplements-panel.stories.ts
- dw-ammo-panel.hbs
- dw-ammo-panel.stories.ts
- dw-astartes-panel.hbs
- dw-astartes-panel.stories.ts
- dw-cohesion-panel.hbs
- dw-cohesion-panel.stories.ts
- dw-distinction-panel.hbs
- dw-distinction-panel.stories.ts
- dw-mission-panel.hbs
- dw-mission-panel.stories.ts
- dw-mode-panel.hbs
- dw-mode-panel.stories.ts
- dw-oath-panel.hbs
- dw-oath-panel.stories.ts
- dw-renown-panel.hbs
- dw-renown-panel.stories.ts
- dw-requisition-panel.hbs
- dw-requisition-panel.stories.ts
- dw-vehicle-panel.hbs
- dw-vehicle-panel.stories.ts
- im-statblock-panel.hbs
### src/templates/chat
- bc-ascension-chat.hbs
- bc-ascension-chat.stories.ts
- bc-psychic-test-chat.hbs
- bc-psychic-test-chat.stories.ts
- bc-ritual-chat.hbs
- bc-ritual-chat.stories.ts
- dw-cohesion-chat.hbs
- dw-cohesion-chat.stories.ts
- dw-mission-reward-chat.hbs
- dw-mission-reward-chat.stories.ts
- dw-mode-chat.hbs
- dw-mode-chat.stories.ts
- dw-oath-chat.hbs
- dw-oath-chat.stories.ts
- dw-requisition-chat.hbs
- dw-requisition-chat.stories.ts
- dw-vehicle-crit-chat.hbs
- dw-vehicle-crit-chat.stories.ts
### stories/actor-panels
- dw-horde-magnitude-panel.stories.ts
### stories/chat-cards
- dw-horde-magnitude-chat.stories.ts
### tests
- dh1-origin-builder-wiring.test.ts
- dh2-divination-content.test.ts
### tests/e2e
- bc-alignment-advancement.spec.ts
- bc-chaos-ritual.spec.ts
- bc-daemon-prince.spec.ts
- bc-gifts.spec.ts
- bc-psychic-strength.spec.ts
- bc-supplements.spec.ts
- dh2-flows.spec.ts
- dw-astartes.spec.ts
- dw-cohesion.spec.ts
- dw-distinctions.spec.ts
- dw-horde-magnitude.spec.ts
- dw-mission.spec.ts
- dw-oath.spec.ts
- dw-renown.spec.ts
- dw-requisition.spec.ts
- dw-special-ammo.spec.ts
- dw-squad-mode.spec.ts
- dw-vehicle-crit.spec.ts
- rt-colony-growth.spec.ts

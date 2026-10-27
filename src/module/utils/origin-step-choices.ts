/** Every origin-path step a document can sit in, grouped by the line that uses it. */
export const ORIGIN_STEP_CHOICES = [
    // Rogue Trader steps
    'homeWorld',
    'birthright',
    'lureOfTheVoid',
    'trialsAndTravails',
    'motivation',
    'career',
    'lineage', // Optional step for dynasty lineage
    'eliteAdvance',
    // Dark Heresy 2e steps
    'background',
    'role',
    'elite',
    'divination',
    // Black Crusade steps
    'race',
    'archetype',
    'pride',
    'disgrace',
    // Only War / Deathwatch steps
    'regiment',
    'speciality',
    // A Speciality taken at an experience milestone, not chosen in character creation.
    'advancedSpeciality',
    'chapter',
    // Only War regiment-creation options. These are picked in the Regiment Builder
    // (12-point budget), not in the origin-path chart, so they are deliberately
    // absent from the actor's `originPath` step map.
    'regimentType',
    'commandingOfficer',
    'trainingDoctrine',
    'equipmentDoctrine',
    'regimentalDrawback',
    'kitItem',
] as const;

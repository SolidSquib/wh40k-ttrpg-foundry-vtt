/** Every origin-path step an Only War origin document can sit in. */
export const ORIGIN_STEP_CHOICES = [
    'homeWorld',
    'regiment',
    'speciality',
    // A Speciality taken at an experience milestone, not chosen in character creation.
    'advancedSpeciality',
    // Regiment-creation options. These are picked in the Regiment Builder (12-point
    // budget), not in the origin-path chart, so they are deliberately absent from the
    // actor's `originPath` step map.
    'regimentType',
    'commandingOfficer',
    'trainingDoctrine',
    'equipmentDoctrine',
    'regimentalDrawback',
    'kitItem',
] as const;

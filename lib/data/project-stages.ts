/**
 * A project's lifecycle stage — a single value per project, ordered along the
 * arc from first idea to scaling. Distinct from the multi-value industry/focus
 * labels: those say what a project is about; stage says how far along it is.
 *
 * projects.stage is free text (nullable), so this list can change with no
 * migration; an unset stage just renders no badge.
 */
export const PROJECT_STAGES = ['Idea', 'Prototype', 'MVP', 'Launched', 'Revenue', 'Scaling'] as const

export type ProjectStage = (typeof PROJECT_STAGES)[number]

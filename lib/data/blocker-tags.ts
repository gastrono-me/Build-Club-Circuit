/** Tags used to categorise hackathon blockers in LINE mode.
 * "hackathon help" and "Other" are required per spec. */
export const BLOCKER_TAGS = [
  'Auth/Login',
  'Deploy/Infra',
  'RAG/Retrieval',
  'Agent loops',
  'Rate limits/Cost',
  'UI polish',
  'Demo prep',
  'Data/Eval',
  'hackathon help',
  'Other',
] as const

export type BlockerTag = (typeof BLOCKER_TAGS)[number]

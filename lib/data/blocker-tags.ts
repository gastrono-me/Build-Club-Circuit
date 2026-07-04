/** Categories a builder can file a blocker under on the Radar. */
export const BLOCKER_TAGS = [
  'Auth/Login',
  'Deploy/Infra',
  'RAG/Retrieval',
  'Agent loops',
  'Rate limits/Cost',
  'UI polish',
  'Launch/Demo',
  'Data/Eval',
  'Getting unstuck',
  'Other',
] as const

export type BlockerTag = (typeof BLOCKER_TAGS)[number]

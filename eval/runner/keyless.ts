// The keyless answerer (evals.md §2): the resolver and follow-up rules only,
// with no model. The resolver arrives in T51; until then every question is
// declined, so a keyless run covers nothing and can never be wrong.

import type { Answerer } from './run';

export const keylessAnswerer: Answerer = {
  mode: 'keyless',
  modelId: null,
  async answer() {
    return { outcome: { kind: 'decline', reason: 'No resolver yet: it arrives in T51.' } };
  },
};

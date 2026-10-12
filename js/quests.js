// Small quest chain. Three are active at a time; completing one pays out instantly.
import { G } from './state.js';
import { sfx } from './audio.js';
import { addMats } from './gear.js';

// t: kill | catch | fuse | boss | craft | hide ; goal: where the arrow points
export const QUESTS = [
  { id: 'q1', t: 'kill', n: 3, icon: 'sword', goal: 'mob', rew: { orbs: 3, mats: { hide: 3 } } },
  { id: 'q2', t: 'catch', n: 1, icon: 'orb', goal: 'mob', rew: { orbs: 3, mats: { hide: 2 } } },
  { id: 'q3', t: 'hide', n: 6, icon: 'hide', goal: 'mob', rew: { mats: { fang: 2 } } },
  { id: 'q4', t: 'craft', n: 1, icon: 'anvil', goal: 'forge', rew: { orbs: 4, berries: 2 } },
  { id: 'q5', t: 'catch', n: 3, icon: 'orb', goal: 'mob', rew: { orbs: 5, mats: { fang: 3 } } },
  { id: 'q6', t: 'fuse', n: 1, icon: 'flask', goal: 'lab', rew: { orbs: 5, mats: { gem: 2 } } },
  { id: 'q7', t: 'boss', n: 1, boss: 'b_meadow', icon: 'crown', goal: 'boss', rew: { orbs: 8, mats: { gem: 3 } } },
  { id: 'q8', t: 'kill', n: 15, icon: 'sword', goal: 'mob', rew: { orbs: 6, mats: { fang: 6 } } },
  { id: 'q9', t: 'craft', n: 3, icon: 'anvil', goal: 'forge', rew: { orbs: 6, mats: { gem: 3 } } },
  { id: 'q10', t: 'fuse', n: 3, icon: 'flask', goal: 'lab', rew: { orbs: 8, mats: { gem: 5 } } },
  { id: 'q11', t: 'boss', n: 3, icon: 'crown', goal: 'boss', rew: { orbs: 10, mats: { gem: 8, core: 1 } } },
  { id: 'q12', t: 'catch', n: 10, icon: 'orb', goal: 'mob', rew: { orbs: 10, mats: { gem: 6 } } },
  { id: 'q13', t: 'boss', n: 6, icon: 'crown', goal: 'boss', rew: { orbs: 20, mats: { core: 3, gem: 10 } } },
];
export const QUEST_TEXT = {
  kill: (q) => `Defeat ${q.n} creatures`, catch: (q) => `Catch ${q.n} creature${q.n > 1 ? 's' : ''}`, fuse: (q) => `Fuse ${q.n} pair${q.n > 1 ? 's' : ''}`,
  boss: (q) => (q.boss ? 'Defeat the meadow boss' : `Defeat ${q.n} bosses`), craft: (q) => `Craft ${q.n} gear upgrade${q.n > 1 ? 's' : ''}`, hide: (q) => `Collect ${q.n} hide`,
};
export const questText = (q) => QUEST_TEXT[q.t](q);
export const activeQuests = () => QUESTS.filter((q) => !G.quests.done[q.id]).slice(0, 3);
export const progressOf = (q) => {
  if (q.t === 'boss') return Math.min(q.n, q.boss ? (G.bosses[q.boss] ? 1 : 0) : Object.keys(G.bosses).length);
  if (q.t === 'craft') return Math.min(q.n, G.gear.w + G.gear.a);
  return Math.min(q.n, G.quests.prog[q.id] || 0);
};

export function complete(q) {
  G.quests.done[q.id] = 1;
  const r = q.rew; if (r.orbs) G.orbs += r.orbs; if (r.berries) G.berries += r.berries; if (r.mats) addMats(Object.entries(r.mats).map(([k, n]) => ({ k, n })));
  G.questFx = { t: 2.6, q };
  sfx.quest();
}
// Call from game events: questEvent('kill'), questEvent('catch'), questEvent('hide', n), questEvent('boss'), ...
export function questEvent(type, n = 1) {
  for (let guard = 0; guard < 4; guard++) {
    let again = false;
    for (const q of activeQuests()) {
      if (q.t !== type) continue;
      if (type !== 'boss' && type !== 'craft' && guard === 0) G.quests.prog[q.id] = (G.quests.prog[q.id] || 0) + n;
      if (progressOf(q) >= q.n) { complete(q); again = true; }
    }
    if (!again) break;
  }
}

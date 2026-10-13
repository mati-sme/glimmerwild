// Quest chain: 29 goals (q1-q13 keep their v2 ids so old saves stay valid; n* are new), three active at a time (in list order); completing one pays out instantly.
import { G } from './state.js';
import { sfx } from './audio.js';
import { addMats } from './gear.js';

// t: event quests count up from when they become active (kill | catch | fuse | hide | elite | boss).
//    computed quests read the game state directly (craft | lv | dex | weapon | armor | essence | skill).
// goal: where the HUD arrow points. rew: orbs / berries / ess (essence) / mats.
export const QUESTS = [
  { id: 'q1', t: 'kill', n: 3, icon: 'sword', goal: 'mob', rew: { orbs: 3, mats: { hide: 3 } } },
  { id: 'q2', t: 'catch', n: 1, icon: 'orb', goal: 'mob', rew: { orbs: 3, mats: { hide: 2 } } },
  { id: 'q3', t: 'hide', n: 6, icon: 'hide', goal: 'mob', rew: { mats: { fang: 2 } } },
  { id: 'q4', t: 'craft', n: 1, icon: 'anvil', goal: 'forge', rew: { orbs: 4, berries: 2 } },
  { id: 'q5', t: 'catch', n: 3, icon: 'orb', goal: 'mob', rew: { orbs: 5, mats: { fang: 3 } } },
  { id: 'n1', t: 'dex', n: 4, icon: 'paw', goal: 'mob', rew: { orbs: 4, ess: 2 } },
  { id: 'q7', t: 'boss', n: 1, boss: 'b_meadow', icon: 'crown', goal: 'boss', rew: { orbs: 8, ess: 4, mats: { gem: 3 } } },
  { id: 'q8', t: 'kill', n: 15, icon: 'sword', goal: 'mob', rew: { orbs: 6, mats: { fang: 6 } } },
  { id: 'n2', t: 'elite', n: 1, icon: 'elite', goal: 'mob', rew: { ess: 3, mats: { gem: 2 } } },
  { id: 'n3', t: 'weapon', n: 2, icon: 'sword', goal: 'forge', rew: { orbs: 5, ess: 2 } },
  { id: 'q9', t: 'craft', n: 3, icon: 'anvil', goal: 'forge', rew: { orbs: 6, mats: { gem: 3 } } },
  { id: 'n4', t: 'lv', n: 12, icon: 'paw', goal: 'mob', rew: { orbs: 6, ess: 3 } },
  { id: 'n5', t: 'essence', n: 10, icon: 'essence', goal: 'mob', rew: { orbs: 6, mats: { fang: 8 } } },
  { id: 'q6', t: 'fuse', n: 1, icon: 'flask', goal: 'lab', rew: { orbs: 5, mats: { gem: 2 } } },
  { id: 'n6', t: 'kill', n: 30, icon: 'sword', goal: 'mob', rew: { orbs: 8, mats: { fang: 8, gem: 2 } } },
  { id: 'n7', t: 'catch', n: 6, icon: 'orb', goal: 'mob', rew: { orbs: 8, ess: 3 } },
  { id: 'n8', t: 'armor', n: 3, icon: 'shield', goal: 'forge', rew: { orbs: 8, mats: { gem: 4 } } },
  { id: 'n9', t: 'elite', n: 3, icon: 'elite', goal: 'mob', rew: { ess: 5, mats: { gem: 4 } } },
  { id: 'n10', t: 'dex', n: 9, icon: 'paw', goal: 'mob', rew: { orbs: 8, ess: 4, berries: 2 } },
  { id: 'q11', t: 'boss', n: 3, icon: 'crown', goal: 'boss', rew: { orbs: 10, ess: 6, mats: { gem: 8, core: 1 } } },
  { id: 'q10', t: 'fuse', n: 3, icon: 'flask', goal: 'lab', rew: { orbs: 8, ess: 6, mats: { gem: 5 } } },
  { id: 'n11', t: 'lv', n: 25, icon: 'paw', goal: 'mob', rew: { orbs: 10, ess: 6, mats: { core: 1 } } },
  { id: 'n12', t: 'weapon', n: 4, icon: 'sword', goal: 'forge', rew: { orbs: 10, mats: { gem: 8, core: 1 } } },
  { id: 'n13', t: 'kill', n: 80, icon: 'sword', goal: 'mob', rew: { orbs: 12, mats: { fang: 12, gem: 6 } } },
  { id: 'q12', t: 'catch', n: 10, icon: 'orb', goal: 'mob', rew: { orbs: 12, ess: 8, mats: { gem: 6 } } },
  { id: 'n14', t: 'elite', n: 8, icon: 'elite', goal: 'mob', rew: { ess: 10, mats: { core: 2 } } },
  { id: 'n15', t: 'skill', n: 10, icon: 'orb', goal: 'mob', rew: { orbs: 15, mats: { gem: 8 } } },
  { id: 'n16', t: 'armor', n: 5, icon: 'shield', goal: 'forge', rew: { orbs: 15, ess: 8, mats: { core: 2 } } },
  { id: 'q13', t: 'boss', n: 6, icon: 'crown', goal: 'boss', rew: { orbs: 20, ess: 15, mats: { core: 3, gem: 10 } } },
];
export const QUEST_TEXT = {
  kill: (q) => `Defeat ${q.n} creatures`, catch: (q) => `Catch ${q.n} creature${q.n > 1 ? 's' : ''}`, fuse: (q) => `Fuse ${q.n} pair${q.n > 1 ? 's' : ''}`,
  boss: (q) => (q.boss ? 'Defeat the meadow boss' : `Defeat ${q.n} bosses`), craft: (q) => `Craft ${q.n} gear upgrade${q.n > 1 ? 's' : ''}`, hide: (q) => `Collect ${q.n} hide`,
  elite: (q) => `Defeat ${q.n} elite${q.n > 1 ? 's' : ''}`, lv: (q) => `Partner reaches Lv ${q.n}`, dex: (q) => `Catch ${q.n} kinds`, weapon: (q) => `Weapon tier ${q.n}`,
  armor: (q) => `Armor tier ${q.n}`, essence: (q) => `Collect ${q.n} essence`, skill: (q) => `Catching skill ${q.n}`,
};
export const questText = (q) => QUEST_TEXT[q.t](q);
export const activeQuests = () => QUESTS.filter((q) => !G.quests.done[q.id]).slice(0, 3);
export const questState = (q) => (G.quests.done[q.id] ? 'done' : activeQuests().includes(q) ? 'active' : 'locked');
export const progressOf = (q) => {
  let v;
  switch (q.t) {
    case 'boss': v = q.boss ? (G.bosses[q.boss] ? 1 : 0) : Object.keys(G.bosses).length; break;
    case 'craft': v = G.gear.w + G.gear.a; break;
    case 'weapon': v = G.gear.w; break;
    case 'armor': v = G.gear.a; break;
    case 'lv': v = Math.max(0, ...G.team.map((c) => c.lv)); break;
    case 'dex': v = Object.keys(G.dex.caught).length; break;
    case 'essence': v = (G.stats.essence || 0) - (G.quests.base && G.quests.base[q.id] || 0); break;
    case 'skill': v = G.skill.lvl; break;
    default: v = G.quests.prog[q.id] || 0;
  }
  return Math.max(0, Math.min(q.n, v));
};
// reward as [icon, amount] pairs (for icon-only display)
export const rewardBits = (q) => {
  const r = q.rew, b = [];
  if (r.orbs) b.push(['orb', r.orbs]); if (r.ess) b.push(['essence', r.ess]); if (r.berries) b.push(['heart', r.berries]);
  for (const [k, n] of Object.entries(r.mats || {})) b.push([k, n]);
  return b;
};

export function complete(q) {
  G.quests.done[q.id] = 1;
  const r = q.rew; if (r.orbs) G.orbs += r.orbs; if (r.berries) G.berries += r.berries; if (r.ess) G.essence = (G.essence || 0) + r.ess;
  if (r.mats) addMats(Object.entries(r.mats).map(([k, n]) => ({ k, n })));
  G.questFx = { t: 2.6, q }; G.questNew = true;
  // essence quests only count what is collected from now on
  const next = QUESTS.find((x) => x.t === 'essence' && !G.quests.done[x.id] && !(G.quests.base && x.id in G.quests.base));
  if (next) (G.quests.base = G.quests.base || {})[next.id] = G.stats.essence || 0;
  sfx.quest();
}
// Completes every active quest whose goal is met (also catches state-based goals like levels and gear).
export function questCheck() {
  for (let guard = 0; guard < 6; guard++) {
    let again = false;
    for (const q of activeQuests()) {
      if (q.t === 'essence' && !(G.quests.base && q.id in G.quests.base)) (G.quests.base = G.quests.base || {})[q.id] = G.stats.essence || 0;
      if (progressOf(q) >= q.n) { complete(q); again = true; }
    }
    if (!again) break;
  }
}
// Call from game events: questEvent('kill'), questEvent('catch'), questEvent('hide', n), questEvent('boss'), ...
export function questEvent(type, n = 1) {
  for (const q of activeQuests()) if (q.t === type && !['boss', 'craft'].includes(type)) G.quests.prog[q.id] = (G.quests.prog[q.id] || 0) + n;
  questCheck();
}

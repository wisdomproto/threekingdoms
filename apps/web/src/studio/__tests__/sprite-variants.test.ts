import { expect, it } from 'vitest';
import { spriteCandidates } from '../../pixi/spriteMap';

it('keeps promoted Changban commanders on their reviewed SD class artwork', () => {
  expect(spriteCandidates('허저', 'pikeman', 'enemy', 2)[1]).toBe('허저-footman');
  expect(spriteCandidates('조홍', 'chariot', 'enemy', 3)).toContain('조홍-footman');
  expect(spriteCandidates('서황', 'guardCavalry', 'enemy', 3)).toContain('xuhuang-cavalry-v2');
  expect(spriteCandidates('하후연', 'guardCavalry', 'enemy', 3)).toContain('xiahouyuan-cavalry-v2');
  for (const name of ['이전', '조홍', '허저']) {
    expect(spriteCandidates(name, 'pikeman', 'enemy', 2)).not.toContain(`${name}/t2`);
  }
  expect(spriteCandidates('하후돈', 'heavyCavalry', 'enemy', 2)[0]).toBe('하후돈/t2');
  expect(spriteCandidates('이전', 'crossbowman', 'enemy', 2)[0]).toBe('lidian-archer-v2/t2');
  expect(spriteCandidates('이전', 'footman', 'enemy')).not.toContain('lidian-archer-v2');
});

it('keeps campaign class variants separate while retaining tier and legacy fallbacks', () => {
  expect(spriteCandidates('위속', 'footman', 'enemy')[0]).toBe('위속-footman');
  expect(spriteCandidates('위속', 'archer', 'enemy')[0]).toBe('위속-archer');
  expect(spriteCandidates('위속', 'lightCavalry', 'enemy')[0]).toBe('위속-cavalry');
  expect(spriteCandidates('위속', 'archer', 'enemy', 3).slice(0, 2)).toEqual(['위속-archer/t3', '위속-archer']);
  expect(spriteCandidates('위속', 'footman', 'enemy')).not.toContain('위속-archer');
  expect(spriteCandidates('허저', 'brawler', 'enemy')[0]).toBe('허저-footman');
});

it('selects Liu Pi artwork for the current battle class with existing fallbacks', () => {
  expect(spriteCandidates('유벽','archer','enemy')[0]).toBe('유벽');
  expect(spriteCandidates('유벽','bandit','enemy').slice(0,2)).toEqual(['유벽-bandit','유벽']);
  expect(spriteCandidates('유벽','brigand','enemy',2)[0]).toBe('유벽-bandit/t2');
  expect(spriteCandidates('관우','lightCavalry','player')[0]).toBe('guanyu');
});

it('keeps chapter two infantry and cavalry artwork specific to the current class', () => {
  expect(spriteCandidates('곽사', 'footman', 'enemy')[0]).toBe('guosi-footman');
  expect(spriteCandidates('곽사', 'archer', 'enemy')[0]).toBe('guosi-archer');
  expect(spriteCandidates('서영', 'lightCavalry', 'enemy')[0]).toBe('xurong-cavalry');
  expect(spriteCandidates('서영', 'footman', 'enemy')).not.toContain('xurong-cavalry');
  expect(spriteCandidates('서영', 'footman', 'enemy')[0]).toBe('xurong-footman');
  expect(spriteCandidates('이각', 'pikeman', 'enemy', 2).slice(0, 2)).toEqual(['lijue/t2', 'lijue']);
  expect(spriteCandidates('이숙', 'lightCavalry', 'enemy')).not.toContain('이숙-archer');
  expect(spriteCandidates('이숙', 'lightCavalry', 'enemy')[0]).toBe('이숙-cavalry');
  expect(spriteCandidates('호진', 'lightCavalry', 'enemy')[0]).toBe('호진-cavalry');
  expect(spriteCandidates('송겸', 'footman', 'enemy')[0]).toBe('송겸-footman');
  expect(spriteCandidates('송겸', 'archer', 'enemy')[0]).toBe('송겸-archer');
  expect(spriteCandidates('송겸', 'crossbowman', 'enemy', 2).slice(0, 2)).toEqual(['송겸-archer/t2', '송겸-archer']);
});

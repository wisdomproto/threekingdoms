import { describe, expect, it } from 'vitest';
import { characterProfiles } from '../character-profiles';

describe('character profiles', () => {
  it('uses project battles and reinforcements for characters outside the roster', () => {
    const profiles=characterProfiles({enemy:{}, archer:{}},{},[{data:{units:[{commanderId:'enemy',classId:'footman'}],events:[{units:[{commanderId:'archer',classId:'archer'}]}]}}]);
    expect(profiles.enemy!.classId).toBe('footman');
    expect(profiles.archer!.role).toBe('ranged');
  });
  it('preserves roster classes and support roles, without treating guest as a combat role', () => {
    const profiles=characterProfiles({ally:{},guest:{}},{ally:{classId:'strategist',role:'support'},guest:{classId:'strategist',role:'guest'}},[{units:[{commanderId:'ally',classId:'footman'}]}]);
    expect(profiles.ally).toMatchObject({classId:'strategist',role:'support'});
    expect(profiles.guest!.role).toBe('caster');
  });
  it('keeps explicit defaults, reports missing evidence, and uses stable frequency ties', () => {
    const commanders={a:{defaultClassId:'archer',battleRole:'support'}, b:{},c:{}};
    const profiles=characterProfiles(commanders,{},[{units:[{commanderId:'a',classId:'footman'},{commanderId:'c',classId:'archer'},{commanderId:'c',classId:'bandit'}]}]);
    expect(profiles.a).toMatchObject({classId:'archer',role:'support'});
    expect(profiles.b!.classId).toBe('');
    expect(profiles.c!.classId).toBe('archer');
    expect(commanders.a.defaultClassId).toBe('archer');
  });
});

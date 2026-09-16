import { describe, expect, it } from 'vitest';
import { MapSceneSchema, type MapScene } from '../src/schemas';
import { newMapPart, setAction, removeActor, sceneLayout } from '../../../tools/editor/map-scene-model.js';
import opening from '../json/stages/01-zhuojun.json';

describe('visual map scene editing', () => {
  it('creates a playable scene without JSON input', () => {
    expect(MapSceneSchema.safeParse(newMapPart()).success).toBe(true);
  });
  it('retains camera framing in schema parsing and rejects unusable zoom values', () => {
    const part=newMapPart();part.camera={zoom:2,focus:[4,4]};
    expect(MapSceneSchema.parse(JSON.parse(JSON.stringify(part))).camera).toEqual(part.camera);
    expect(MapSceneSchema.safeParse({...part,camera:{zoom:0}}).success).toBe(false);
  });
  it('edits movement without dropping the original dialogue, choices or other actions', () => {
    const scenes = opening.scenario.intro.filter(p => 'map' in p) as MapScene[];
    for (const source of scenes) {
      const part = structuredClone(source), before = structuredClone(part.lines[0]!);
      setAction(part.lines[0]!, 'move', part.units[0]!.id, {to:[5,4]});
      setAction(part.lines[0]!, 'move', part.units[0]!.id, {to:[6,4]});
      expect(part.lines[0]!.move!.filter(a=>a.id===part.units[0]!.id)).toHaveLength(1);
      const {move: _old, ...restBefore}=before;
      const {move: _new, ...restAfter}=part.lines[0]!;
      expect(restAfter).toEqual(restBefore);
      expect(MapSceneSchema.safeParse(part).success).toBe(true);
      expect(JSON.parse(JSON.stringify(part))).toEqual(part);
    }
  });
  it('cleans references when deleting an actor, including choice reactions, preserving dialogue', () => {
    const part=newMapPart(); part.units.push({id:'guest',sprite:'zhangfei-foot',cell:[1,1]});
    part.lines=[{text:'Keep me',move:[{id:'guest',to:[2,2]}],bubble:{id:'guest',mark:'!'},choice:{options:[{label:'A',react:[{text:'Keep this too',bubble:{id:'guest',mark:'?'}}]},{label:'B'}]}}];
    removeActor(part,'guest');
    expect(part.lines[0]!.move).toBeUndefined();
    expect(part.lines[0]!.bubble).toBeUndefined();
    expect(part.lines[0]!.choice!.options[0]!.react![0]).toEqual({text:'Keep this too'});
    expect(part.lines[0]!.text).toBe('Keep me');
    expect(MapSceneSchema.safeParse(part).success).toBe(true);
  });
  it('scrubs from initial state and applies exit, movement, entry, facing and pose deterministically', () => {
    const part=newMapPart();const id=part.units[0]!.id;
    part.lines=[{enter:[{id,from:[0,4],to:[4,4]}],face:[{id,dir:'up'}],pose:[{id,pose:'salute'}]},{exit:[{id,to:[8,4]}]}];
    const before=structuredClone(part);
    expect(sceneLayout(part,0).get(id)).toMatchObject({cell:[4,4],hidden:false,facing:'up',pose:'salute'});
    expect(sceneLayout(part,1).get(id)?.hidden).toBe(true);
    expect(sceneLayout(part,-1).get(id)?.cell).toEqual([4,4]);
    expect(part).toEqual(before);
  });
});

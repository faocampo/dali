import { describe, expect, it } from 'vitest';
import { computeExportPlan, DEFAULT_EXPORT_OPTIONS, EXPORT_LIMITS, selectionIds, positiveIntersection, type ExportBounds } from './export-plan';

const bounds = { x: -20.25, y: 0, w: 100.25, h: 50.5 };
describe('frame boundaries',()=>{
  it('requires positive intersection at every edge',()=>{
    const frame={x:0,y:0,w:100,h:100};
    for(const b of [{x:-10,y:0,w:10,h:10},{x:100,y:0,w:10,h:10},{x:0,y:-10,w:10,h:10},{x:0,y:100,w:10,h:10}]) {
      expect(positiveIntersection(b,frame)).toBe(false);
      expect(positiveIntersection({...b,x:b.x-0.1,y:b.y-0.1,w:b.w+0.2,h:b.h+0.2},frame)).toBe(true);
    }
  });
  it('preflights large intermediate rasters even for a small frame',()=>{
    const options={...DEFAULT_EXPORT_OPTIONS,scope:'frame' as const,scale:4 as const};
    const small={x:0,y:0,w:100,h:100};
    const plan=computeExportPlan(['large-note'],small,options,'',[{x:0,y:0,w:3000,h:1000}]);
    expect(plan.valid).toBe(false);expect(plan.lowerScale).toBe(2);
    expect(computeExportPlan(['large-note'],small,options,'',[{x:0,y:0,w:9000,h:1000}]).valid).toBe(false);
  });
  it('exports an empty valid frame and rejects frame padding',()=>{
    expect(computeExportPlan([],bounds,{...DEFAULT_EXPORT_OPTIONS,scope:'frame'}).valid).toBe(true);
    expect(computeExportPlan(['a'],bounds,{...DEFAULT_EXPORT_OPTIONS,scope:'frame',padding:16}).valid).toBe(false);
  });
});
describe('selection padding', () => {
  it('keeps exact recursive identity and native order, including only explicitly selected or grouped connectors', () => {
    const nodes=[{id:'a',children:[]},{id:'b',children:[]},{id:'link',children:[]},{id:'inside-link',children:[]},{id:'inner',children:['a','inside-link']},{id:'outer',children:['inner','b']},{id:'overlap',children:[]}];
    expect(selectionIds(nodes,['outer','a'])).toEqual(['a','b','inside-link','inner','outer']);
    expect(selectionIds(nodes,['a','outer'])).toEqual(selectionIds(nodes,['outer','a']));
    expect(selectionIds(nodes,['b','a'])).toEqual(['a','b']);
    expect(selectionIds(nodes,['link'])).toEqual(['link']);
  });
  it.each([-1, 0.5, 257, NaN, Infinity])('rejects invalid padding %s', padding => {
    expect(computeExportPlan(['selected'], bounds, {...DEFAULT_EXPORT_OPTIONS, scope:'selection', padding}).valid).toBe(false);
  });
  it.each([1,2,4] as const)('adds padding before scale %s', scale => {
    const plan=computeExportPlan(['selected'],bounds,{...DEFAULT_EXPORT_OPTIONS,scope:'selection',padding:16,scale});
    expect([plan.pixelWidth,plan.pixelHeight]).toEqual([Math.ceil((bounds.w+32)*scale),Math.ceil((bounds.h+32)*scale)]);
  });
});
describe('export dimensions and allocation preflight', () => {
  it.each([1,2,4] as const)('rounds once at source scale %i with zero default padding', scale => {
    const plan=computeExportPlan(['a'],bounds,{...DEFAULT_EXPORT_OPTIONS,scale});
    expect(plan.valid).toBe(true);
    expect([plan.pixelWidth,plan.pixelHeight]).toEqual([Math.ceil(bounds.w*scale),Math.ceil(bounds.h*scale)]);
    expect(plan.clipBounds).toEqual(bounds);
    expect(Object.isFrozen(plan.includedIds)).toBe(true);
  });
  it.each([
    {x:NaN,y:0,w:1,h:1},{x:0,y:Infinity,w:1,h:1},
    {x:0,y:0,w:-1,h:1},{x:0,y:0,w:0,h:1},
    {x:Number.MAX_VALUE,y:0,w:1,h:1},
  ])('rejects unsafe world geometry %j', bound => {
    expect(computeExportPlan(['a'],bound,DEFAULT_EXPORT_OPTIONS).valid).toBe(false);
  });
  it('rejects unsupported options and empty membership',()=>{
    expect(computeExportPlan([],bounds,DEFAULT_EXPORT_OPTIONS).valid).toBe(false);
    for(const scale of [0,3,NaN]) expect(computeExportPlan(['a'],bounds,{...DEFAULT_EXPORT_OPTIONS,scale} as never).valid).toBe(false);
    expect(computeExportPlan(['a'],bounds,{...DEFAULT_EXPORT_OPTIONS,padding:-1}).valid).toBe(false);
  });
  it('offers the highest valid lower scale without changing the request',()=>{
    const plan=computeExportPlan(['a'],{x:0,y:0,w:3000,h:1000},{...DEFAULT_EXPORT_OPTIONS,scale:4});
    expect(plan.valid).toBe(false);expect(plan.lowerScale).toBe(2);expect(plan.scale).toBe(4);
    expect(computeExportPlan(['a'],{x:0,y:0,w:9000,h:1},DEFAULT_EXPORT_OPTIONS).lowerScale).toBeNull();
  });
  it('accepts the demonstrated conservative boundary and rejects its next pixel',()=>{
    const bound:ExportBounds={x:0,y:0,w:EXPORT_LIMITS.maxSide,h:EXPORT_LIMITS.maxPixels/EXPORT_LIMITS.maxSide};
    expect(computeExportPlan(['a'],bound,DEFAULT_EXPORT_OPTIONS).valid).toBe(true);
    expect(computeExportPlan(['a'],{...bound,w:bound.w+1},DEFAULT_EXPORT_OPTIONS).valid).toBe(false);
  });
});

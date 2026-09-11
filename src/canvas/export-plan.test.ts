import { describe, expect, it } from 'vitest';
import { computeExportPlan, DEFAULT_EXPORT_OPTIONS, EXPORT_LIMITS, type ExportBounds } from './export-plan';

const bounds = { x: -20.25, y: 0, w: 100.25, h: 50.5 };
describe('selection padding', () => {
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

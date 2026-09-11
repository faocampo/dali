import { describe, expect, it } from 'vitest';
import { IMAGE_LIMITS, rasterDimensions, validateDimensions } from './image-input';

describe('image resource validation',()=> {
  it.each([[0,10],[-1,20],[Infinity,1],[NaN,1],[8193,1],[4001,4000]])('rejects invalid dimensions %s × %s',(w,h)=> {
    expect(()=>validateDimensions(w,h)).toThrow();
  });
  it.each([[320,160],[160,320],[4000,4000],[8192,1]])('accepts bounded dimensions %s × %s',(w,h)=> {
    expect(()=>validateDimensions(w,h)).not.toThrow();
  });
  it('recognizes PNG dimensions and rejects renamed content',()=> {
    const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10],0);
    bytes.set([73,72,68,82],12);const view=new DataView(bytes.buffer);
    view.setUint32(16,320);view.setUint32(20,160);
    expect(rasterDimensions(bytes,'image/png')).toEqual([320,160]);
    expect(()=>rasterDimensions(bytes,'image/jpeg')).toThrow('PNG or JPEG');
    expect(()=>rasterDimensions(new TextEncoder().encode('<svg/>'),'image/svg+xml')).toThrow('PNG or JPEG');
  });
  it('recognizes JPEG SOF dimensions with a bounded segment walk',()=> {
    expect(rasterDimensions(new Uint8Array([255,216,255,192,0,8,8,0,160,1,64,3]),'image/jpeg')).toEqual([320,160]);
    expect(()=>rasterDimensions(new Uint8Array([255,216,255,192,255,255]),'image/jpeg')).toThrow();
    expect(IMAGE_LIMITS.bytes).toBe(16*1024*1024);
  });
});

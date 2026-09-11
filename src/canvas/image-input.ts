import type { EditorHost } from '@blocksuite/affine/std';
import { getActiveBoardId } from '../boards/preferences';

export const IMAGE_LIMITS = { bytes: 16 * 1024 * 1024, pixels: 16_000_000, dimension: 8192 };
export class ImageImportError extends Error {
  override name = 'ImageImportError';
}
const invalid = () => new ImageImportError('Choose a valid PNG or JPEG image and try again.');
export function validateDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw invalid();
  if (width > IMAGE_LIMITS.dimension || height > IMAGE_LIMITS.dimension || width * height > IMAGE_LIMITS.pixels)
    throw new ImageImportError('Use an image up to 16 megapixels and 8192 pixels per side, then try again.');
}

/** Inspect raster headers before allocating decoded pixels. The decoder still validates the bytes. */
export function rasterDimensions(bytes: Uint8Array, mime: string): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === 'image/png' && bytes.length >= 24 &&
      [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v) &&
      String.fromCharCode(...bytes.slice(12,16)) === 'IHDR')
    return [view.getUint32(16), view.getUint32(20)];
  if (mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216) {
    let offset=2;
    while(offset+4 <= bytes.length) {
      if(bytes[offset++] !== 255) break;
      while(bytes[offset] === 255) offset++;
      const marker=bytes[offset++];
      if(marker===217 || marker===218 || offset+2>bytes.length) break;
      const length=view.getUint16(offset);
      if(length<2 || offset+length>bytes.length) break;
      if(marker !== undefined && [192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length>=8)
        return [view.getUint16(offset+5),view.getUint16(offset+3)];
      offset+=length;
    }
  }
  throw invalid();
}

export async function validateImage(file: File): Promise<void> {
  if (file.size > IMAGE_LIMITS.bytes) throw new ImageImportError('Use an image smaller than 16 MiB and try again.');
  const dimensions=rasterDimensions(new Uint8Array(await file.arrayBuffer()),file.type);
  validateDimensions(...dimensions);
  const url=URL.createObjectURL(file);
  const image=new Image();
  try {
    image.src=url;
    await image.decode();
    validateDimensions(image.naturalWidth,image.naturalHeight);
  } catch (cause) {
    throw cause instanceof ImageImportError ? cause : invalid();
  } finally {
    image.src=''; URL.revokeObjectURL(url);
  }
}

export interface ImageImportRequest {
  files: File[];
  source: 'picker' | 'drop' | 'paste';
  boardId: string;
  target: [number, number];
  isCurrent: () => boolean;
}
export interface ImageImportResult { ids: string[]; errors: ImageImportError[] }

export async function importLocalImages(host: EditorHost, request: ImageImportRequest): Promise<ImageImportResult> {
  const { addImages } = await import('@blocksuite/affine/blocks/image');
  const { MAX_IMAGE_WIDTH } = await import('@blocksuite/affine/model');
  const result: ImageImportResult={ids:[],errors:[]};
  const assertCurrent=()=> {
    if(!request.isCurrent() || !host.isConnected || host.std.store.id !== request.boardId ||
       (getActiveBoardId() !== null && getActiveBoardId() !== request.boardId))
      throw new ImageImportError('The board changed. Open the intended board and choose the image again.');
  };
  // addImages awaits decode/blob storage internally. Guard its final synchronous
  // mutation, rather than checking only before an asynchronous native call.
  const store=new Proxy(host.std.store, {get(target,key) {
    if(key==='addBlocks') return (...args: Parameters<typeof target.addBlocks>) => {
      assertCurrent(); return target.addBlocks(...args);
    };
    const value=Reflect.get(target,key,target);
    return typeof value==='function' ? value.bind(target) : value;
  }});
  const std=new Proxy(host.std,{get(target,key) {
    if(key==='store') return store;
    const value=Reflect.get(target,key,target);
    return typeof value==='function' ? value.bind(target) : value;
  }});
  for(const [index,file] of request.files.entries()) {
    try {
      assertCurrent(); await validateImage(file); assertCurrent();
      const ids=await addImages(std,[file],{maxWidth:MAX_IMAGE_WIDTH,
        point:[request.target[0]+index*32,request.target[1]+index*32],shouldTransformPoint:false});
      if(!ids.length) throw new ImageImportError('The image could not be inserted. Choose a smaller PNG or JPEG and try again.');
      result.ids.push(...ids);
    } catch(cause) {
      result.errors.push(cause instanceof ImageImportError ? cause : new ImageImportError('The image could not be saved. Retry after local storage is available.'));
    }
  }
  return result;
}

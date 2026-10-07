import { withCanvasReservation } from './account/reservations';
import { canvasInsertionRect, serializeInsertionRect } from './insertion-placement';
import type { EditorHost } from '@blocksuite/affine/std';
import { GfxControllerIdentifier, type GfxController } from '@blocksuite/affine/std/gfx';
import { getActiveBoardId } from '../boards/preferences';
import { getActiveAccessScope, type AccessScope } from './runtime';

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

export async function validateImage(file: File, signal?: AbortSignal): Promise<{ width: number; height: number }> {
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') throw invalid();
  if (file.size > IMAGE_LIMITS.bytes) throw new ImageImportError('Use an image smaller than 16 MiB and try again.');
  const dimensions=rasterDimensions(new Uint8Array(await file.arrayBuffer()),file.type);
  validateDimensions(...dimensions);
  const url=URL.createObjectURL(file);
  const image=new Image();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (()=>void) | undefined;
  try {
    image.src=url;
    await Promise.race([image.decode(),new Promise<never>((_,reject)=>{
      cancel=()=>reject(new ImageImportError('The image import was cancelled. Choose the image again.'));
      timer=setTimeout(()=>reject(invalid()),15_000);
      if(signal?.aborted) cancel();
      else signal?.addEventListener('abort',cancel,{once:true});
    })]);
    validateDimensions(image.naturalWidth,image.naturalHeight);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } catch (cause) {
    throw cause instanceof ImageImportError ? cause : invalid();
  } finally {
    clearTimeout(timer);
    if(cancel) signal?.removeEventListener('abort',cancel);
    image.src=''; URL.revokeObjectURL(url);
  }
}

export interface ImageImportRequest {
  files: File[];
  source: 'picker' | 'drop' | 'paste';
  boardId: string;
  target: [number, number];
  isCurrent: () => boolean;
  signal?: AbortSignal;
}
export interface ImageImportResult { ids: string[]; errors: ImageImportError[] }

export function assertImageInputCurrent(host: EditorHost, boardId: string, isCurrent: () => boolean = () => true, initiatedScope: AccessScope | null = getActiveAccessScope()): void {
  const scope = getActiveAccessScope();
  const authorityMatches = initiatedScope
    ? scope?.phase === 'active' && scope.canWrite && scope.accountId === initiatedScope.accountId && scope.boardId === initiatedScope.boardId && scope.generation === initiatedScope.generation && new URL(window.location.href).searchParams.get('board') === scope.boardId
    : !scope && (getActiveBoardId() === null || getActiveBoardId() === boardId);
  if (!isCurrent() || !host.isConnected || host.std.store.id !== boardId ||
      !authorityMatches) {
    throw new ImageImportError('The board changed. Open the intended board and choose the image again.');
  }
}

export async function importLocalImages(host: EditorHost, request: ImageImportRequest): Promise<ImageImportResult> {
  const initiatedScope = getActiveAccessScope();
  const initiatedStore = host.std.store;
  const { addImages } = await import('@blocksuite/affine/blocks/image');
  const { MAX_IMAGE_WIDTH } = await import('@blocksuite/affine/model');
  const result: ImageImportResult={ids:[],errors:[]};
  const assertCurrent=()=>assertImageInputCurrent(host, request.boardId, () => host.std.store === initiatedStore && request.isCurrent(), initiatedScope);
  // addImages awaits decode/blob storage internally. Guard its final synchronous
  // mutation, rather than checking only before an asynchronous native call.
  const store=new Proxy(host.std.store, {get(target,key) {
    if(key==='addBlocks') return (...args: Parameters<typeof target.addBlocks>) => {
      assertCurrent();
      const gfx = host.std.get(GfxControllerIdentifier);
      for (const block of args[0]) {
        const props = block.blockProps;
        if (block.flavour !== 'affine:image' || !props) continue;
        if (request.source !== 'drop') {
          props.xywh = serializeInsertionRect(canvasInsertionRect(host.std, Number(props.width), Number(props.height)));
        }
        props.index = gfx.layer.generateIndex();
      }
      return target.addBlocks(...args);
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
      assertCurrent(); await validateImage(file,request.signal); assertCurrent();
      const ids=await withCanvasReservation(host, [], true, () => addImages(std,[file],{maxWidth:MAX_IMAGE_WIDTH,
        point:[request.target[0]+index*32,request.target[1]+index*32],shouldTransformPoint:false}));
      if(!ids.length) throw new ImageImportError('The image could not be inserted. Choose a smaller PNG or JPEG and try again.');
      result.ids.push(...ids);
    } catch(cause) {
      const message=cause instanceof ImageImportError ? cause.message : 'The image could not be saved. Retry after local storage is available.';
      result.errors.push(new ImageImportError(`Image ${index+1}: ${message}`));
    }
  }
  return result;
}

/** Native 0.22.4 also turns a plain-text SVG document into an image. Route that
 * case through the raster policy while retaining ordinary text/object paste. */
export function installImageInputs(host: EditorHost, insert: (files:File[],source:ImageImportRequest['source'],target:[number,number])=>void) {
  const images=(data:DataTransfer|null)=>[...(data?.files ?? [])].filter(file=>file.type.startsWith('image/'));
  const onPaste=(event:ClipboardEvent)=>{
    if(!host.isConnected) return;
    const target=event.composedPath()[0];
    if(target instanceof Element && target.closest('input,textarea,[role="dialog"]')) return;
    if(target!==document.body && target!==document.documentElement && !event.composedPath().includes(host)) return;
    const files=images(event.clipboardData);
    if (!files.length) {
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (/<svg[\s>]/.test(text)) {
        const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
        if (svg.tagName === 'svg' && svg.hasAttribute('xmlns')) {
          files.push(new File([text], 'pasted-image.svg', { type: 'image/svg+xml' }));
        }
      }
    }
    if(!files.length) return;
    event.preventDefault();event.stopImmediatePropagation();
    // The viewport service is already installed on the native root.
    const root=host.querySelector<HTMLElement & {gfx:GfxController}>('affine-edgeless-root');
    if(!root) return;
    const {x,y}=root.gfx.viewport.center;
    insert(files,'paste',[x,y]);
  };
  const onDrop=(event:DragEvent)=>{
    const files=images(event.dataTransfer);
    if(!files.length) return;
    event.preventDefault();event.stopImmediatePropagation();
    const root=host.querySelector<HTMLElement & {gfx:GfxController}>('affine-edgeless-root');
    if(!root) return;
    const viewport=root.gfx.viewport;
    insert(files,'drop',viewport.toModelCoord(...viewport.toViewCoordFromClientCoord([event.clientX,event.clientY])));
  };
  const onDragOver=(event:DragEvent)=>{
    if([...(event.dataTransfer?.items ?? [])].some(item=>item.kind==='file' && item.type.startsWith('image/'))) event.preventDefault();
  };
  host.addEventListener('drop',onDrop,true);
  host.addEventListener('dragover',onDragOver,true);
  document.addEventListener('paste',onPaste,true);
  return ()=>{
    host.removeEventListener('drop',onDrop,true);
    host.removeEventListener('dragover',onDragOver,true);
    document.removeEventListener('paste',onPaste,true);
  };
}

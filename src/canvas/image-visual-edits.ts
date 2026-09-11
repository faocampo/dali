import {
  BaseBlockTransformer,
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
  type BlockSnapshotLeaf,
  type FromSnapshotPayload,
  type Store,
  type ToSnapshotPayload,
} from '@blocksuite/affine/store';
import type { ImageBlockModel } from '@blocksuite/affine/model';
import { BlockComponent, BlockViewExtension, type EditorHost } from '@blocksuite/affine/std';
import {
  StoreExtensionProvider,
  type StoreExtensionContext,
  ViewExtensionProvider,
  type ViewExtensionContext,
} from '@blocksuite/affine/ext-loader';
import { literal } from 'lit/static-html.js';
import { Bound } from '@blocksuite/global/gfx';
import { assertImageInputCurrent, validateImage } from './image-input';

export const IMAGE_VISUAL_EDIT_FLAVOUR = 'djai:image-visual-edit';
const MAX_EDIT_BYTES = 50 * 1024 * 1024;
const MAX_EDIT_DIMENSION = 10_000;
const MAX_EDIT_PIXELS = 25_000_000;

export type ImageVisualEditProps = {
  imageId: string;
  /** Unmodified base pixels. Named sourceId so the archive transformer includes them. */
  sourceId: string;
  processedSourceId: string;
  brightness: number;
  contrast: number;
  cropLeft: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  baseX: number;
  baseY: number;
  baseWidth: number;
  baseHeight: number;
  basePixelWidth: number;
  basePixelHeight: number;
  baseSize: number;
};

class ImageVisualEditTransformer extends BaseBlockTransformer<ImageVisualEditProps> {
  override async fromSnapshot(payload: FromSnapshotPayload) {
    const snapshot = await super.fromSnapshot(payload);
    if (!payload.assets.isEmpty() && snapshot.props.sourceId) {
      await payload.assets.writeToBlob(snapshot.props.sourceId);
    }
    return snapshot;
  }

  override toSnapshot(payload: ToSnapshotPayload<ImageVisualEditProps>): BlockSnapshotLeaf {
    const snapshot = super.toSnapshot(payload);
    const sourceId = payload.model.props.sourceId;
    if (sourceId) payload.assets.getPathBlobIdMap().set(payload.model.id, sourceId);
    return snapshot;
  }
}

export class ImageVisualEditModel extends BlockModel<ImageVisualEditProps> {}

export const ImageVisualEditSchema = defineBlockSchema({
  flavour: IMAGE_VISUAL_EDIT_FLAVOUR,
  props: (): ImageVisualEditProps => ({
    imageId: '',
    sourceId: '',
    processedSourceId: '',
    brightness: 0,
    contrast: 0,
    cropLeft: 0,
    cropTop: 0,
    cropRight: 0,
    cropBottom: 0,
    baseX: 0,
    baseY: 0,
    baseWidth: 0,
    baseHeight: 0,
    basePixelWidth: 0,
    basePixelHeight: 0,
    baseSize: 0,
  }),
  metadata: { version: 1, role: 'content', parent: ['affine:page'], children: [] },
  toModel: () => new ImageVisualEditModel(),
  transformer: configs => new ImageVisualEditTransformer(configs),
});

const ImageVisualEditSchemaExtension = BlockSchemaExtension(ImageVisualEditSchema);

export class ImageVisualEditStoreExtension extends StoreExtensionProvider {
  override name = 'djai-image-visual-edit';
  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(ImageVisualEditSchemaExtension);
  }
}

class ImageVisualEditBlock extends BlockComponent<ImageVisualEditModel> {}
if (!customElements.get('djai-image-visual-edit')) {
  customElements.define('djai-image-visual-edit', ImageVisualEditBlock);
}

const ImageVisualEditBlockViewExtension = BlockViewExtension(
  IMAGE_VISUAL_EDIT_FLAVOUR,
  literal`djai-image-visual-edit`
);

export class ImageVisualEditViewExtension extends ViewExtensionProvider {
  override name = 'djai-image-visual-edit';
  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(ImageVisualEditBlockViewExtension);
  }
}

function getImage(store: Store, imageId: string): ImageBlockModel {
  const model = store.getBlock(imageId)?.model;
  if (!model || model.flavour !== 'affine:image') throw new Error('Select one image first.');
  return model as ImageBlockModel;
}

export function getImageVisualEdit(store: Store, imageId: string): ImageVisualEditModel | null {
  return store
    .getBlocksByFlavour(IMAGE_VISUAL_EDIT_FLAVOUR)
    .map(block => block.model as ImageVisualEditModel)
    .find(state => state.props.imageId === imageId) ?? null;
}

/** Native duplication and legacy snapshot imports can share pixels while
 * assigning new image IDs. Copy their history before any owner's record changes.
 * Lookup itself remains read-only; mutations always use an exact owner. */
export function reconcileImageVisualEdits(store: Store): void {
  if (store.readonly) return;
  const states = store.getBlocksByFlavour(IMAGE_VISUAL_EDIT_FLAVOUR)
    .map(block => block.model as ImageVisualEditModel);
  const owned = new Set(states.map(state => state.props.imageId));
  store.transact(() => {
    for (const { model } of store.getBlocksByFlavour('affine:image')) {
      if (owned.has(model.id)) continue;
      const image = model as ImageBlockModel;
      const template = states.find(state => state.props.processedSourceId === image.props.sourceId);
      if (!template) continue;
      // Model props also expose reactive `$` signals; copy schema values only.
      const props = template.props;
      store.addBlock(IMAGE_VISUAL_EDIT_FLAVOUR, {
        imageId: image.id,
        sourceId: props.sourceId,
        processedSourceId: props.processedSourceId,
        brightness: props.brightness,
        contrast: props.contrast,
        cropLeft: props.cropLeft,
        cropTop: props.cropTop,
        cropRight: props.cropRight,
        cropBottom: props.cropBottom,
        basePixelWidth: props.basePixelWidth,
        basePixelHeight: props.basePixelHeight,
        baseSize: props.baseSize,
        ...uncroppedGeometry(image, props),
      }, store.root);
      owned.add(image.id);
    }
  });
}

export function discardImageVisualEdit(store: Store, imageId: string): void {
  reconcileImageVisualEdits(store);
  const state = getImageVisualEdit(store, imageId);
  if (state) store.deleteBlock(state);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function assertSafeEdit(bitmap: ImageBitmap, bytes: number): void {
  if (bytes > MAX_EDIT_BYTES) throw new Error('This image exceeds the 50 MB editing limit.');
  if (
    bitmap.width > MAX_EDIT_DIMENSION ||
    bitmap.height > MAX_EDIT_DIMENSION ||
    bitmap.width * bitmap.height > MAX_EDIT_PIXELS
  ) {
    throw new Error('This image is too large to edit safely in the browser.');
  }
}

async function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The browser could not encode the edited image.');
  return blob;
}

function adjustedChannel(value: number, brightness: number, contrast: number): number {
  const brightened = value + brightness * 2.55;
  const c = contrast * 2.55;
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  return clamp(Math.round(factor * (brightened - 128) + 128), 0, 255);
}

export type ImageVisualSettings = Pick<
  ImageVisualEditProps,
  'brightness' | 'contrast' | 'cropLeft' | 'cropTop' | 'cropRight' | 'cropBottom'
>;

/** Recover the original rectangle from the current native placement, including
 * moves, resizes and rotations performed by BlockSuite itself. */
function uncroppedGeometry(image: ImageBlockModel, state: ImageVisualEditProps) {
  const bound = Bound.deserialize(image.xywh);
  const baseWidth = bound.w / (1 - (state.cropLeft + state.cropRight) / 100);
  const baseHeight = bound.h / (1 - (state.cropTop + state.cropBottom) / 100);
  const localX = baseWidth * (state.cropLeft - state.cropRight) / 200;
  const localY = baseHeight * (state.cropTop - state.cropBottom) / 200;
  const angle = (image.props.rotate ?? 0) * Math.PI / 180;
  return {
    baseX: bound.x + bound.w / 2 - localX * Math.cos(angle) + localY * Math.sin(angle) - baseWidth / 2,
    baseY: bound.y + bound.h / 2 - localX * Math.sin(angle) - localY * Math.cos(angle) - baseHeight / 2,
    baseWidth,
    baseHeight,
  };
}

export function imageVisualSettings(
  store: Store,
  imageId: string
): ImageVisualSettings {
  reconcileImageVisualEdits(store);
  const state = getImageVisualEdit(store, imageId);
  return state
    ? {
        brightness: state.props.brightness,
        contrast: state.props.contrast,
        cropLeft: state.props.cropLeft,
        cropTop: state.props.cropTop,
        cropRight: state.props.cropRight,
        cropBottom: state.props.cropBottom,
      }
    : { brightness: 0, contrast: 0, cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0 };
}

export async function applyImageVisualEdit(
  store: Store,
  imageId: string,
  next: ImageVisualSettings
): Promise<void> {
  const image = getImage(store, imageId);
  reconcileImageVisualEdits(store);
  const existing = getImageVisualEdit(store, imageId);
  const baseSourceId = existing?.props.sourceId ?? image.props.sourceId;
  if (!baseSourceId) throw new Error('The selected image has no local source.');
  const base = await store.blobSync.get(baseSourceId);
  if (!base) throw new Error('The original image bytes are unavailable.');

  const bitmap = await createImageBitmap(base);
  try {
    assertSafeEdit(bitmap, base.size);
    const left = clamp(next.cropLeft, 0, 45) / 100;
    const top = clamp(next.cropTop, 0, 45) / 100;
    const right = clamp(next.cropRight, 0, 45) / 100;
    const bottom = clamp(next.cropBottom, 0, 45) / 100;
    if (left + right >= 0.95 || top + bottom >= 0.95) {
      throw new Error('Crop must leave part of the image visible.');
    }
    const sourceX = Math.round(bitmap.width * left);
    const sourceY = Math.round(bitmap.height * top);
    const sourceWidth = Math.max(1, Math.round(bitmap.width * (1 - left - right)));
    const sourceHeight = Math.max(1, Math.round(bitmap.height * (1 - top - bottom)));
    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas editing is unavailable in this browser.');
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight
    );
    const brightness = clamp(next.brightness, -100, 100);
    const contrast = clamp(next.contrast, -100, 100);
    if (brightness !== 0 || contrast !== 0) {
      const pixels = context.getImageData(0, 0, sourceWidth, sourceHeight);
      for (let index = 0; index < pixels.data.length; index += 4) {
        pixels.data[index] = adjustedChannel(pixels.data[index]!, brightness, contrast);
        pixels.data[index + 1] = adjustedChannel(pixels.data[index + 1]!, brightness, contrast);
        pixels.data[index + 2] = adjustedChannel(pixels.data[index + 2]!, brightness, contrast);
      }
      context.putImageData(pixels, 0, 0);
    }
    const output = await canvasBlob(canvas);
    const processedSourceId = await store.blobSync.set(output);

    const bound = Bound.deserialize(image.xywh);
    const { baseX, baseY, baseWidth, baseHeight } = existing
      ? uncroppedGeometry(image, existing.props)
      : { baseX: bound.x, baseY: bound.y, baseWidth: bound.w, baseHeight: bound.h };
    const width = baseWidth * (1 - left - right);
    const height = baseHeight * (1 - top - bottom);
    const localX = (baseWidth * (left - right)) / 2;
    const localY = (baseHeight * (top - bottom)) / 2;
    const angle = ((image.props.rotate ?? 0) * Math.PI) / 180;
    const offsetX = localX * Math.cos(angle) - localY * Math.sin(angle);
    const offsetY = localX * Math.sin(angle) + localY * Math.cos(angle);
    const x = baseX + baseWidth / 2 + offsetX - width / 2;
    const y = baseY + baseHeight / 2 + offsetY - height / 2;
    const props: ImageVisualEditProps = {
      imageId,
      sourceId: baseSourceId,
      processedSourceId,
      brightness,
      contrast,
      cropLeft: left * 100,
      cropTop: top * 100,
      cropRight: right * 100,
      cropBottom: bottom * 100,
      baseX,
      baseY,
      baseWidth,
      baseHeight,
      basePixelWidth: existing?.props.basePixelWidth ?? bitmap.width,
      basePixelHeight: existing?.props.basePixelHeight ?? bitmap.height,
      baseSize: existing?.props.baseSize ?? image.props.size ?? base.size,
    };

    store.captureSync();
    store.transact(() => {
      if (existing) store.updateBlock(existing, props);
      else store.addBlock(IMAGE_VISUAL_EDIT_FLAVOUR, props, store.root);
      store.updateBlock(image, {
        sourceId: processedSourceId,
        width: sourceWidth,
        height: sourceHeight,
        size: output.size,
        xywh: `[${x},${y},${width},${height}]`,
      });
    });
    store.captureSync();
  } finally {
    bitmap.close();
  }
}

export function resetImageVisualEdit(store: Store, imageId: string): void {
  const image = getImage(store, imageId);
  reconcileImageVisualEdits(store);
  const state = getImageVisualEdit(store, imageId);
  if (!state) return;
  const { baseX, baseY, baseWidth, baseHeight } = uncroppedGeometry(image, state.props);
  store.captureSync();
  store.transact(() => {
    store.updateBlock(image, {
      sourceId: state.props.sourceId,
      width: state.props.basePixelWidth,
      height: state.props.basePixelHeight,
      size: state.props.baseSize,
      xywh: `[${baseX},${baseY},${baseWidth},${baseHeight}]`,
    });
    store.deleteBlock(state);
  });
  store.captureSync();
}

export async function replaceImageSource(host: EditorHost, imageId: string, file: File): Promise<void> {
  const store = host.std.store;
  const boardId = store.id;
  assertImageInputCurrent(host, boardId);
  const image = getImage(store, imageId);
  const previousSourceId = image.props.sourceId;
  const assertCurrent = () => {
    assertImageInputCurrent(host, boardId, () => host.std.store === store);
    if (store.readonly || store.getBlock(imageId)?.model !== image || image.isLocked() ||
        image.props.sourceId !== previousSourceId) {
      throw new Error('The image changed. Select it again and retry replacement.');
    }
  };
  assertCurrent();
  const dimensions = await validateImage(file);
  assertCurrent();
  const sourceId = await store.blobSync.set(file);
  // Blob storage can finish after navigation or a target change. The final
  // check and model transaction deliberately have no asynchronous gap.
  assertCurrent();
  const bound = Bound.deserialize(image.xywh);
  const height = bound.w * (dimensions.height / dimensions.width);
  reconcileImageVisualEdits(store);
  const visual = getImageVisualEdit(store, imageId);
  store.captureSync();
  store.transact(() => {
    if (visual) store.deleteBlock(visual);
    store.updateBlock(image, {
      sourceId,
      width: dimensions.width,
      height: dimensions.height,
      size: file.size,
      xywh: `[${bound.x},${bound.y},${bound.w},${height}]`,
    });
  });
  store.captureSync();
}

export function updateImageGeometry(
  store: Store,
  imageId: string,
  next: { x: number; y: number; width: number; height: number }
): void {
  const values = [next.x, next.y, next.width, next.height];
  if (!values.every(Number.isFinite) || next.width < 8 || next.height < 8) {
    throw new Error('Width and height must be at least 8 px.');
  }
  const image = getImage(store, imageId);
  const state = getImageVisualEdit(store, imageId);
  store.captureSync();
  store.transact(() => {
    store.updateBlock(image, { xywh: `[${next.x},${next.y},${next.width},${next.height}]` });
    if (state) {
      store.updateBlock(state, uncroppedGeometry(image, state.props));
    }
  });
  store.captureSync();
}

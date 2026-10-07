import { replaceIdMiddleware } from '@blocksuite/affine/shared/adapters';
import type { TransformerMiddleware } from '@blocksuite/affine/store';

/** Extend the pinned native remapper with our image-edit block reference.
 * Resolve after the complete page exists, independent of sibling import order.
 * Asset hashes are content identities and must remain unchanged. */
export const replaceBoardIdentities = (generate: () => string): TransformerMiddleware => options => {
  const originals = new WeakMap<object, string>();
  const replacements = new Map<string, string>();
  const before = options.slots.beforeImport.subscribe(payload => {
    if (payload.type === 'block') originals.set(payload.snapshot, payload.snapshot.id);
  });
  const native = replaceIdMiddleware(generate)(options);
  const after = options.slots.afterImport.subscribe(payload => {
    if (payload.type === 'block') {
      const original = originals.get(payload.snapshot);
      if (original) replacements.set(original, payload.model.id);
    } else if (payload.type === 'page') {
      for (const { model } of payload.page.getBlocksByFlavour('djai:image-visual-edit')) {
        const oldId = (model.props as { imageId: string }).imageId;
        const imageId = replacements.get(oldId);
        if (imageId) payload.page.updateBlock(model, { imageId });
      }
    }
  });
  return () => { before.unsubscribe(); native?.(); after.unsubscribe(); replacements.clear(); };
};

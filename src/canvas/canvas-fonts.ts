import { FontFamily, FontStyle, FontWeight } from '@blocksuite/affine/model';
import { IS_FIREFOX } from '@blocksuite/global/env';
// Pinned engine theme assets are bundled by Vite and served from the app origin.
import inter from '../../node_modules/@toeverything/theme/fonts/inter/Inter-VariableFont_slnt,wght.ttf?url';
import kalam from '../../node_modules/@toeverything/theme/fonts/kalam/Kalam-Regular.ttf?url';
import kalamBold from '../../node_modules/@toeverything/theme/fonts/kalam/Kalam-Bold.ttf?url';
const canvasFonts = [
  ...[FontWeight.Light, FontWeight.Regular, FontWeight.Medium, FontWeight.SemiBold, FontWeight.Bold].flatMap(weight => [FontStyle.Normal, FontStyle.Italic].map(style => ({ font: FontFamily.Inter, weight, style, url: inter }))),
  { font: FontFamily.Kalam, weight: FontWeight.Regular, style: FontStyle.Normal, url: kalam },
  { font: FontFamily.Kalam, weight: FontWeight.Bold, style: FontStyle.Normal, url: kalamBold },
];

let ready: Promise<void> | undefined;

/** Native text metrics are cached permanently, so load fonts before mounting. */
export function ensureCanvasFonts(): Promise<void> {
  if (ready) return ready;
  // These are public app assets, shared across editor mounts in this document.
  // The native per-editor loader must not replace them with unloaded faces.
  const faces = canvasFonts.map(({ font, weight, style, url }) =>
    new FontFace(IS_FIREFOX ? `"${font}"` : font, `url(${url})`, { weight, style }));
  faces.forEach(face => document.fonts.add(face));
  let timer: ReturnType<typeof setTimeout>;
  ready = Promise.race([
    Promise.all(faces.map(face => face.load())),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Canvas fonts could not be loaded. Please try opening the board again.')), 15_000);
    }),
  ]).then(() => undefined).catch(cause => {
    faces.forEach(face => document.fonts.delete(face));
    ready = undefined;
    throw cause;
  }).finally(() => clearTimeout(timer));
  return ready;
}

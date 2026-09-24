import { FontFamily, FontStyle, FontWeight } from '@blocksuite/affine/model';
import { FontConfigExtension } from '@blocksuite/affine/shared/services';
// Pinned engine theme assets are bundled by Vite and served from the app origin.
import inter from '../../node_modules/@toeverything/theme/fonts/inter/Inter-VariableFont_slnt,wght.ttf?url';
import kalam from '../../node_modules/@toeverything/theme/fonts/kalam/Kalam-Regular.ttf?url';
import kalamBold from '../../node_modules/@toeverything/theme/fonts/kalam/Kalam-Bold.ttf?url';
export const canvasFonts = FontConfigExtension([
  ...[FontWeight.Light, FontWeight.Regular, FontWeight.Medium, FontWeight.SemiBold, FontWeight.Bold].flatMap(weight => [FontStyle.Normal, FontStyle.Italic].map(style => ({ font: FontFamily.Inter, weight, style, url: inter }))),
  { font: FontFamily.Kalam, weight: FontWeight.Regular, style: FontStyle.Normal, url: kalam },
  { font: FontFamily.Kalam, weight: FontWeight.Bold, style: FontStyle.Normal, url: kalamBold },
]);

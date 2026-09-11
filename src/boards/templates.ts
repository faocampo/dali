import {
  DefaultTheme,
  FontWeight,
  ShapeStyle,
  ShapeType,
} from '@blocksuite/affine/model';
import { Text, type Store } from '@blocksuite/affine/store';

export type TemplateId = 'blank' | 'brainstorm' | 'mood-board' | 'storyboard';

type TemplateText = {
  kind: 'text';
  xywh: [number, number, number, number];
  text: string;
  fontSize: number;
  weight?: FontWeight;
};

type TemplateShape = {
  kind: 'shape';
  xywh: [number, number, number, number];
  text: string;
  shape?: ShapeType;
  fill: keyof typeof DefaultTheme.FillColorShortMap;
};

type TemplateSticky = {
  kind: 'sticky';
  xywh: [number, number, number, number];
  text: string;
  colour: keyof typeof DefaultTheme.NoteBackgroundColorMap;
};

export type TemplatePrimitive = TemplateText | TemplateShape | TemplateSticky;

export type BoardTemplate = {
  id: TemplateId;
  name: string;
  boardTitle: string;
  description: string;
  primitives: readonly TemplatePrimitive[];
};

const heading = (text: string): TemplateText => ({
  kind: 'text',
  xywh: [80, 55, 800, 64],
  text,
  fontSize: 42,
  weight: FontWeight.SemiBold,
});

export const BOARD_TEMPLATES: readonly BoardTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    boardTitle: 'Untitled board',
    description: 'Start with an empty infinite canvas.',
    primitives: [],
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    boardTitle: 'Brainstorm',
    description: 'A central idea with four independent prompts.',
    primitives: [
      heading('Brainstorm'),
      {
        kind: 'shape',
        xywh: [365, 245, 230, 130],
        text: 'Big idea',
        shape: ShapeType.Ellipse,
        fill: 'Yellow',
      },
      { kind: 'sticky', xywh: [90, 160, 220, 180], text: 'What do we know?', colour: 'Blue' },
      { kind: 'sticky', xywh: [650, 160, 220, 180], text: 'What could change?', colour: 'Green' },
      { kind: 'sticky', xywh: [90, 400, 220, 180], text: 'Questions', colour: 'Purple' },
      { kind: 'sticky', xywh: [650, 400, 220, 180], text: 'Next ideas', colour: 'Yellow' },
    ],
  },
  {
    id: 'mood-board',
    name: 'Mood Board',
    boardTitle: 'Mood Board',
    description: 'A loose visual field for references, colours, and notes.',
    primitives: [
      heading('Mood Board'),
      { kind: 'shape', xywh: [80, 155, 300, 200], text: 'Drop image', fill: 'Blue' },
      { kind: 'shape', xywh: [410, 155, 210, 200], text: 'Drop image', fill: 'Purple' },
      { kind: 'shape', xywh: [650, 155, 230, 200], text: 'Drop image', fill: 'Green' },
      { kind: 'shape', xywh: [80, 395, 540, 145], text: 'Colour / texture', fill: 'Orange' },
      { kind: 'sticky', xywh: [650, 395, 230, 145], text: 'Mood and references', colour: 'Yellow' },
    ],
  },
  {
    id: 'storyboard',
    name: 'Storyboard',
    boardTitle: 'Storyboard',
    description: 'Three editable visual panels with freeform notes.',
    primitives: [
      heading('Storyboard'),
      { kind: 'shape', xywh: [70, 155, 250, 220], text: 'Add visual', fill: 'White' },
      { kind: 'shape', xywh: [355, 155, 250, 220], text: 'Add visual', fill: 'White' },
      { kind: 'shape', xywh: [640, 155, 250, 220], text: 'Add visual', fill: 'White' },
      { kind: 'sticky', xywh: [70, 405, 250, 145], text: 'Notes', colour: 'Yellow' },
      { kind: 'sticky', xywh: [355, 405, 250, 145], text: 'Notes', colour: 'Yellow' },
      { kind: 'sticky', xywh: [640, 405, 250, 145], text: 'Notes', colour: 'Yellow' },
    ],
  },
] as const;

export function boardTemplate(id: TemplateId): BoardTemplate {
  const template = BOARD_TEMPLATES.find(item => item.id === id);
  if (!template) throw new Error(`Unknown board template: ${id}`);
  return template;
}

function serialized([x, y, width, height]: TemplatePrimitive['xywh']): string {
  return `[${x},${y},${width},${height}]`;
}

/** Seed a new store with ordinary BlockSuite objects, then detach its history. */
export function applyBoardTemplate(store: Store, template: BoardTemplate): void {
  const surface = store.getBlocksByFlavour('affine:surface')[0]?.model as
    | { addElement: (props: Record<string, unknown>) => string }
    | undefined;
  const rootId = store.root?.id;
  if (!surface || !rootId) throw new Error('The new board is missing its canvas structure.');

  for (const primitive of template.primitives) {
    if (primitive.kind === 'text') {
      surface.addElement({
        type: 'text',
        xywh: serialized(primitive.xywh),
        text: new Text(primitive.text).yText,
        fontSize: primitive.fontSize,
        ...(primitive.weight ? { fontWeight: primitive.weight } : {}),
      });
      continue;
    }

    if (primitive.kind === 'shape') {
      surface.addElement({
        type: 'shape',
        xywh: serialized(primitive.xywh),
        shapeType: primitive.shape ?? ShapeType.Rect,
        shapeStyle: ShapeStyle.General,
        radius: primitive.shape === ShapeType.Ellipse ? 0 : 0.08,
        filled: true,
        fillColor: DefaultTheme.FillColorShortMap[primitive.fill],
        strokeColor: DefaultTheme.shapeStrokeColor,
        text: new Text(primitive.text).yText,
        fontSize: 24,
      });
      continue;
    }

    const noteId = store.addBlock(
      'affine:note',
      {
        xywh: serialized(primitive.xywh),
        displayMode: 'edgeless',
        background: DefaultTheme.NoteBackgroundColorMap[primitive.colour],
        edgeless: {
          collapse: true,
          collapsedHeight: primitive.xywh[3],
          style: {
            borderRadius: 8,
            borderSize: 4,
            borderStyle: 'none',
            shadowType: '--affine-note-shadow-sticker',
          },
        },
      },
      rootId
    );
    store.addBlock('affine:paragraph', { text: new Text(primitive.text) }, noteId);
  }

  // Template construction is the board's baseline. Undo begins with the
  // user's first edit and can never erase the page/surface or half a template.
  store.resetHistory();
}

export function templatePreviewKinds(template: BoardTemplate) {
  const kinds = new Set<'sticky' | 'shape' | 'text'>();
  for (const primitive of template.primitives) kinds.add(primitive.kind);
  return [...kinds];
}

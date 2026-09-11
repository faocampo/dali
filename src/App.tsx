import { useEffect, useState } from 'react';
import BlockSuiteCanvas from './canvas/BlockSuiteCanvas';
import { getCanvasRuntime } from './canvas/runtime';
import { Header } from './header/Header';
import { BoardLibrary } from './boards/BoardLibrary';
import { boardCatalogEntry } from './boards/catalog';

export default function App() {
  const [screen, setScreen] = useState<'loading' | 'library' | 'editor'>('loading');
  const [boardTitle, setBoardTitle] = useState('Untitled board');

  useEffect(() => {
    let cancelled = false;
    getCanvasRuntime()
      .then(({ workspace, store }) => {
        if (cancelled) return;
        setBoardTitle(
          boardCatalogEntry(store.id, workspace.meta.docMetas)?.title || 'Untitled board'
        );
        // The product URL always opens directly into the active canvas. The
        // board library remains available from the board switcher in Header.
        setScreen('editor');
      })
      .catch(() => {
        // BlockSuiteCanvas owns the designed startup failure and retry flow.
        if (!cancelled) setScreen('editor');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (screen === 'loading') {
    return <div className="djai-loading" role="status">Opening local boards…</div>;
  }

  if (screen === 'library') return <BoardLibrary />;

  return (
    <div className="djai-app">
      <Header boardTitle={boardTitle} onOpenBoards={() => setScreen('library')} />
      {/* The canvas takes whatever is left. It positions its own children
          absolutely, so this wrapper has to be the positioning context. */}
      <main className="djai-canvas-area">
        <BlockSuiteCanvas />
      </main>
    </div>
  );
}

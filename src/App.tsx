import { useEffect, useState } from 'react';
import { AuthBoundary, type SessionDescriptor } from './auth/AuthBoundary';
import { BoardLibrary, validSummary, type BoardDescriptor } from './boards/BoardLibrary';
import logo from '../imgs/svg/dali-symbol-color.svg';

function BoardTarget({ member, target }: { member: SessionDescriptor; target: string }) {
  const [state, setState] = useState<'loading' | 'denied' | 'error' | 'ready'>('loading');
  const [board, setBoard] = useState<BoardDescriptor>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setState('loading'); setBoard(undefined);
    if (!target) { setState('denied'); return () => controller.abort(); }
    void fetch(`/api/boards/${encodeURIComponent(target)}`, { headers: { 'X-Dali-Account': member.accountId }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (controller.signal.aborted) return;
        if (response.status === 404) { setState('denied'); return; }
        if (!response.ok) throw new Error('Board unavailable');
        const descriptor = await response.json() as BoardDescriptor;
        if (!validSummary(descriptor.summary, member.accountId) || descriptor.summary.id !== target || !descriptor.rootDocId || !descriptor.contentDocId) throw new Error('Invalid descriptor');
        if (!controller.signal.aborted) { setBoard(descriptor); setState('ready'); }
      }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [member.accountId, target, retry]);
  if (state === 'loading') return <p role="status">Opening board…</p>;
  if (state === 'denied') return <section><h1>You don't have access to this board</h1><p>Ask the board owner to grant access to your internal account.</p><a href="/">Back to your boards</a></section>;
  if (state === 'error') return <section><p role="alert">We couldn't open this board. Try again.</p><button onClick={() => setRetry(value => value + 1)}>Try again</button><a href="/">Back to your boards</a></section>;
  // Plan 03-06 replaces this authorized transition with the proven account runtime.
  return <section><h1>{board!.summary.title}</h1><p role="status">Board access confirmed. Canvas editing will be available after the account workspace update.</p><a href="/">Back to your boards</a></section>;
}
export default function App() {
  const params = new URLSearchParams(window.location.search);
  return <AuthBoundary>{(member, signOut) => <div className="board-library" key={member.accountId}>
    <header className="board-library__header" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <a className="djai-brand" href="/" aria-label="Dalí"><img src={logo} alt="" height={34} /></a>
      <div style={{ flex: 1, overflowWrap: 'anywhere', minWidth: 0, fontSize: 15 }}>
        <p>{member.displayName}</p><p>{member.email}</p>
      </div>
      <button className="djai-ghost" style={{ minHeight: 44, fontSize: 13, fontWeight: 600 }} onClick={() => { void signOut(); }}>Sign out of Dalí</button>
    </header>
    <main className="board-library__main">
      {params.has('board') ? <BoardTarget member={member} target={params.get('board')!} /> : <BoardLibrary member={member} />}
    </main>
  </div>}</AuthBoundary>;
}

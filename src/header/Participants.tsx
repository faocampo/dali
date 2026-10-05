import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getPresence, participantColor, subscribePresence } from '../canvas/account/presence';
import { MenuIcon } from './MenuIcon';
import './participants.css';

export function Participants({ boardId, loading = false }: { boardId: string; loading?: boolean }) {
  const snapshot = useSyncExternalStore(subscribePresence, getPresence);
  const presence = snapshot?.boardId === boardId ? snapshot : loading ? { boardId, accountId: '', state: 'loading' as const, participants: [], retry: () => {} } : null;
  const [open, setOpen] = useState(false); const trigger = useRef<HTMLButtonElement>(null); const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 72, left: 16 });
  useEffect(() => { setOpen(false); }, [boardId]);
  useEffect(() => {
    if (!open) return;
    const positionPanel = () => {
      const rect = trigger.current?.getBoundingClientRect(); if (!rect) return;
      setPosition({ top: Math.min(rect.bottom + 8, window.innerHeight - 120), left: Math.max(16, Math.min(rect.right - 320, window.innerWidth - 336)) });
    };
    positionPanel();
    const outside = (event: Event) => { if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape); window.addEventListener('resize', positionPanel);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', positionPanel); };
  }, [open]);
  if (!presence || presence.boardId !== boardId) return null;
  const people = [...presence.participants].sort((a, b) => Number(b.accountId === presence.accountId) - Number(a.accountId === presence.accountId) || a.name.localeCompare(b.name) || a.accountId.localeCompare(b.accountId));
  const label = presence.state === 'ready' ? `People on this board: ${people.length}` : presence.state === 'loading' ? 'People loading' : 'People unavailable';
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();
  return <div className="board-participants">
    <button ref={trigger} className="participants-trigger djai-ghost" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls="board-participants-panel" onClick={() => setOpen(value => !value)}>
      <span className="participants-compact" aria-hidden="true"><MenuIcon name="people" />{presence.state === 'ready' ? people.length : '…'}</span>
      <span className="participants-avatars" aria-hidden="true">{presence.state === 'ready' ? <>{people.slice(0, 3).map(person => <span key={person.accountId} className="participant-avatar" style={{ borderColor: participantColor(person.accountId), opacity: person.idle ? .5 : 1 }}>{initials(person.name)}</span>)}{people.length > 3 && <span>+{people.length - 3}</span>}</> : <span>{label}</span>}</span>
    </button>
    {open && <div ref={panel} id="board-participants-panel" role="dialog" aria-label="People on this board" className="participants-panel" style={position}>
      <h2>People on this board</h2>
      {presence.state === 'loading' ? <><p>People loading</p>{[1, 2, 3].map(id => <div key={id} className="participant-placeholder" aria-hidden="true" />)}</>
        : presence.state === 'error' ? <><p>People could not be loaded. Check your connection and try again.</p><button onClick={presence.retry}><MenuIcon name="refresh" />Retry presence</button></>
        : <>{people.length === 1 && <p>Only you are here.</p>}<ul>{people.map(person => <li key={person.accountId}>
          <span className="participant-avatar" aria-hidden="true" style={{ borderColor: participantColor(person.accountId), opacity: person.idle ? .5 : 1 }}>{initials(person.name)}</span>
          <div><span title={person.name}>{person.name || 'Participant'}</span><small>{person.role ? person.role[0]!.toUpperCase() + person.role.slice(1) : 'Role pending'}{person.accountId === presence.accountId && ' · You'}{person.idle && ' · Idle'}</small></div>
        </li>)}</ul></>}
    </div>}
  </div>;
}

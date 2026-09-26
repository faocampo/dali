/**
 * The app header: local board access, save state, and shared export dialog.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DaliMenu } from './DaliMenu';
import { BoardTitleMenu } from './BoardTitleMenu';
import logo from '../../imgs/svg/dali-symbol-color.svg';
import { recoveryDownloadScope } from '../canvas/recovery-archive';
import { getActiveAccessScope, subscribeAccessScope } from '../canvas/runtime';
import { SaveDetails, saveDetailsCopy } from './SaveDetails';
import { createAccountBoard } from '../boards/operations';
import { accountBoardUrl } from '../boards/preferences';
import { getSaveStatus, getAccountSaveSnapshot, subscribeSaveStatus, getRecoveryDownloadState, subscribeRecoveryDownloadState } from '../canvas/save-status';
import { ExportDialog } from './ExportDialog';
import type { BoardDescriptor } from '../boards/BoardLibrary';
import type { SessionDescriptor } from '../auth/AuthBoundary';
import { ShareBoardDialog } from '../boards/ShareBoardDialog';
import { BoardActionDialog } from '../boards/BoardActionDialog';
import { preserveBeforeNavigation } from '../auth/session';
import { AccountMenu } from './AccountMenu';

export function Header({
  boardTitle = 'Untitled board',
  onOpenBoards,
  onRenameBoard, onOpenRestored,
  board, member, signOut, onBoardChanged,
}: {
  boardTitle?: string;
  onOpenBoards?: () => void;
  onRenameBoard?: (title: string) => Promise<void>;
  onOpenRestored?: () => void;
  board?: BoardDescriptor; member?: SessionDescriptor; signOut?: () => Promise<void>; onBoardChanged?: (board: BoardDescriptor) => void;
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [action, setAction] = useState<'rename' | 'duplicate' | 'delete'>();
  const [saveHelpOpen, setSaveHelpOpen] = useState(false);
  const saveTrigger = useRef<HTMLButtonElement>(null);
  const closeSaveDetails = useCallback((restore = false) => { setSaveHelpOpen(false); if (restore) saveTrigger.current?.focus(); }, []);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer); }, []);
  const saveStatus = useSyncExternalStore(subscribeSaveStatus, getSaveStatus);
  const scope = useSyncExternalStore(subscribeAccessScope, getActiveAccessScope);
  const downloadState = useSyncExternalStore(subscribeRecoveryDownloadState, getRecoveryDownloadState);
  const downloadStatus = scope && downloadState.scope === recoveryDownloadScope(scope) ? downloadState : undefined;
  const accountSave = getAccountSaveSnapshot();
  const saveCopy = saveDetailsCopy(saveStatus, accountSave, scope);
  useEffect(() => setSaveHelpOpen(false), [scope?.accountId, scope?.boardId, scope?.generation]);
  type Creation = { id: string; accountId: string; generation: number; tab: Window | null; state: 'pending' | 'error' | 'ready'; href?: string };
  const [creations, setCreations] = useState<Creation[]>([]);
  const lifetime = useRef(new AbortController());
  useEffect(() => { lifetime.current = new AbortController(); return () => lifetime.current.abort(); }, []);
  const showCreationState = (tab: Window | null, message: string) => {
    if (!tab || tab.closed) return;
    try {
      if (tab.location.href !== 'about:blank') return;
      const status = tab.document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = message;
      tab.document.title = 'New board'; tab.document.body.replaceChildren(status);
    } catch { /* A user-navigated tab remains under their control. */ }
  };
  const completeCreation = async (creation: Creation) => {
    const signal = lifetime.current.signal;
    showCreationState(creation.tab, 'Creating board…');
    setCreations(values => values.map(value => value.id === creation.id ? { ...value, state: 'pending' } : value));
    try {
      const result = await createAccountBoard(creation.accountId, creation.id, signal);
      const scope = getActiveAccessScope();
      if (signal.aborted || scope?.phase !== 'active' || scope.accountId !== creation.accountId || scope.generation !== creation.generation) return;
      const href = accountBoardUrl(result.summary.id);
      if (creation.tab && !creation.tab.closed) { creation.tab.location.replace(href); setCreations(values => values.filter(value => value.id !== creation.id)); }
      else setCreations(values => values.map(value => value.id === creation.id ? { ...value, href, state: 'ready' } : value));
    } catch {
      if (!signal.aborted) {
        showCreationState(creation.tab, "We couldn't confirm this change. Return to the original board and check again before retrying.");
        setCreations(values => values.map(value => value.id === creation.id ? { ...value, state: 'error' } : value));
      }
    }
  };
  const newBoard = () => {
    const scope = getActiveAccessScope(); if (scope?.phase !== 'active' || member?.systemRole === 'viewer') return;
    // Reserve synchronously in the gesture; network completion only navigates it.
    const tab = window.open('about:blank', '_blank'); if (tab) tab.opener = null;
    const creation: Creation = { id: crypto.randomUUID(), accountId: scope.accountId, generation: scope.generation, tab, state: 'pending' };
    setCreations(values => [...values, creation]); void completeCreation(creation);
  };

  const closeExport = useCallback(() => {
    setExportOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.dali-menu-trigger')?.focus());
  }, []);

  useEffect(() => {
    const open = () => setExportOpen(true);
    window.addEventListener('djai:open-export', open);
    return () => window.removeEventListener('djai:open-export', open);
  }, []);

  return (
    <header className="djai-header" style={{ zIndex: saveHelpOpen ? 40 : undefined }}>
      <a
        className="djai-brand"
        href="/"
        aria-label="Dalí"
        onClick={(event) => {
          if (!onOpenBoards) return;
          event.preventDefault();
          onOpenBoards();
        }}
      >
        <img src={logo} alt="Dalí" height={34} />
      </a>

      <DaliMenu onOpenBoards={onOpenBoards} onExport={() => setExportOpen(true)} onNewBoard={newBoard} canCreate={member?.systemRole !== 'viewer' && !!scope?.canWrite} role={scope?.canWrite ? board?.summary.role : 'viewer'} onBoardAction={board && scope?.canWrite ? setAction : undefined} />
      <div className="board-document-heading">
      {!onRenameBoard && <h1 className="board-title-readable" title={boardTitle}>{boardTitle}</h1>}
      {onOpenBoards && onRenameBoard && <BoardTitleMenu paused={!scope?.canWrite} title={boardTitle} onRename={onRenameBoard} />}

        <div className="djai-save">
          <button ref={saveTrigger} type="button" className={`djai-save__status djai-save__status--${scope?.role === 'viewer' ? 'saved' : saveStatus.state}`}
            aria-haspopup="dialog" aria-expanded={saveHelpOpen} aria-controls="save-details"
            aria-label={`${saveCopy.label}, Open save details`}
            aria-describedby={saveStatus.savedAt && scope?.role !== 'viewer' ? 'save-age' : undefined}
            title={saveStatus.savedAt && scope?.role !== 'viewer' ? `Last saved ${new Date(saveStatus.savedAt).toLocaleTimeString()}` : undefined}
            onClick={() => setSaveHelpOpen(open => !open)}>
            <span aria-hidden="true" />{saveCopy.label}
            {saveStatus.savedAt && scope?.role !== 'viewer' && <small id="save-age" className="save-age">{formatSaveAge(saveStatus.savedAt, now)}</small>}
          </button>
          <span className="save-announcement" role={saveStatus.state === 'failed' && scope?.role !== 'viewer' ? 'alert' : 'status'}>{saveCopy.label}{downloadStatus && scope?.role !== 'viewer' && downloadStatus.phase !== 'error' && ` ${downloadStatus.label}`}</span>
          {saveHelpOpen && <SaveDetails key={`${scope?.accountId}:${scope?.boardId}:${scope?.generation}`} status={saveStatus} snapshot={accountSave} scope={scope} downloadStatus={downloadStatus} trigger={saveTrigger} onClose={closeSaveDetails} onOpenRestored={onOpenRestored} />}
        </div>
      </div>

      <nav className="djai-header-actions">
        {board?.summary.role === 'owner' && <button className="djai-ghost" onClick={event => { event.currentTarget.focus(); setSharing(true); }}>Share board</button>}
        {member && <AccountMenu member={member} signOut={signOut} role={board?.summary.role} />}

      </nav>

      {exportOpen && <ExportDialog onClose={closeExport} />}
      {sharing && board && <ShareBoardDialog board={board.summary} onClose={() => setSharing(false)} onChanged={state => {
        if (state) onBoardChanged?.({ ...board, summary: { ...board.summary, access: state.grants.length ? 'shared' : 'private', pendingCount: state.grants.filter(grant => grant.status === 'pending').length } });
      }} />}
      {action && board && <BoardActionDialog board={board.summary} kind={action} onClose={() => setAction(undefined)} onComplete={result => {
        setAction(undefined);
        if (result.deleted) onOpenBoards?.();
        else if (action === 'duplicate') void preserveBeforeNavigation().then(preserved => { if (preserved) window.location.assign('/?focusBoard=' + encodeURIComponent(result.summary.id)); });
        else onBoardChanged?.(result);
      }} />}
      {creations.map(creation => <div key={creation.id} role={creation.state === 'error' ? 'alert' : 'status'}>
        {creation.state === 'pending' ? 'Creating board…' : creation.state === 'error' ? <><span>We couldn't open the new board. Your current board is unchanged.</span><button onClick={() => { void completeCreation(creation); }}>Retry new board</button></>
          : <><span>Your new board is ready.</span><a href={creation.href} target="_blank" rel="noopener noreferrer">Open new board</a></>}
      </div>)}
    </header>
  );
}

export function formatSaveAge(savedAt: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - savedAt) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

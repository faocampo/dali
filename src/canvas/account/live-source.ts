import type { PresenceParticipant } from '../../../server/boards/presence';
import * as Y from 'yjs';
import { RecoveryEpochError, SourceAccessError, type SourceOptions } from './doc-source';
export type LiveSnapshot = { connectionId?: string; revision: number; epoch: string; root?: string; content?: string; title?: string; presence?: PresenceParticipant[]; presenceVersion?: string };
const decode = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
/** A connection belongs to exactly one runtime; recovery creates a fresh one. */
export class BoardLiveSource {
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'checking' = 'connecting';
  connectionError?: string;
  private connectionListeners = new Set<() => void>();
  subscribeConnection = (listener: () => void) => { this.connectionListeners.add(listener); return () => { this.connectionListeners.delete(listener); }; };
  private connectionChanged(state: typeof this.connectionState) { this.connectionState = state; this.connectionListeners.forEach(listener => listener()); }
  private receive?: (docId: string, bytes: Uint8Array) => void;
  private disconnected?: (reason: string) => void;
  private reconnecting?: Promise<void>;
  private controller = new AbortController();
  private presenceVersion?: string;
  private presencePublishFailed = false;
  private latestParticipants?: PresenceParticipant[];
  private presenceListeners = new Set<() => void>();
  presenceState: { state: 'loading' | 'ready' | 'error'; participants: PresenceParticipant[] } = { state: 'loading', participants: [] };
  subscribePresence = (listener: () => void) => { this.presenceListeners.add(listener); return () => { this.presenceListeners.delete(listener); }; };
  private publishPresence(state: typeof this.presenceState) { this.presenceState = state; this.presenceListeners.forEach(listener => listener()); }
  async updatePresence(data: { cursor: { x: number; y: number } | null; selection: string[] }) {
    if (!this.connected) return;
    const connection = this.connectionId;
    try {
      await this.request('presence', { connectionId: connection, presence: data });
      if (!this.connected || connection !== this.connectionId) return;
      const recovered = this.presencePublishFailed;
      this.presencePublishFailed = false;
      if (recovered && this.connected && this.latestParticipants) this.publishPresence({ state: 'ready', participants: this.latestParticipants });
    } catch {
      if (!this.controller.signal.aborted && connection === this.connectionId && this.connected) {
        this.presencePublishFailed = true;
        this.publishPresence({ state: 'error', participants: [] });
      }
    }
  }
  private connectionId?: string;
  private revision = 0;
  private reservation?: string;
  private localAction?: string;
  private reservedObjects = new Set<string>();
  private createdObjects = new Set<string>();
  private get localEditingAllowed() {
    return !!this.connectionId && !!this.epoch && this.connectionState === 'disconnected' && !this.options.readonly &&
      !this.controller.signal.aborted && !this.options.signal?.aborted && this.options.isCurrent?.(this.options.generation) !== false &&
      !!this.options.preserveLocal && this.options.canEditDisconnected?.() === true;
  }
  get canEdit() { return this.connected || this.localEditingAllowed; }
  get actionId() { return this.connected ? this.reservation : this.localEditingAllowed ? this.localAction : undefined; }
  get creationScope() { if (!this.connectionId) throw new Error('No live connection'); return `$dali:create:${this.connectionId}`; }
  get creating() { return !!this.actionId && this.reservedObjects.has(this.creationScope); }
  registerCreated(id: string) { if (this.creating) this.createdObjects.add(id); }
  allowsObject(id: string) { return !!this.actionId && (this.reservedObjects.has(id) || this.createdObjects.has(id)); }
  get editing() { return !!this.actionId && this.reservedObjects.size > 0; }
  isLocalAction(token: string) { return this.localAction === token; }
  private interrupted = false;
  private started = false;
  private readonly tabId: string;
  private recoveredActions = new Map<string, Set<string> | null>();
  get transportTabId() { return this.tabId; }
  recoverAction(original: string, committed: string) {
    if (original === committed || this.recoveredActions.get(original) === null) return;
    const fragments = this.recoveredActions.get(original) ?? new Set<string>(); fragments.add(committed);
    this.recoveredActions.set(original, fragments.size > 32 ? null : fragments);
  }
  private epoch?: string;
  private readonly abort = () => this.dispose();
  constructor(private options: SourceOptions) {
    this.tabId = options.liveTabId ?? crypto.randomUUID();
    options.signal?.addEventListener('abort', this.abort, { once: true });
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.abort);
  }
  private current() {
    if (this.controller.signal.aborted || this.options.signal?.aborted || this.options.isCurrent?.(this.options.generation) === false) throw new Error('Live source is stale');
  }
  private async request(action: string, body: Record<string, unknown>) {
    this.current();
    const response = await (this.options.fetch ?? fetch)(`/api/boards/${encodeURIComponent(this.options.boardId)}/live/${action}`, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: this.controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Dali-Account': this.options.accountId, 'X-Dali-Request': '1',
        ...(this.options.getRecoveryEpoch ? { 'X-Dali-Recovery-Epoch': this.options.getRecoveryEpoch() } : {}) },
      body: JSON.stringify(body),
    });
    this.current();
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      if (result.code === 'RECOVERY_EPOCH_MISMATCH') { this.interrupted = true; throw new RecoveryEpochError('RECOVERY_EPOCH_MISMATCH'); }
      if ([401, 403, 404].includes(response.status) || result.code === 'IDENTITY_CHANGED') {
        this.interrupted = true;
        const error = new SourceAccessError(response.status); this.options.onAuthorizationLost?.(error); throw error;
      }
      throw Object.assign(new Error('Live request failed'), { code: result.code, editor: typeof result.editor === 'string' ? result.editor : undefined });
    }
    return result;
  }
  private apply(snapshot: LiveSnapshot, receive: (docId: string, bytes: Uint8Array) => void) {
    this.current();
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 || snapshot.epoch !== this.options.getRecoveryEpoch?.() || (this.epoch && snapshot.epoch !== this.epoch)) throw new Error('Invalid live snapshot');
    if (snapshot.presence && typeof snapshot.presenceVersion === 'string') {
      this.presenceVersion = snapshot.presenceVersion;
      this.latestParticipants = snapshot.presence;
      // Reading the roster does not acknowledge our failed cursor publication.
      // Keep retry available until a publication actually succeeds.
      this.publishPresence(this.presencePublishFailed ? { state: 'error', participants: [] } : { state: 'ready', participants: snapshot.presence });
    }
    if (this.epoch && snapshot.revision <= this.revision) return;
    if (snapshot.title !== undefined && (typeof snapshot.title !== 'string' || snapshot.title.length > 4000)) throw new Error('Invalid live title');
    if (!!snapshot.root !== !!snapshot.content) throw new Error('Incomplete live snapshot');
    // Decode the pair before delivering either document.
    const root = snapshot.root ? decode(snapshot.root) : undefined;
    const content = snapshot.content ? decode(snapshot.content) : undefined;
    if (root && content) {
      Y.decodeUpdate(root); Y.decodeUpdate(content);
      if (snapshot.title !== undefined) this.options.onLiveSnapshot?.({ version: 1, epoch: snapshot.epoch, revision: snapshot.revision, titleRevision: snapshot.revision, title: snapshot.title,
        root: { docId: this.options.rootDocId, data: root }, content: { docId: this.options.contentDocId, data: content } });
      receive(this.options.rootDocId, root); this.current(); receive(this.options.contentDocId, content);
    }
    this.revision = snapshot.revision; this.epoch = snapshot.epoch;
    if (snapshot.title !== undefined) this.options.onLiveMetadata?.({ title: snapshot.title, revision: snapshot.revision });
  }
  async start(receive: (docId: string, bytes: Uint8Array) => void, disconnect: (reason: string) => void) {
    if (this.started) throw new Error('Live source already started');
    this.started = true;
    this.receive = receive; this.disconnected = disconnect;
    try {
      const snapshot = await this.request('connect', { tabId: this.tabId, activate: !this.options.readonly }) as LiveSnapshot;
      if (typeof snapshot.connectionId !== 'string' || !snapshot.connectionId) throw new Error('Missing connection');
      this.connectionId = snapshot.connectionId;
      this.apply(snapshot, receive);
      this.connectionChanged('connected');
      void this.poll(receive, disconnect);
    } catch (error) { this.interrupted = true; this.connectionChanged('disconnected'); throw error; }
  }
  /** Explicit clean-session reconnect. Pending local work belongs to the
   * separate recovery path and must never be merged merely by reconnecting.
   */
  reconnect(): Promise<void> {
    if (this.reconnecting) return this.reconnecting;
    this.reconnecting = this.resume().finally(() => { this.reconnecting = undefined; });
    return this.reconnecting;
  }
  private async resume() {
    this.current();
    if (this.connected || !this.started || !this.receive || !this.disconnected) return;
    this.localAction = undefined; this.reservation = undefined; this.reservedObjects.clear(); this.createdObjects.clear();
    this.connectionError = undefined; this.connectionChanged('checking');
    let fresh: string | undefined;
    try {
      if (!await this.options.canReconnectLive?.()) throw new Error('Local changes are pending. Keep this board open to review recovery.');
      this.current();
      const snapshot = await this.request('connect', { tabId: this.tabId, activate: !this.options.readonly }) as LiveSnapshot;
      if (typeof snapshot.connectionId !== 'string' || !snapshot.connectionId) throw new Error('Invalid reconnection');
      fresh = snapshot.connectionId;
      if (!snapshot.root || !snapshot.content || snapshot.epoch !== this.epoch || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < this.revision) throw new Error('Live state changed. Keep this board open to review recovery.');
      const root = decode(snapshot.root); const content = decode(snapshot.content); Y.decodeUpdate(root); Y.decodeUpdate(content);
      if (!await this.options.canReconnectLive?.({ root, content })) throw new Error('Local changes are pending. Keep this board open to review recovery.');
      this.current();
      this.reservation = undefined; this.reservedObjects.clear(); this.createdObjects.clear();
      this.presenceVersion = undefined; this.latestParticipants = undefined; this.presencePublishFailed = false;
      this.apply(snapshot, this.receive);
      this.connectionId = fresh; fresh = undefined; this.interrupted = false;
      this.publishPresence({ state: 'loading', participants: [] });
      this.options.onLiveReconnected?.(); this.connectionChanged('connected');
      void this.poll(this.receive, this.disconnected);
    } catch (error) {
      this.interrupted = true;
      if (fresh) await this.request('disconnect', { connectionId: fresh }).catch(() => {});
      if (!this.controller.signal.aborted && this.options.isCurrent?.(this.options.generation) !== false) {
        this.connectionError = error instanceof Error ? error.message : 'Connection could not be restored. Try again.';
        this.connectionChanged('disconnected');
      }
      throw error;
    }
  }
  private async poll(receive: (docId: string, bytes: Uint8Array) => void, disconnect: (reason: string) => void) {
    try {
      while (!this.controller.signal.aborted) {
        const next = await this.request('poll', { connectionId: this.connectionId, revision: this.revision, epoch: this.epoch, presenceVersion: this.presenceVersion ?? '' }) as LiveSnapshot;
        this.apply(next, receive);
      }
    } catch {
      if (!this.controller.signal.aborted) {
        this.interrupted = true; this.reservation = undefined; this.reservedObjects.clear(); this.createdObjects.clear();
        this.connectionChanged('disconnected'); this.publishPresence({ state: 'error', participants: [] }); disconnect('live-connection-interrupted');
      }
    }
  }
  get connected() { return !!this.connectionId && !this.interrupted && !this.controller.signal.aborted; }
  writeHeaders(operationId: string, reservation = this.reservation) {
    this.current();
    if (!this.connected) throw new Error('Live recovery requires reconciliation');
    if (reservation?.startsWith('local-')) throw new Error('Local actions require a fresh server reservation.');
    return { 'X-Dali-Connection': this.connectionId!, 'X-Dali-Operation': operationId, ...(reservation ? { 'X-Dali-Reservation': reservation } : {}) };
  }
  async acquire(objectIds: string[]) {
    this.current();
    if (this.localEditingAllowed) {
      if (this.localAction || !objectIds.length) throw new Error('Finish the current local action first.');
      this.localAction = `local-${crypto.randomUUID()}`; this.reservedObjects = new Set(objectIds); this.createdObjects.clear();
      return this.localAction;
    }
    if (!this.connected) throw new Error('Live source unavailable');
    const connection = this.connectionId;
    const result = await this.request('reserve', { connectionId: connection, objectIds });
    if (!this.connected || connection !== this.connectionId) throw new Error('Editing response is stale. Try the action again.');
    if (typeof result.token !== 'string') throw new Error('Invalid reservation');
    this.reservation = result.token; this.reservedObjects = new Set(objectIds);
    return result.token;
  }
  async release(token: string) {
    if (this.localAction === token) {
      try { await this.options.preserveLocal!(); }
      finally { if (this.localAction === token) { this.localAction = undefined; this.reservedObjects.clear(); this.createdObjects.clear(); } }
      return;
    }
    if (this.connected) await this.request('release', { connectionId: this.connectionId, token });
    if (this.reservation === token) { this.reservation = undefined; this.reservedObjects.clear(); this.createdObjects.clear(); }
  }
  async authorizeHistory(actionId: string): Promise<boolean> {
    if (!this.connected || !this.reservation) throw new Error('History needs fresh editing access.');
    const connection = this.connectionId; const token = this.reservation;
    const fragments = this.recoveredActions.get(actionId);
    if (fragments === null) throw new Error('This recovered history action has too many fragments. Your current canvas is unchanged.');
    const result = await this.request('history', { connectionId: connection, token, actionId, ...(fragments ? { recoveredActionIds: [...fragments] } : {}) });
    if (!this.connected || connection !== this.connectionId || token !== this.reservation) throw new Error('History response is stale. Try the action again.');
    if (typeof result.eligible !== 'boolean') throw new Error('Invalid history authorization');
    return result.eligible;
  }
  dispose() {
    if (this.controller.signal.aborted) return;
    const connection = this.connectionId;
    this.controller.abort(); this.publishPresence({ state: 'error', participants: [] }); this.options.signal?.removeEventListener('abort', this.abort);
    this.connectionChanged('disconnected');
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.abort);
    if (connection) {
      // Aborting a long poll does not reliably close its server connection in
      // every browser/proxy. Retire only this original session, even on pagehide.
      // This cleanup never applies a response to a newer runtime.
      try {
        void (this.options.disconnectFetch ?? this.options.fetch ?? fetch)(`/api/boards/${encodeURIComponent(this.options.boardId)}/live/disconnect`, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive: true,
          headers: { 'Content-Type': 'application/json', 'X-Dali-Account': this.options.accountId, 'X-Dali-Request': '1', ...(this.epoch ? { 'X-Dali-Recovery-Epoch': this.epoch } : {}) },
          body: JSON.stringify({ connectionId: connection }),
        }).catch(() => {});
      } catch { /* Transport expiry remains the fallback when cleanup cannot be sent. */ }
    }
  }
}

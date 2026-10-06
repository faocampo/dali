import type { PresenceParticipant } from '../../../server/boards/presence';
import * as Y from 'yjs';
import { RecoveryEpochError, SourceAccessError, type SourceOptions } from './doc-source';
export type LiveSnapshot = { connectionId?: string; revision: number; epoch: string; root?: string; content?: string; title?: string; presence?: PresenceParticipant[]; presenceVersion?: string };
const decode = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
/** A connection belongs to exactly one runtime; recovery creates a fresh one. */
export class BoardLiveSource {
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
    try {
      await this.request('presence', { connectionId: this.connectionId, presence: data });
      const recovered = this.presencePublishFailed;
      this.presencePublishFailed = false;
      if (recovered && this.connected && this.latestParticipants) this.publishPresence({ state: 'ready', participants: this.latestParticipants });
    } catch {
      if (!this.controller.signal.aborted) {
        this.presencePublishFailed = true;
        this.publishPresence({ state: 'error', participants: [] });
      }
    }
  }
  private connectionId?: string;
  private revision = 0;
  private reservation?: string;
  private reservedObjects = new Set<string>();
  private createdObjects = new Set<string>();
  get creationScope() { if (!this.connectionId) throw new Error('No live connection'); return `$dali:create:${this.connectionId}`; }
  get creating() { return this.connected && this.reservedObjects.has(this.creationScope); }
  registerCreated(id: string) { if (this.creating) this.createdObjects.add(id); }
  allowsObject(id: string) { return this.connected && (this.reservedObjects.has(id) || this.createdObjects.has(id)); }
  get editing() { return this.connected && this.reservedObjects.size > 0; }
  private interrupted = false;
  private started = false;
  private readonly tabId = crypto.randomUUID();
  private epoch?: string;
  private readonly abort = () => this.dispose();
  constructor(private options: SourceOptions) {
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
    if (root && content) { Y.decodeUpdate(root); Y.decodeUpdate(content); receive(this.options.rootDocId, root); this.current(); receive(this.options.contentDocId, content); }
    this.revision = snapshot.revision; this.epoch = snapshot.epoch;
    if (snapshot.title !== undefined) this.options.onLiveMetadata?.({ title: snapshot.title, revision: snapshot.revision });
  }
  async start(receive: (docId: string, bytes: Uint8Array) => void, disconnect: (reason: string) => void) {
    if (this.started) throw new Error('Live source already started');
    this.started = true;
    try {
      const snapshot = await this.request('connect', { tabId: this.tabId, activate: !this.options.readonly }) as LiveSnapshot;
      if (typeof snapshot.connectionId !== 'string' || !snapshot.connectionId) throw new Error('Missing connection');
      this.connectionId = snapshot.connectionId;
      this.apply(snapshot, receive);
      void this.poll(receive, disconnect);
    } catch (error) { this.interrupted = true; throw error; }
  }
  private async poll(receive: (docId: string, bytes: Uint8Array) => void, disconnect: (reason: string) => void) {
    try {
      while (!this.controller.signal.aborted) {
        const next = await this.request('poll', { connectionId: this.connectionId, revision: this.revision, epoch: this.epoch, presenceVersion: this.presenceVersion ?? '' }) as LiveSnapshot;
        this.apply(next, receive);
      }
    } catch {
      if (!this.controller.signal.aborted) { this.interrupted = true; this.publishPresence({ state: 'error', participants: [] }); disconnect('live-connection-interrupted'); }
    }
  }
  get connected() { return !!this.connectionId && !this.interrupted && !this.controller.signal.aborted; }
  writeHeaders(operationId: string, reservation = this.reservation) {
    this.current();
    if (!this.connected) throw new Error('Live recovery requires reconciliation');
    return { 'X-Dali-Connection': this.connectionId!, 'X-Dali-Operation': operationId, ...(reservation ? { 'X-Dali-Reservation': reservation } : {}) };
  }
  async acquire(objectIds: string[]) {
    if (!this.connected) throw new Error('Live source unavailable');
    const result = await this.request('reserve', { connectionId: this.connectionId, objectIds });
    if (typeof result.token !== 'string') throw new Error('Invalid reservation');
    this.reservation = result.token; this.reservedObjects = new Set(objectIds);
    return result.token;
  }
  async release(token: string) {
    if (this.connected) await this.request('release', { connectionId: this.connectionId, token });
    if (this.reservation === token) { this.reservation = undefined; this.reservedObjects.clear(); this.createdObjects.clear(); }
  }
  dispose() {
    if (this.controller.signal.aborted) return;
    const disconnect = this.connected;
    this.controller.abort(); this.publishPresence({ state: 'error', participants: [] }); this.options.signal?.removeEventListener('abort', this.abort);
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.abort);
    if (disconnect) {
      // Aborting a long poll does not reliably close its server connection in
      // every browser/proxy. Retire only this original session, even on pagehide.
      // This cleanup never applies a response to a newer runtime.
      try {
        void (this.options.fetch ?? fetch)(`/api/boards/${encodeURIComponent(this.options.boardId)}/live/disconnect`, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive: true,
          headers: { 'Content-Type': 'application/json', 'X-Dali-Account': this.options.accountId, 'X-Dali-Request': '1', ...(this.epoch ? { 'X-Dali-Recovery-Epoch': this.epoch } : {}) },
          body: JSON.stringify({ connectionId: this.connectionId }),
        }).catch(() => {});
      } catch { /* Transport expiry remains the fallback when cleanup cannot be sent. */ }
    }
  }
}

import type { SaveSnapshot } from './save-status';
export function shouldWarnOnLeave(snapshot: SaveSnapshot | undefined, stalled = false): boolean {
  return !!snapshot && (snapshot.state === 'failed' || (snapshot.state !== 'saved' && stalled));
}
type Destination = () => void | Promise<void>;
let handler: ((destination: Destination) => void) | undefined;
export function installBoardNavigationGuard(next: (destination: Destination) => void) {
  handler = next; return () => { if (handler === next) handler = undefined; };
}
export function requestBoardNavigation(destination: Destination) { if (handler) handler(destination); else void destination(); }

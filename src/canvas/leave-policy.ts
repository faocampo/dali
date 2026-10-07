import type { SaveSnapshot } from './save-status';
export function shouldWarnOnLeave(snapshot: SaveSnapshot | undefined, stalled = false): boolean {
  return !!snapshot && (snapshot.state === 'failed' || (snapshot.state !== 'saved' && stalled));
}
type Destination = () => void | Promise<void>;
export type NavigationOperation = 'navigate' | 'sign-out';
let handler: ((destination: Destination, operation: NavigationOperation) => void) | undefined;
export function installBoardNavigationGuard(next: (destination: Destination, operation: NavigationOperation) => void) {
  handler = next; return () => { if (handler === next) handler = undefined; };
}
export function requestBoardNavigation(destination: Destination, operation: NavigationOperation = 'navigate') { if (handler) handler(destination, operation); else void destination(); }

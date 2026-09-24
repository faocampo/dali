import { MenuIcon } from './MenuIcon';
import type { SessionDescriptor } from '../auth/AuthBoundary';
import { Dropdown } from './Dropdown';

export function AccountMenu({ member, signOut, role }: { member: SessionDescriptor; signOut?: () => Promise<void>; role?: 'owner' | 'editor' | 'viewer' }) {
  const name = member.displayName.trim() || member.email;
  const parts = name.split(/\s+/);
  const initials = [parts[0], ...(parts.length > 1 ? [parts.at(-1)] : [])]
    .map(part => Array.from(part ?? '')[0] ?? '').join('').toLocaleUpperCase();
  return <Dropdown className="board-account" label={`Account for ${name}`} summary={<>
    <span className="board-account__avatar" aria-hidden="true">{initials}</span>
    <span className="board-account__name">{name}</span>
  </>}>
    {close => <><p className="board-account__identity">{name}</p><p className="board-account__email">{member.email}</p>
      {(role || member.systemRole === 'viewer') && <p className="board-role">{role === 'owner' ? 'Owner' : role === 'viewer' || member.systemRole === 'viewer' ? 'Viewer · View only' : 'Editor'}</p>}
      <button onClick={() => { close(); void signOut?.(); }}><MenuIcon name="logout" />Sign out of Dalí</button></>}
  </Dropdown>;
}

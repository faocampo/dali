import type { SessionDescriptor } from '../auth/AuthBoundary';
import { Dropdown } from './Dropdown';

export function AccountMenu({ member, signOut }: { member: SessionDescriptor; signOut?: () => Promise<void> }) {
  const name = member.displayName.trim() || member.email;
  const parts = name.split(/\s+/);
  const initials = [parts[0], ...(parts.length > 1 ? [parts.at(-1)] : [])]
    .map(part => Array.from(part ?? '')[0] ?? '').join('').toLocaleUpperCase();
  return <Dropdown className="board-account" label={`Account for ${name}`} summary={<>
    <span className="board-account__avatar" aria-hidden="true">{initials}</span>
    <span className="board-account__name">{name}</span>
  </>}>
    {close => <><p className="board-account__identity">{name}</p><p className="board-account__email">{member.email}</p>
      <button onClick={() => { close(); void signOut?.(); }}>Sign out of Dalí</button></>}
  </Dropdown>;
}

import { AuthBoundary } from './auth/AuthBoundary';

export default function App() {
  return <AuthBoundary>{(member, signOut) => <main className="djai-library" style={{ padding: 24 }}>
    <h1>Your boards</h1><p>Boards you can access with this account.</p>
    <p>{member.displayName}</p><p style={{ overflowWrap: 'anywhere' }}>{member.email}</p>
    <button className="djai-button" style={{ minHeight: 44 }} onClick={() => { void signOut(); }}>Sign out of Dalí</button>
  </main>}</AuthBoundary>;
}

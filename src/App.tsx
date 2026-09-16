import { AuthBoundary } from './auth/AuthBoundary';
import logo from '../imgs/svg/dali-symbol-color.svg';

export default function App() {
  return <AuthBoundary>{(member, signOut) => <div className="board-library">
    <header className="board-library__header" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <a className="djai-brand" href="/" aria-label="Dalí"><img src={logo} alt="" height={34} /></a>
      <div style={{ flex: 1, overflowWrap: 'anywhere', minWidth: 0, fontSize: 15 }}>
        <p>{member.displayName}</p><p>{member.email}</p>
      </div>
      <button className="djai-ghost" style={{ minHeight: 44, fontSize: 13, fontWeight: 600 }} onClick={() => { void signOut(); }}>Sign out of Dalí</button>
    </header>
    <main className="board-library__main">
      <div className="board-library__title-row"><div>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Your boards</h1><p style={{ fontSize: 15, color: '#57534e' }}>Boards you can access with this account.</p>
      </div></div>
    </main>
  </div>}</AuthBoundary>;
}

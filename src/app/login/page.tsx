import { login } from "../actions";
export default function Login({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="login">
      <h1>Sign in to Mavericks Inventory</h1>
      {searchParams.error && <div className="err">Email or password is incorrect.</div>}
      <form action={login} className="card">
        <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoFocus /></div>
        <div><label htmlFor="password">Password</label><input id="password" name="password" type="password" required /></div>
        <button>Sign in</button>
      </form>
    </div>
  );
}

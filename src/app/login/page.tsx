import { login } from "../actions";
import { LoginForm } from "./login-form";
import { Package, ShieldCheck } from "lucide-react";

export default function Login({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: "linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 1px 1px rgba(0, 0, 0, 0.02)",
          padding: "36px 32px",
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "linear-gradient(135deg, var(--primary) 0%, #1e40af 100%)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
              marginBottom: 14,
            }}
          >
            <Package size={22} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em", margin: 0 }}>
            Mavericks Inventory
          </h1>
          <p style={{ fontSize: 13, color: "var(--foreground-muted)", marginTop: 6, marginBottom: 0 }}>
            Enterprise Stock Ledger, Corporate Goodies & Distribution
          </p>
        </div>

        {/* Login Form Component */}
        <LoginForm loginAction={login} hasError={Boolean(searchParams.error)} />

        {/* Security Footer Notice */}
        <div
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 11,
            color: "var(--foreground-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <ShieldCheck size={14} style={{ color: "var(--primary)" }} />
          <span>Secured with Role-Based Access Control & Immutable Ledger</span>
        </div>
      </div>
    </div>
  );
}


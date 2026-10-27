"use client";

import { useState } from "react";
import { Mail, Lock, ArrowRight, Shield, UserCheck, AlertCircle } from "lucide-react";

export function LoginForm({
  loginAction,
  hasError,
}: {
  loginAction: (formData: FormData) => Promise<void>;
  hasError: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const demoAccounts = [
    { label: "Admin", email: "admin@mavericks.test", role: "Full System Clearance" },
    { label: "Manager", email: "manager@mavericks.test", role: "Requisitions & Reviews" },
    { label: "Authority", email: "authority@mavericks.test", role: "Final Stock Signoff" },
    { label: "Executive", email: "exec@mavericks.test", role: "Goodies & Requests" },
  ];

  const handleSelectDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {hasError && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 6,
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "var(--danger)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          <span>Invalid email or password. Please verify credentials.</span>
        </div>
      )}

      <form
        action={async (formData) => {
          setLoading(true);
          await loginAction(formData);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div>
          <label
            htmlFor="email"
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--foreground-muted)",
              marginBottom: 6,
            }}
          >
            Corporate Email
          </label>
          <div style={{ position: "relative" }}>
            <Mail
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--foreground-subtle)",
              }}
            />
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@mavericks.corp"
              style={{ width: "100%", paddingLeft: 36 }}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--foreground-muted)",
              marginBottom: 6,
            }}
          >
            Password
          </label>
          <div style={{ position: "relative" }}>
            <Lock
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--foreground-subtle)",
              }}
            />
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              style={{ width: "100%", paddingLeft: 36 }}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn primary"
          disabled={loading}
          style={{
            width: "100%",
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 600,
            marginTop: 4,
          }}
        >
          {loading ? "Authenticating…" : "Sign In to Workspace"}
          <ArrowRight size={16} />
        </button>
      </form>

      {/* Quick Access Demo Credentials Helper */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: 16,
          marginTop: 4,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--foreground-subtle)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Shield size={13} style={{ color: "var(--primary)" }} /> One-Click Demo Role Accounts
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {demoAccounts.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => handleSelectDemo(d.email)}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: 6,
                background: "var(--background-subtle)",
                border: "1px solid var(--border-subtle)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>
                {d.label}
              </div>
              <div style={{ fontSize: 10, color: "var(--foreground-muted)", marginTop: 2 }}>
                {d.role}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

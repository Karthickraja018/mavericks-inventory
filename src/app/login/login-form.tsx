"use client";

import { useState } from "react";
import { Mail, Lock, ArrowRight, Shield, AlertCircle } from "lucide-react";

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
              color: "var(--ink)",
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
                color: "var(--muted)",
              }}
            />
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@mavericks.test"
              style={{ width: "100%", paddingLeft: 36, height: 38, fontSize: 13.5 }}
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
              color: "var(--ink)",
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
                color: "var(--muted)",
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
              style={{ width: "100%", paddingLeft: 36, height: 38, fontSize: 13.5 }}
            />
          </div>
        </div>

        <button
          type="submit"
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
            minHeight: 40,
            background: "var(--accent)",
            color: "#ffffff",
            border: "1px solid var(--accent)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {loading ? "Authenticating…" : "Sign In to Workspace"}
          <ArrowRight size={16} />
        </button>
      </form>

      {/* Quick Access Demo Credentials Helper */}
      <div
        style={{
          borderTop: "1px solid var(--line)",
          paddingTop: 16,
          marginTop: 4,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Shield size={13} style={{ color: "var(--accent)" }} /> One-Click Demo Role Accounts
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {demoAccounts.map((d) => {
            const isSelected = email === d.email;
            return (
              <button
                key={d.label}
                type="button"
                onClick={() => handleSelectDemo(d.email)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: isSelected ? "var(--accent-soft)" : "var(--surface-subtle)",
                  border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                  cursor: "pointer",
                  minHeight: 52,
                  color: "var(--ink)",
                  boxShadow: "none",
                  transform: "none",
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: isSelected ? "var(--accent-dark)" : "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    width: "100%",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{d.label}</span>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 650,
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: isSelected ? "rgba(37, 99, 235, 0.2)" : "rgba(15, 23, 42, 0.08)",
                      color: isSelected ? "var(--accent-dark)" : "var(--ink-soft)",
                    }}
                  >
                    {d.label === "Admin"
                      ? "Admin"
                      : d.label === "Manager"
                      ? "Approver 1"
                      : d.label === "Authority"
                      ? "Approver 2"
                      : "Executive"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: isSelected ? "var(--accent)" : "var(--muted)",
                    marginTop: 3,
                    lineHeight: 1.3,
                  }}
                >
                  {d.role}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

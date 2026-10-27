"use client";

import { useState } from "react";
import { Plus, X, Calendar, Tag, MapPin, AlignLeft } from "lucide-react";
import { createEvent } from "./actions";

export function CreateEventDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          minHeight: 34,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <Plus size={15} /> Create Event
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(3px)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 500,
              background: "var(--surface)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              borderRadius: "var(--radius)",
              padding: 0,
              margin: 0,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Create Corporate Event</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                  Setup a new event to manage participant recognition and goodies.
                </p>
              </div>
              <button
                className="ghost"
                onClick={() => setIsOpen(false)}
                style={{ padding: 4, minHeight: 28, minWidth: 28 }}
              >
                <X size={16} />
              </button>
            </div>

            <form action={createEvent} style={{ padding: "20px" }}>
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                    Event Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Annual Tech Hackathon 2026"
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                      Category
                    </label>
                    <select name="category" defaultValue="Hackathon" style={{ width: "100%", height: 36, fontSize: 13 }}>
                      <option value="Hackathon">Hackathon</option>
                      <option value="Town Hall">Town Hall</option>
                      <option value="Sports Tournament">Sports Tournament</option>
                      <option value="Cultural Fest">Cultural Fest</option>
                      <option value="Milestone & Awards">Milestone & Awards</option>
                      <option value="Onboarding">Onboarding</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                      Event Date
                    </label>
                    <input
                      type="date"
                      name="date"
                      defaultValue={new Date().toISOString().split("T")[0]}
                      style={{ width: "100%", height: 36, fontSize: 13 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                    Location / Venue
                  </label>
                  <input
                    type="text"
                    name="location"
                    placeholder="e.g. Chennai Campus / Hybrid"
                    style={{ width: "100%", height: 36, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Brief description of the event, purpose, and recognition criteria..."
                    style={{ width: "100%", fontSize: 13, resize: "vertical" }}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  borderTop: "1px solid var(--line)",
                  paddingTop: 16,
                }}
              >
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setIsOpen(false)}
                  style={{ minHeight: 34, fontSize: 13 }}
                >
                  Cancel
                </button>
                <button type="submit" style={{ minHeight: 34, fontSize: 13, fontWeight: 600 }}>
                  Create & Open Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

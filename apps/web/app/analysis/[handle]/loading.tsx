export default function AnalysisLoading() {
  return (
    <main className="terminal-shell">
      <div style={{ padding: "24px" }}>
        {/* Hero grid skeleton */}
        <section className="terminal-grid hero-grid" style={{ animationDelay: "0s" }}>
          {/* Left: Score card skeleton */}
          <div className="terminal-panel skeleton-card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20 }}>
              <div className="skeleton" style={{ width: 78, height: 78, borderRadius: 18, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-line" style={{ width: "70%", height: 28 }} />
                <div className="skeleton skeleton-line" style={{ width: "50%", height: 14, marginTop: 8 }} />
              </div>
            </div>
            <div className="skeleton" style={{ width: 100, height: 64, marginBottom: 16 }} />
            <div className="skeleton" style={{ width: 120, height: 32, borderRadius: 9, marginBottom: 20 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="skeleton skeleton-box" />
              <div className="skeleton skeleton-box" />
              <div className="skeleton skeleton-box" />
              <div className="skeleton skeleton-box" />
            </div>
          </div>

          {/* Center: Insights skeleton */}
          <div className="terminal-panel skeleton-card" style={{ padding: 16 }}>
            <div className="skeleton skeleton-line" style={{ width: "40%", height: 18, marginBottom: 20 }} />
            <div className="skeleton skeleton-line" style={{ width: "100%", height: 48, marginBottom: 10 }} />
            <div className="skeleton skeleton-line" style={{ width: "100%", height: 48, marginBottom: 10 }} />
            <div className="skeleton skeleton-line" style={{ width: "100%", height: 48, marginBottom: 10 }} />
            <div className="skeleton skeleton-line" style={{ width: "85%", height: 48 }} />
          </div>

          {/* Right: Radar chart skeleton */}
          <div className="terminal-panel skeleton-card" style={{ padding: 16, minHeight: 310 }}>
            <div className="skeleton skeleton-line" style={{ width: "50%", height: 18, marginBottom: 20 }} />
            <div className="skeleton" style={{ width: "100%", height: 240, borderRadius: 12 }} />
          </div>
        </section>

        {/* Tabs skeleton */}
        <div className="terminal-panel skeleton-card" style={{ marginTop: 12, padding: 16 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            <div className="skeleton" style={{ width: 80, height: 36, borderRadius: 9 }} />
            <div className="skeleton" style={{ width: 100, height: 36, borderRadius: 9 }} />
            <div className="skeleton" style={{ width: 90, height: 36, borderRadius: 9 }} />
            <div className="skeleton" style={{ width: 110, height: 36, borderRadius: 9 }} />
          </div>
          {/* Table rows skeleton */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: 16, padding: "12px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0 }} />
              <div className="skeleton skeleton-line" style={{ width: "20%", height: 16 }} />
              <div className="skeleton skeleton-line" style={{ width: "10%", height: 16 }} />
              <div className="skeleton skeleton-line" style={{ width: "12%", height: 16 }} />
              <div className="skeleton skeleton-line" style={{ width: "15%", height: 16 }} />
              <div className="skeleton skeleton-line" style={{ width: "10%", height: 16 }} />
              <div className="skeleton skeleton-line" style={{ width: "8%", height: 16 }} />
            </div>
          ))}
        </div>

        {/* Loading indicator */}
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <p className="muted" style={{ fontSize: 14 }}>
            Collecting tweets, classifying signals, verifying wallet activity...
          </p>
          <div style={{ marginTop: 12 }}>
            <div style={{
              width: 200,
              height: 4,
              margin: "0 auto",
              borderRadius: 2,
              background: "var(--panel-3)",
              overflow: "hidden",
            }}>
              <div style={{
                width: "40%",
                height: "100%",
                borderRadius: 2,
                background: "var(--green)",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

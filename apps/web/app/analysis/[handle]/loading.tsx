export default function AnalysisLoading() {
  return (
    <main className="terminal-shell">
      <div style={{ padding: "60px 24px", textAlign: "center" }}>
        <div className="avatar-orb" style={{ margin: "0 auto 20px", width: 64, height: 64 }}>
          <img src="/assets/agent-orb.svg" alt="" />
        </div>
        <h2 style={{ margin: "0 0 8px" }}>Analyzing KOL...</h2>
        <p className="muted">
          Collecting tweets, classifying signals, verifying wallet activity.
          This typically takes 1-2 minutes.
        </p>
        <div style={{ marginTop: 24 }}>
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
    </main>
  );
}

import { notFound } from "next/navigation";
import { tokenProfiles } from "@memerecall/core";

export default async function TokenPage({
  params,
}: {
  params: Promise<{ contract: string }>;
}) {
  const { contract } = await params;
  const token = tokenProfiles.find((item) => item.contract === contract);
  if (!token) {
    notFound();
  }

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="detail-header">
          <div>
            <div className="eyebrow">Revival Radar</div>
            <h1 style={{ margin: "0 0 8px" }}>{token.symbol}</h1>
            <div className="muted">{token.name}</div>
          </div>
          <div className="score-pill" style={{ fontSize: 24 }}>{token.score}</div>
        </div>

        <div className="badge-row" style={{ marginBottom: 24 }}>
          <span className="badge">Lifecycle {token.lifecycleStage}</span>
          {token.tags.map((tag) => (
            <span key={tag} className="badge">{tag}</span>
          ))}
        </div>

        <div className="card-grid">
          {token.factors.map((factor) => (
            <div className="factor-card" key={factor.key}>
              <div className="factor-label">{factor.label}</div>
              <div className="factor-value">{factor.value}</div>
              <div className="muted">{factor.note}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="two-col">
        <div className="panel">
          <h2 className="section-title">Revival Timeline</h2>
          <div className="evidence-list">
            {token.timeline.map((item) => (
              <div key={item.id} className="evidence-item">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>{item.title}</strong>
                  <span className="muted">{item.timestamp}</span>
                </div>
                <p>{item.detail}</p>
                <div className="muted">Source: {item.source}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2 className="section-title">Alerts</h2>
          <div className="evidence-list">
            {token.alerts.map((alert, index) => (
              <div key={alert + index} className="evidence-item">
                <strong>{alert}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

import { notFound } from "next/navigation";
import { kolProfiles } from "@memerecall/core";

export default async function KolPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const kol = kolProfiles.find((item) => item.handle === handle);
  if (!kol) {
    notFound();
  }

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="detail-header">
          <div>
            <div className="eyebrow">Trust Card</div>
            <h1 style={{ margin: "0 0 8px" }}>{kol.displayName}</h1>
            <div className="muted">@{kol.handle}</div>
          </div>
          <div className="score-pill" style={{ fontSize: 24 }}>{kol.score}</div>
        </div>

        <div className="badge-row" style={{ marginBottom: 24 }}>
          <span className="badge">Wallet confidence {kol.walletConfidence}%</span>
          <span className="badge">{kol.followerBucket}</span>
          <span className="badge">{kol.sampleCalls} tracked calls</span>
          <span className="badge">{kol.dumpChains} dump chains</span>
        </div>

        <div className="detail-metrics">
          {kol.factors.map((factor) => (
            <div className="factor-card" key={factor.key}>
              <div className="factor-label">{factor.label}</div>
              <div className="factor-value">{factor.value}</div>
              <div className="muted">{factor.note}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 24 }}>
        <h2 className="section-title">Evidence Trail</h2>
        <div className="evidence-list">
          {kol.evidence.map((item) => (
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
      </section>
    </main>
  );
}

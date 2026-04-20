import Link from "next/link";
import { Nav } from "./components/nav";

/* ---- Icons ---- */

function CheckCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function XCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="terminal-shell">
      <Nav />

      {/* ===== HERO — Slogan First ===== */}
      <section className="landing-hero">
        <div className="hero-glow" />
        <div className="hero-content">
          <h1 className="hero-title">
            Don&apos;t Trust the Tweet.<br />
            <span className="hero-highlight-green">Verify the Trade.</span>
          </h1>
          <p className="hero-tagline">
            Find the 1% of Crypto Twitter who actually buy what they shill, and copy their wins.
          </p>
          <p className="hero-subtitle">
            MemeRecall is the only tool that proves whether a KOL&apos;s tweet
            matches their wallet, and whether following them <em>actually makes money</em>.
          </p>
          <div className="hero-cta-row">
            <Link href="/leaderboard" className="cta-primary">
              See Who&apos;s Verified <ArrowRight />
            </Link>
            <Link href="/submit" className="cta-secondary">
              Submit a KOL to Verify
            </Link>
          </div>
        </div>
      </section>

      {/* ===== THE THREE PROOFS — Core Value ===== */}
      <section className="landing-section">
        <div className="section-inner">
          <div className="section-badge">The Only Thing That Matters</div>
          <h2 className="section-title">Three Proofs. All Required.</h2>
          <p className="section-subtitle">
            Most tools check one dimension. We require all three.
            If any proof fails, the KOL doesn&apos;t make the leaderboard.
          </p>

          <div className="proof-grid">
            {/* PROOF 1 */}
            <div className="proof-card">
              <div className="proof-num">1</div>
              <div className="proof-icon proof-icon-cyan"><TwitterIcon /></div>
              <h3>Tweeted for Real</h3>
              <p className="proof-desc">
                GPT reads every tweet and classifies intent.
                &ldquo;Just aped into $BONK&rdquo; = <strong>Claimed Buy (S3)</strong>.
                Retweets, memes, vague opinions = filtered as noise.
              </p>
              <div className="proof-example">
                <div className="proof-example-row">
                  <span className="proof-check"><CheckCircle /></span>
                  <code>&quot;Loaded a bag of $WIF at 0.02&quot;</code>
                  <span className="proof-tag proof-tag-green">S3: Buy Signal</span>
                </div>
                <div className="proof-example-row">
                  <span className="proof-x"><XCircle /></span>
                  <code>&quot;$WIF is looking interesting&quot;</code>
                  <span className="proof-tag proof-tag-gray">S2: Opinion Only</span>
                </div>
              </div>
            </div>

            {/* PROOF 2 */}
            <div className="proof-card">
              <div className="proof-num">2</div>
              <div className="proof-icon proof-icon-green"><WalletIcon /></div>
              <h3>Bought for Real</h3>
              <p className="proof-desc">
                We check the KOL&apos;s on-chain wallet within minutes of the tweet.
                Did they actually execute the trade? When? How much?
              </p>
              <div className="proof-example">
                <div className="proof-example-row">
                  <span className="proof-check"><CheckCircle /></span>
                  <code>Tweet 14:00 &rarr; Wallet buy 14:03</code>
                  <span className="proof-tag proof-tag-green">Verified</span>
                </div>
                <div className="proof-example-row">
                  <span className="proof-x"><XCircle /></span>
                  <code>Tweet &quot;bought $X&quot; &rarr; No wallet trade</code>
                  <span className="proof-tag proof-tag-red">Fake Claim</span>
                </div>
              </div>
            </div>

            {/* PROOF 3 */}
            <div className="proof-card">
              <div className="proof-num">3</div>
              <div className="proof-icon proof-icon-amber"><DollarIcon /></div>
              <h3>Profitable for Real</h3>
              <p className="proof-desc">
                We simulate copy-trading every verified signal.
                Median ROI, win rate, and net PnL &mdash; would YOU have made money?
              </p>
              <div className="proof-example">
                <div className="proof-example-row">
                  <span className="proof-check"><CheckCircle /></span>
                  <code>Median ROI +23%, Win Rate 65%</code>
                  <span className="proof-tag proof-tag-green">Copy-Tradable</span>
                </div>
                <div className="proof-example-row">
                  <span className="proof-x"><XCircle /></span>
                  <code>Median ROI -15%, Win Rate 30%</code>
                  <span className="proof-tag proof-tag-red">Money Loser</span>
                </div>
              </div>
            </div>
          </div>

          <div className="proof-summary">
            <span className="proof-summary-label">Verified Copy-Tradable Twitter Signals</span>
            <span className="proof-summary-formula">
              <span className="pf-item pf-cyan">Tweeted for Real</span>
              <span className="pf-plus">+</span>
              <span className="pf-item pf-green">Bought for Real</span>
              <span className="pf-plus">+</span>
              <span className="pf-item pf-amber">Profitable for Real</span>
              <span className="pf-equals">=</span>
              <span className="pf-result">Trustworthy Signal</span>
            </span>
          </div>
        </div>
      </section>

      {/* ===== WHY NOT JUST... ===== */}
      <section className="landing-section landing-section-dark">
        <div className="section-inner">
          <h2 className="section-title">Why Existing Tools Aren&apos;t Enough</h2>
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Tweeted?</th>
                  <th>Bought?</th>
                  <th>Profitable?</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Nansen / Arkham</strong></td>
                  <td><span className="compare-x"><XCircle /></span></td>
                  <td><span className="compare-check"><CheckCircle /></span></td>
                  <td><span className="compare-check"><CheckCircle /></span></td>
                  <td className="compare-verdict">Silent Whales only &mdash; can&apos;t copy without signal</td>
                </tr>
                <tr>
                  <td><strong>LunarCrush</strong></td>
                  <td><span className="compare-check"><CheckCircle /></span></td>
                  <td><span className="compare-x"><XCircle /></span></td>
                  <td><span className="compare-x"><XCircle /></span></td>
                  <td className="compare-verdict">Sentiment only &mdash; no proof they traded</td>
                </tr>
                <tr>
                  <td><strong>CT &ldquo;Alpha Groups&rdquo;</strong></td>
                  <td><span className="compare-check"><CheckCircle /></span></td>
                  <td><span className="compare-x"><XCircle /></span></td>
                  <td><span className="compare-x"><XCircle /></span></td>
                  <td className="compare-verdict">Trust-based &mdash; no on-chain verification</td>
                </tr>
                <tr className="compare-highlight">
                  <td><strong>MemeRecall</strong></td>
                  <td><span className="compare-check"><CheckCircle /></span></td>
                  <td><span className="compare-check"><CheckCircle /></span></td>
                  <td><span className="compare-check"><CheckCircle /></span></td>
                  <td className="compare-verdict compare-verdict-green">All three verified &mdash; copy-tradable signals</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS — Simplified ===== */}
      <section className="landing-section">
        <div className="section-inner">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">From 800 wallets to a verified shortlist in under 5 minutes.</p>
          <div className="steps-row">
            <div className="step-compact">
              <div className="step-compact-num">1</div>
              <h4>Discover</h4>
              <p>Scan 800 KOL wallets across 4 chains</p>
            </div>
            <div className="step-arrow-h">&rarr;</div>
            <div className="step-compact">
              <div className="step-compact-num">2</div>
              <h4>Filter</h4>
              <p>5 rules reject 94% (zero AI cost)</p>
            </div>
            <div className="step-arrow-h">&rarr;</div>
            <div className="step-compact">
              <div className="step-compact-num">3</div>
              <h4>Analyze</h4>
              <p>GPT classifies tweets, matches wallet trades</p>
            </div>
            <div className="step-arrow-h">&rarr;</div>
            <div className="step-compact">
              <div className="step-compact-num">4</div>
              <h4>Rank</h4>
              <p>Score by authenticity, alpha, coverage, discipline</p>
            </div>
          </div>
          <div className="steps-stats">
            <span>Total cost: <strong>~$2/run</strong></span>
            <span>Time: <strong>2-5 min</strong></span>
            <span>Output: <strong>~12 verified callers</strong></span>
          </div>
        </div>
      </section>

      {/* ===== ACTION TIERS ===== */}
      <section className="landing-section landing-section-dark">
        <div className="section-inner">
          <h2 className="section-title">What You Get</h2>
          <p className="section-subtitle">
            Every KOL gets a clear, evidence-backed action tier.
          </p>
          <div className="tiers-grid">
            <div className="tier-card tier-auto-copy">
              <div className="tier-label">AUTO COPY</div>
              <p>High authenticity + proven profits. Safe to follow.</p>
            </div>
            <div className="tier-card tier-watchlist">
              <div className="tier-label">WATCHLIST</div>
              <p>Promising but needs more data. Verify manually.</p>
            </div>
            <div className="tier-card tier-narrative">
              <div className="tier-label">NARRATIVE</div>
              <p>Good for narratives. Don&apos;t copy-trade.</p>
            </div>
            <div className="tier-card tier-avoid">
              <div className="tier-label">AVOID</div>
              <p>Sells right after shilling. Pump-dump pattern.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="landing-section landing-cta-section">
        <div className="section-inner" style={{ textAlign: "center" }}>
          <h2 className="section-title" style={{ fontSize: "clamp(24px, 4vw, 40px)" }}>
            Stop Guessing. Start Verifying.
          </h2>
          <p className="hero-tagline" style={{ margin: "0 auto 32px", maxWidth: 560 }}>
            See which KOLs pass all three proofs &mdash; and which ones fail.
          </p>
          <div className="hero-cta-row" style={{ justifyContent: "center" }}>
            <Link href="/leaderboard" className="cta-primary">
              View the Leaderboard <ArrowRight />
            </Link>
            <Link href="/submit" className="cta-secondary">
              Submit a KOL
            </Link>
          </div>
        </div>
      </section>

      <footer className="terminal-footer">
        <span><span className="status-dot" /> MemeRecall v3.0</span>
        <span>Verified Copy-Tradable Twitter Signals</span>
      </footer>
    </main>
  );
}

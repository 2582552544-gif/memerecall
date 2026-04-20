import Link from "next/link";
import { Nav } from "./components/nav";

function ShieldIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-1 2.83V12h2a3 3 0 0 1 0 6h-1v1a3 3 0 0 1-6 0v-1H9a3 3 0 0 1 0-6h2V9.83A4 4 0 0 1 8 6a4 4 0 0 1 4-4z" />
    </svg>
  );
}

function ChainIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="terminal-shell">
      <Nav />

      {/* ===== HERO ===== */}
      <section className="landing-hero">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-badge">Verified Signal Layer for Crypto Twitter</div>
          <h1 className="hero-title">
            Stop Following <span className="hero-highlight">Blind Signals</span>.
            <br />
            Start Following <span className="hero-highlight-green">Verified Callers</span>.
          </h1>
          <p className="hero-subtitle">
            MemeRecall discovers crypto KOLs, classifies their tweets with GPT,
            verifies claims against on-chain wallet data, and ranks them by
            <strong> actual copy-trade profitability</strong>.
          </p>
          <div className="hero-cta-row">
            <Link href="/leaderboard" className="cta-primary">
              View Leaderboard <ArrowRightIcon />
            </Link>
            <Link href="/submit" className="cta-secondary">
              Submit a KOL
            </Link>
          </div>
          <div className="hero-stats-row">
            <div className="hero-stat">
              <span className="hero-stat-num">200+</span>
              <span className="hero-stat-label">KOLs Scanned</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-num">4</span>
              <span className="hero-stat-label">Chains Covered</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-num">94%</span>
              <span className="hero-stat-label">Noise Filtered</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-num">~$2</span>
              <span className="hero-stat-label">Per Full Scan</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PROBLEM ===== */}
      <section className="landing-section">
        <div className="section-inner">
          <h2 className="section-title">The Problem with Crypto Twitter</h2>
          <p className="section-subtitle">
            94% of &ldquo;KOL&rdquo; wallets on GMGN are Silent Whales &mdash; profitable
            on-chain but they never tweet real signals. The other 6%? Most are
            shillers who tweet tokens they don&apos;t actually buy.
          </p>
          <div className="problem-grid">
            <div className="problem-card problem-card-red">
              <div className="problem-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
              <h3>Wallet Trackers</h3>
              <p>Nansen shows profitable wallets but can&apos;t tell you <em>who</em> they are or <em>what</em> they&apos;ll tweet next.</p>
            </div>
            <div className="problem-card problem-card-red">
              <div className="problem-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
              <h3>Sentiment Tools</h3>
              <p>LunarCrush measures buzz but can&apos;t verify if the tweeter actually <em>traded</em> the token.</p>
            </div>
            <div className="problem-card problem-card-green">
              <div className="problem-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
              <h3>MemeRecall</h3>
              <p>The <strong>AND intersection</strong>: tweets signals + wallet matches + followers profit. Evidence-backed, not vibes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS (Pipeline) ===== */}
      <section className="landing-section landing-section-dark">
        <div className="section-inner">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            A 4-tier funnel that transforms 800 raw wallets into a verified leaderboard of ~12 signal callers.
          </p>
          <div className="pipeline-steps">
            <div className="pipeline-step">
              <div className="step-number">01</div>
              <div className="step-icon step-icon-cyan"><ChainIcon /></div>
              <h3>Discovery</h3>
              <p>Scan GMGN KOL-tagged wallets across SOL, ETH, BSC, and Base. 200 wallets per chain, deduplicated by Twitter handle.</p>
              <div className="step-data">800 wallets in</div>
            </div>
            <div className="pipeline-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
            </div>
            <div className="pipeline-step">
              <div className="step-number">02</div>
              <div className="step-icon step-icon-green"><ShieldIcon /></div>
              <h3>Prefilter</h3>
              <p>5 rule-based gates (zero GPT cost). Check signal frequency, bot score, wallet existence, chain coverage, activity level.</p>
              <div className="step-data">94% rejected &mdash; $0 cost</div>
            </div>
            <div className="pipeline-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
            </div>
            <div className="pipeline-step">
              <div className="step-number">03</div>
              <div className="step-icon step-icon-purple"><BrainIcon /></div>
              <h3>GPT Analysis</h3>
              <p>Classify 100 tweets per KOL (S0-S4 intent levels). Match signals to on-chain wallet trades. Build evidence chains.</p>
              <div className="step-data">~$0.15/KOL &bull; 4-dim scoring</div>
            </div>
            <div className="pipeline-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
            </div>
            <div className="pipeline-step">
              <div className="step-number">04</div>
              <div className="step-icon step-icon-amber"><TrophyIcon /></div>
              <h3>Leaderboard</h3>
              <p>RankScore formula weights authenticity, alpha, coverage, and discipline. Assigns action tiers: Auto Copy, Watchlist, Avoid.</p>
              <div className="step-data">~12 verified callers</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRIPLE FILTER ===== */}
      <section className="landing-section">
        <div className="section-inner">
          <h2 className="section-title">The Triple Filter</h2>
          <p className="section-subtitle">
            Only KOLs who pass all three checks make the cut.
            Each filter eliminates a different type of noise.
          </p>
          <div className="filter-grid">
            <div className="filter-card">
              <div className="filter-icon filter-icon-cyan"><BrainIcon /></div>
              <h3>Signal Detection</h3>
              <p>GPT classifies every tweet into 5 intent levels. Only S3 (Claimed Buy) and S4 (Claimed Exit) trigger verification.</p>
              <div className="filter-example">
                <code>&quot;Just aped into $BONK&quot;</code>
                <span className="filter-tag filter-tag-green">S3: Claimed Buy</span>
              </div>
            </div>
            <div className="filter-card">
              <div className="filter-icon filter-icon-green"><WalletIcon /></div>
              <h3>Wallet Verification</h3>
              <p>Cross-reference the claim against on-chain wallet activity. Did they actually buy? When? How much?</p>
              <div className="filter-example">
                <code>Tweet 14:00 &rarr; Wallet buy 14:03</code>
                <span className="filter-tag filter-tag-green">Verified</span>
              </div>
            </div>
            <div className="filter-card">
              <div className="filter-icon filter-icon-amber"><TrophyIcon /></div>
              <h3>Profit Validation</h3>
              <p>Simulate copy-trading every verified signal. Calculate median ROI, win rate, and net PnL.</p>
              <div className="filter-example">
                <code>Median ROI +23%, Win Rate 65%</code>
                <span className="filter-tag filter-tag-green">Profitable</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ACTION TIERS ===== */}
      <section className="landing-section landing-section-dark">
        <div className="section-inner">
          <h2 className="section-title">Action Tiers</h2>
          <p className="section-subtitle">
            Every KOL gets a clear, actionable verdict based on their evidence profile.
          </p>
          <div className="tiers-grid">
            <div className="tier-card tier-auto-copy">
              <div className="tier-label">AUTO COPY</div>
              <div className="tier-condition">Composite &ge; 75 &amp; Auth &ge; 60</div>
              <p>Safe to auto-copy trade. High authenticity, proven alpha, clean record.</p>
            </div>
            <div className="tier-card tier-watchlist">
              <div className="tier-label">WATCHLIST</div>
              <div className="tier-condition">Composite 50-75</div>
              <p>Manual confirmation recommended. Good potential, needs more data.</p>
            </div>
            <div className="tier-card tier-narrative">
              <div className="tier-label">NARRATIVE ONLY</div>
              <div className="tier-condition">Low composite, adequate coverage</div>
              <p>Read for market narratives. Don&apos;t copy-trade blindly.</p>
            </div>
            <div className="tier-card tier-avoid">
              <div className="tier-label">AVOID</div>
              <div className="tier-condition">Quick flip + Auth &lt; 30</div>
              <p>Suspected pump-and-dump. Sells shortly after promoting.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="landing-section landing-cta-section">
        <div className="section-inner" style={{ textAlign: "center" }}>
          <h2 className="section-title">Ready to See Who&apos;s Real?</h2>
          <p className="section-subtitle" style={{ maxWidth: 500, margin: "0 auto 32px" }}>
            Check the live leaderboard. Every score backed by evidence.
            Every claim verified on-chain.
          </p>
          <div className="hero-cta-row" style={{ justifyContent: "center" }}>
            <Link href="/leaderboard" className="cta-primary">
              View Leaderboard <ArrowRightIcon />
            </Link>
            <Link href="/submit" className="cta-secondary">
              Submit a KOL
            </Link>
          </div>
        </div>
      </section>

      <footer className="terminal-footer">
        <span><span className="status-dot" /> MemeRecall v3.0</span>
        <span>GPT Signal Classifier + GMGN Multi-Chain + On-Chain Evidence</span>
      </footer>
    </main>
  );
}

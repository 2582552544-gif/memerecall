"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Nav } from "../components/nav";

const API = process.env.NEXT_PUBLIC_MEMERECALL_API || "http://localhost:4049";

function SubmitForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [handle, setHandle] = useState(searchParams.get("handle") || "");
  const [walletAddress, setWalletAddress] = useState("");
  const [chain, setChain] = useState("sol");
  const [status, setStatus] = useState<"idle" | "looking-up" | "analyzing" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [lookupResult, setLookupResult] = useState<string>("");

  // Auto-lookup wallet when handle loses focus
  async function handleLookup() {
    const cleanHandle = handle.replace(/^@/, "").trim();
    if (!cleanHandle || walletAddress.trim()) return;

    setStatus("looking-up");
    setLookupResult("");
    try {
      const res = await fetch(`${API}/lookup/${encodeURIComponent(cleanHandle)}?chain=${chain}`);
      if (res.ok) {
        const data = await res.json();
        setWalletAddress(data.walletAddress);
        setLookupResult(`Found: ${data.name} (${data.walletAddress.slice(0, 6)}...${data.walletAddress.slice(-4)})`);
      } else {
        setLookupResult("Not found on GMGN — enter wallet address manually");
      }
    } catch {
      setLookupResult("Lookup failed — enter wallet address manually");
    }
    setStatus("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanHandle = handle.replace(/^@/, "").trim();
    if (!cleanHandle) return;

    setStatus("analyzing");
    setErrorMsg("");

    try {
      const res = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: cleanHandle,
          walletAddress: walletAddress.trim() || undefined,
          chain,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      router.push(`/analysis/${cleanHandle}`);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  const isLoading = status === "looking-up" || status === "analyzing";

  return (
    <main className="terminal-shell">
      <Nav />

      <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 20px" }}>
        <h2 style={{ marginBottom: 8 }}>Analyze a KOL</h2>
        <p className="muted" style={{ marginBottom: 24 }}>
          Enter a Twitter handle to run the full analysis pipeline.
          Wallet address will be auto-detected from GMGN, or you can enter it manually.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#999" }}>
              Twitter Handle
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onBlur={handleLookup}
              placeholder="e.g. thejester"
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#1a1a2e",
                border: "1px solid #333",
                borderRadius: 6,
                color: "#e0e0e0",
                fontSize: 15,
              }}
            />
            {status === "looking-up" && (
              <small style={{ color: "#7ee6a1", marginTop: 4, display: "block" }}>
                Searching GMGN for wallet...
              </small>
            )}
            {lookupResult && status !== "looking-up" && (
              <small style={{ color: lookupResult.startsWith("Found") ? "#7ee6a1" : "#f5c542", marginTop: 4, display: "block" }}>
                {lookupResult}
              </small>
            )}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#999" }}>
              Wallet Address <span style={{ color: "#666" }}>(optional — auto-detected from GMGN)</span>
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Leave empty to auto-detect, or paste address"
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#1a1a2e",
                border: "1px solid #333",
                borderRadius: 6,
                color: "#e0e0e0",
                fontSize: 15,
                fontFamily: "monospace",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#999" }}>
              Chain
            </label>
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#1a1a2e",
                border: "1px solid #333",
                borderRadius: 6,
                color: "#e0e0e0",
                fontSize: 15,
              }}
            >
              <option value="sol">Solana (SOL)</option>
              <option value="eth">Ethereum (ETH)</option>
              <option value="bsc">BSC</option>
              <option value="base">Base</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: "12px 24px",
              background: isLoading ? "#555" : "#7ee6a1",
              color: "#000",
              border: "none",
              borderRadius: 6,
              fontSize: 15,
              fontWeight: 600,
              cursor: isLoading ? "wait" : "pointer",
              marginTop: 8,
            }}
          >
            {status === "analyzing" ? "Analyzing... (this may take 1-2 minutes)" : "Start Analysis"}
          </button>

          {status === "error" && (
            <div style={{ padding: 12, background: "#2a1a1a", border: "1px solid #ff6687", borderRadius: 6, color: "#ff6687", fontSize: 13 }}>
              {errorMsg}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}

export default function SubmitPage() {
  return (
    <Suspense>
      <SubmitForm />
    </Suspense>
  );
}

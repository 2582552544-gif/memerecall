export interface WalletBinding {
  address: string;
  chain: string;
  label?: string;
  confirmation: "confirmed" | "suggested";
}

export interface AgentSubject {
  handle: string;
  wallets: WalletBinding[];
  label: string;
  /** @deprecated Use wallets[0].address */
  walletAddress: string;
  /** @deprecated Use wallets[0].chain */
  chain: string;
}

function buildSubject(
  handle: string,
  wallets: WalletBinding[],
  label: string,
): AgentSubject {
  return {
    handle,
    wallets,
    label,
    walletAddress: wallets[0]?.address ?? "",
    chain: wallets[0]?.chain ?? "sol",
  };
}

export const trackedSubjects: AgentSubject[] = [
  buildSubject(
    "0xWilliam888",
    [
      {
        address: "5Lc1H18PT9NDCqeh9pnhkwm6xyWw1X4btzRcTcVP2ZNk",
        chain: "sol",
        label: "主 SOL 钱包",
        confirmation: "confirmed",
      },
    ],
    "小姐Will🔶BNB 🦞",
  ),
];

export function findSubjectByHandle(handle: string): AgentSubject | null {
  const normalized = handle.replace(/^@/, "").toLowerCase();
  return (
    trackedSubjects.find((item) => item.handle.replace(/^@/, "").toLowerCase() === normalized) ||
    null
  );
}

export type MemeRecallAgentName =
  | "kol_analysis"
  | "social_investment"
  | "timeline"
  | "token_watch";

export interface HermesDispatchRequest {
  agent: MemeRecallAgentName;
  handle?: string;
  chain?: string;
  walletAddress?: string;
  dryRun?: boolean;
  forceNotify?: boolean;
}

export interface HermesDispatchResponse {
  ok: boolean;
  agent: MemeRecallAgentName;
  generatedAt: string;
  input: HermesDispatchRequest;
  result: unknown;
}

import { findSubjectByHandle } from "../agent-catalog";
import type {
  HermesDispatchRequest,
  HermesDispatchResponse,
  MemeRecallAgentName,
} from "../hermes-dispatch-types";
import { analyzeKolByWallet } from "./kol-analysis-agent";
import { analyzeSocialInvestmentByKol } from "./social-investment-agent";
import { buildTimelineAnalysis } from "./timeline-judge-agent";
import { runTokenWatchCycle } from "./token-watch-agent";

function resolveSubject(input: HermesDispatchRequest): {
  handle: string;
  walletAddress: string;
  chain: string;
} {
  if (input.handle) {
    const subject = findSubjectByHandle(input.handle);
    if (subject) {
      return {
        handle: subject.handle,
        walletAddress: subject.walletAddress,
        chain: subject.chain,
      };
    }
  }

  if (input.walletAddress) {
    return {
      handle: input.handle || input.walletAddress,
      walletAddress: input.walletAddress,
      chain: input.chain || "sol",
    };
  }

  throw new Error(`Tracked subject not found: ${input.handle || "missing handle"}`);
}

export function listHermesDispatchAgents(): Array<{
  name: MemeRecallAgentName;
  description: string;
  requiredInput: string[];
}> {
  return [
    {
      name: "kol_analysis",
      description: "Analyze a KOL wallet's GMGN profile, holdings, PnL, trading style, and risk.",
      requiredInput: ["handle or walletAddress"],
    },
    {
      name: "social_investment",
      description: "Judge whether a KOL's Twitter/X token calls are investable by comparing tweet signals with wallet activity.",
      requiredInput: ["handle or walletAddress"],
    },
    {
      name: "timeline",
      description: "Build a raw timeline report from Twitter/X signals, GMGN wallet activity, and holdings results.",
      requiredInput: ["handle or walletAddress"],
    },
    {
      name: "token_watch",
      description: "Run the selected-token price monitor and send Telegram notifications when threshold rules trigger.",
      requiredInput: [],
    },
  ];
}

export async function dispatchMemeRecallAgent(
  input: HermesDispatchRequest,
): Promise<HermesDispatchResponse> {
  let result: unknown;

  if (input.agent === "kol_analysis") {
    const subject = resolveSubject(input);
    result = await analyzeKolByWallet(subject.walletAddress, subject.chain);
  } else if (input.agent === "social_investment") {
    const subject = resolveSubject(input);
    result = await analyzeSocialInvestmentByKol(
      subject.handle,
      subject.walletAddress,
      subject.chain,
    );
  } else if (input.agent === "timeline") {
    const subject = resolveSubject(input);
    result = await buildTimelineAnalysis(
      subject.handle,
      subject.walletAddress,
      subject.chain,
    );
  } else if (input.agent === "token_watch") {
    result = await runTokenWatchCycle({
      dryRun: input.dryRun,
      forceNotify: input.forceNotify,
    });
  } else {
    throw new Error(`Unsupported MemeRecall agent: ${(input as { agent: string }).agent}`);
  }

  return {
    ok: true,
    agent: input.agent,
    generatedAt: new Date().toISOString(),
    input,
    result,
  };
}

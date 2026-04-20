/**
 * GPT-driven Narrative Agent
 *
 * Generates 3 top insights + thesis in Chinese based on structured analysis data.
 */

import type { KOLScores, RedFlag, SignalStats, ChainCoverage } from "../kol-report-types";
import { getLLMClient, getLLMModel } from "../llm-client";

interface NarrativeInput {
  handle: string;
  scores: KOLScores;
  redFlags: RedFlag[];
  signalStats: SignalStats;
  chainCoverage: ChainCoverage;
  matchedCount: number;
  claimNoTradeCount: number;
  walletOnlyCount: number;
  topTradesSummary: string;
}

export interface NarrativeOutput {
  insights: [string, string, string];
  thesis: string;
}

export async function generateNarrative(
  input: NarrativeInput,
): Promise<NarrativeOutput> {
  const client = getLLMClient();
  const model = getLLMModel();

  const prompt = `你是加密 KOL 分析师。基于以下结构化数据，生成中文分析报告。

## 数据
- KOL: @${input.handle}
- 综合评分: ${input.scores.composite}/100
- 真实性: ${input.scores.authenticity}/100
- 跟单Alpha: ${input.scores.followerAlpha === null ? "数据不足" : input.scores.followerAlpha}
- 链覆盖: ${input.scores.coverage}/100
- 风控纪律: ${input.scores.discipline}/100
- 红旗: ${input.redFlags.join(", ") || "无"}
- 信号分布: S0=${input.signalStats.s0} S1=${input.signalStats.s1} S2=${input.signalStats.s2} S3=${input.signalStats.s3} S4=${input.signalStats.s4}
- 链覆盖: 信号链 ${JSON.stringify(input.chainCoverage.signalChains)}, 钱包链 ${JSON.stringify(input.chainCoverage.walletChains)}, 缺失 ${input.chainCoverage.missingChains.join(",")}
- 匹配成功: ${input.matchedCount}, 喊单未买: ${input.claimNoTradeCount}, 钱包独立交易: ${input.walletOnlyCount}
- 关键交易: ${input.topTradesSummary}

## 输出要求
返回 JSON（不要 markdown 代码块）：
{
  "insights": ["洞察1 (30-50字)", "洞察2", "洞察3"],
  "thesis": "100-200字总结，专业直接，提供可执行建议。数据覆盖不完整时必须说明是覆盖缺口，不是欺诈证明。"
}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned) as { insights: string[]; thesis: string };

    return {
      insights: [
        parsed.insights[0] || "数据分析中",
        parsed.insights[1] || "需要更多数据",
        parsed.insights[2] || "建议补充钱包映射",
      ],
      thesis: parsed.thesis || "分析数据不足，建议补充更多钱包映射后重新评估。",
    };
  } catch (error) {
    console.error("[narrative-agent] LLM call failed, using fallback:", error);
    return {
      insights: [
        `综合评分 ${input.scores.composite}/100，真实性 ${input.scores.authenticity}/100`,
        `${input.redFlags.length} 个红旗：${input.redFlags.slice(0, 3).join("、")}`,
        `链覆盖缺失：${input.chainCoverage.missingChains.join("、") || "无"}`,
      ],
      thesis: `@${input.handle} 当前评分 ${input.scores.composite}/100。${
        input.redFlags.includes("CHAIN_MISMATCH")
          ? "推文信号链与钱包链不匹配，需补充对应链钱包后重评。"
          : "综合分析完成，请参考四维评分和红旗标记做出决策。"
      }`,
    };
  }
}

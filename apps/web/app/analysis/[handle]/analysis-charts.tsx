"use client";

import ReactECharts from "echarts-for-react";

interface ProfitPoint {
  symbol: string;
  profitUsd: number;
}

interface SignalPoint {
  label: string;
  value: number;
}

interface AnalysisChartsProps {
  profitPoints: ProfitPoint[];
  signalPoints: SignalPoint[];
}

const textStyle = {
  color: "#a3abb3",
  fontFamily: "SF Pro Display, SF Pro Text, sans-serif",
};

export function ProfitBars({ profitPoints }: Pick<AnalysisChartsProps, "profitPoints">) {
  const option = {
    animationDuration: 700,
    grid: { left: 10, right: 10, top: 20, bottom: 30, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#101114",
      borderColor: "#262a31",
      textStyle,
    },
    xAxis: {
      type: "category",
      data: profitPoints.map((item) => item.symbol),
      axisLine: { lineStyle: { color: "#262a31" } },
      axisLabel: { color: "#7f878f", interval: 0, rotate: 30 },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(255,255,255,.06)" } },
      axisLabel: { color: "#7f878f" },
    },
    series: [
      {
        type: "bar",
        data: profitPoints.map((item) => ({
          value: item.profitUsd,
          itemStyle: {
            color: item.profitUsd >= 0 ? "#7ee6a1" : "#ff6687",
            borderRadius: [6, 6, 2, 2],
          },
        })),
        barWidth: 16,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}

export function SignalRadar({ signalPoints }: Pick<AnalysisChartsProps, "signalPoints">) {
  const max = Math.max(100, ...signalPoints.map((item) => item.value));
  const option = {
    animationDuration: 700,
    tooltip: {
      backgroundColor: "#101114",
      borderColor: "#262a31",
      textStyle,
    },
    radar: {
      radius: "68%",
      splitNumber: 4,
      indicator: signalPoints.map((item) => ({ name: item.label, max })),
      axisName: { color: "#a3abb3", fontSize: 11 },
      splitLine: { lineStyle: { color: "rgba(255,255,255,.08)" } },
      splitArea: {
        areaStyle: {
          color: ["rgba(126,230,161,.03)", "rgba(22,234,217,.04)"],
        },
      },
      axisLine: { lineStyle: { color: "rgba(255,255,255,.1)" } },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: signalPoints.map((item) => item.value),
            name: "Signal Quality",
            symbol: "circle",
            symbolSize: 5,
            lineStyle: { color: "#7ee6a1", width: 2 },
            itemStyle: { color: "#16ead9" },
            areaStyle: { color: "rgba(126,230,161,.18)" },
          },
        ],
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 250, width: "100%" }} />;
}

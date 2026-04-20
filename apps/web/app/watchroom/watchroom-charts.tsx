"use client";

import ReactECharts from "echarts-for-react";

type ChartPoint = {
  time: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volumeUsd: number;
};

function toDateMs(value: number): number {
  return value > 10_000_000_000 ? value : value * 1000;
}

function formatChartTime(value: number): string {
  return new Date(toDateMs(value)).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MiniSparkline({
  points,
}: {
  points: ChartPoint[];
}) {
  const series = points.map((point) => point.close);
  const positive = series.length > 1 ? series[series.length - 1] >= series[0] : true;
  const option = {
    animation: false,
    grid: { left: 0, right: 0, top: 6, bottom: 6 },
    xAxis: { type: "category", show: false, data: points.map((point) => point.time) },
    yAxis: { type: "value", show: false, scale: true },
    series: [
      {
        type: "line",
        data: series,
        smooth: true,
        symbol: "none",
        lineStyle: {
          width: 2,
          color: positive ? "#7ee6a1" : "#ff6687",
        },
        areaStyle: {
          color: positive ? "rgba(126,230,161,.12)" : "rgba(255,102,135,.1)",
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 54, width: 160 }} />;
}

export function TokenDetailChart({
  points,
  symbol,
}: {
  points: ChartPoint[];
  symbol: string;
}) {
  const labels = points.map((point) => formatChartTime(point.time));
  const prices = points.map((point) => point.close);
  const volumes = points.map((point) => point.volumeUsd);
  const positive = prices.length > 1 ? prices[prices.length - 1] >= prices[0] : true;

  const option = {
    animationDuration: 500,
    grid: [
      { left: 14, right: 12, top: 18, height: "58%" },
      { left: 14, right: 12, top: "78%", height: "14%" },
    ],
    tooltip: {
      trigger: "axis",
      backgroundColor: "#101114",
      borderColor: "#262a31",
      textStyle: { color: "#a3abb3" },
    },
    xAxis: [
      {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: "#262a31" } },
        axisLabel: { color: "#7f878f" },
        axisTick: { show: false },
      },
      {
        gridIndex: 1,
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: "#262a31" } },
        axisLabel: { show: false },
        axisTick: { show: false },
      },
    ],
    yAxis: [
      {
        type: "value",
        scale: true,
        splitLine: { lineStyle: { color: "rgba(255,255,255,.06)" } },
        axisLabel: { color: "#7f878f" },
      },
      {
        gridIndex: 1,
        type: "value",
        splitLine: { show: false },
        axisLabel: { show: false },
      },
    ],
    series: [
      {
        name: `${symbol} Price`,
        type: "line",
        smooth: true,
        symbol: "none",
        data: prices,
        lineStyle: {
          width: 2.5,
          color: positive ? "#7ee6a1" : "#ff6687",
        },
        areaStyle: {
          color: positive ? "rgba(126,230,161,.14)" : "rgba(255,102,135,.12)",
        },
      },
      {
        name: "Volume",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
        itemStyle: {
          color: "rgba(22,234,217,.45)",
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 300, width: "100%" }} />;
}

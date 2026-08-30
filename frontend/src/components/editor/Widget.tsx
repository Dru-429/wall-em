// Live canvas widgets that reflect the current year's progress and tick
// forward on their own while the editor is open. Two styles:
//  - "progress": a labelled year progress bar
//  - "dotmatrix": a dot grid where elapsed days are bright, remaining dimmed

import React, { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";

type Props = {
  variant: "progress" | "dotmatrix";
  tint?: string;
};

function yearProgress() {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const total = end - start;
  const elapsed = now.getTime() - start;
  const daysInYear = Math.round(total / 86400000);
  const dayOfYear = Math.min(daysInYear, Math.floor(elapsed / 86400000) + 1);
  return {
    year,
    fraction: Math.min(1, Math.max(0, elapsed / total)),
    daysInYear,
    dayOfYear,
  };
}

export function Widget({ variant, tint = "#ffffff" }: Props) {
  const [, setTick] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Re-render every 30s so the widget stays live.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const info = yearProgress();

  if (variant === "progress") {
    const pct = Math.round(info.fraction * 100);
    const label = Math.max(11, Math.min(size.h * 0.22, 20));
    const barH = Math.max(8, size.h * 0.28);
    return (
      <View style={styles.fill} onLayout={onLayout}>
        <View style={styles.rowBetween}>
          <Text style={[styles.wText, { color: tint, fontSize: label }]}>
            {info.year}
          </Text>
          <Text style={[styles.wText, { color: tint, fontSize: label }]}>
            {pct}%
          </Text>
        </View>
        <View
          style={[
            styles.track,
            { height: barH, backgroundColor: withAlpha(tint, 0.25) },
          ]}
        >
          <View
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: barH / 2,
              backgroundColor: tint,
            }}
          />
        </View>
        <Text
          style={[styles.sub, { color: withAlpha(tint, 0.7), fontSize: label * 0.7 }]}
        >
          {info.dayOfYear} / {info.daysInYear} days
        </Text>
      </View>
    );
  }

  // dot matrix
  return (
    <DotMatrix
      onLayout={onLayout}
      size={size}
      total={info.daysInYear}
      filled={info.dayOfYear}
      tint={tint}
    />
  );
}

function DotMatrix({
  onLayout,
  size,
  total,
  filled,
  tint,
}: {
  onLayout: (e: LayoutChangeEvent) => void;
  size: { w: number; h: number };
  total: number;
  filled: number;
  tint: string;
}) {
  const dots = useMemo(() => {
    if (size.w < 2 || size.h < 2) return { list: [], dot: 0, gap: 0 };
    const area = size.w * size.h;
    const cell = Math.sqrt(area / total);
    const dot = Math.max(2, cell * 0.62);
    const gap = Math.max(1, cell * 0.38);
    return { list: Array.from({ length: total }), dot, gap };
  }, [size.w, size.h, total]);

  return (
    <View style={[styles.fill, styles.center]} onLayout={onLayout}>
      <View style={styles.matrix}>
        {dots.list.map((_, i) => (
          <View
            key={i}
            style={{
              width: dots.dot,
              height: dots.dot,
              margin: dots.gap / 2,
              borderRadius: dots.dot / 2,
              backgroundColor: i < filled ? tint : withAlpha(tint, 0.28),
            }}
          />
        ))}
      </View>
    </View>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  fill: { width: "100%", height: "100%", justifyContent: "center" },
  center: { alignItems: "center" },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 6,
  },
  wText: { fontWeight: "800", letterSpacing: -0.3 },
  track: { width: "100%", borderRadius: 999, overflow: "hidden" },
  sub: { marginTop: 6, fontWeight: "600" },
  matrix: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
});

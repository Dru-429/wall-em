// A single draggable / pinchable / rotatable layer on the editor canvas.
// Uncontrolled after mount: internal shared values drive the display and we
// persist on gesture end. Remounted (via `key`) when arrange re-flows layout.

import React from "react";
import { StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
// scheduleOnRN is the reanimated-4 replacement for runOnJS.
import { scheduleOnRN } from "react-native-worklets";

import { CanvasItem } from "@/src/store/buckets";
import { colors } from "@/src/theme";

type Props = {
  item: CanvasItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<CanvasItem>) => void;
};

function CanvasLayer({ item, selected, onSelect, onChange }: Props) {
  const posX = useSharedValue(item.x);
  const posY = useSharedValue(item.y);
  const w = useSharedValue(item.width);
  const h = useSharedValue(item.height);
  const rot = useSharedValue(item.rotation || 0);

  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const sw = useSharedValue(0);
  const sh = useSharedValue(0);
  const sr = useSharedValue(0);

  const commit = () => {
    onChange(item.id, {
      x: posX.value,
      y: posY.value,
      width: w.value,
      height: h.value,
      rotation: rot.value,
    });
  };

  const tap = Gesture.Tap().onEnd(() => {
    "worklet";
    scheduleOnRN(onSelect, item.id);
  });

  const pan = Gesture.Pan()
    .onStart(() => {
      sx.value = posX.value;
      sy.value = posY.value;
      scheduleOnRN(onSelect, item.id);
    })
    .onUpdate((e) => {
      posX.value = sx.value + e.translationX;
      posY.value = sy.value + e.translationY;
    })
    .onEnd(() => {
      scheduleOnRN(commit);
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      sw.value = w.value;
      sh.value = h.value;
    })
    .onUpdate((e) => {
      const s = Math.max(0.15, e.scale);
      w.value = sw.value * s;
      h.value = sh.value * s;
    })
    .onEnd(() => {
      scheduleOnRN(commit);
    });

  const rotate = Gesture.Rotation()
    .onStart(() => {
      sr.value = rot.value;
    })
    .onUpdate((e) => {
      rot.value = sr.value + e.rotation;
    })
    .onEnd(() => {
      scheduleOnRN(commit);
    });

  const composed = Gesture.Simultaneous(tap, pan, pinch, rotate);

  const animStyle = useAnimatedStyle(() => ({
    width: w.value,
    height: h.value,
    transform: [
      { translateX: posX.value },
      { translateY: posY.value },
      { rotateZ: `${rot.value}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          styles.layer,
          animStyle,
          selected && styles.selected,
        ]}
        testID={`canvas-item-${item.id}`}
      >
        {item.kind === "image" ? (
          <Image
            source={{ uri: item.uri }}
            style={styles.fill}
            contentFit="fill"
            transition={0}
          />
        ) : (
          <Text
            style={[
              styles.text,
              { color: item.color || "#fff", fontSize: item.fontSize || 28 },
            ]}
            numberOfLines={4}
          >
            {item.text}
          </Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  },
  fill: { width: "100%", height: "100%" },
  selected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  text: {
    fontWeight: "800",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

export default React.memo(CanvasLayer);

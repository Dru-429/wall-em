// A single draggable / resizable / rotatable layer on the editor canvas.
// Uncontrolled after mount: internal shared values drive the display and we
// persist on gesture end. Remounted (via `key`) when arrange re-flows layout.
// When selected, Canva-style corner handles allow single-finger resizing.

import React, { useRef } from "react";
import { StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { CanvasItem } from "@/src/store/buckets";
import { colors } from "@/src/theme";
import { Widget } from "@/src/components/editor/Widget";

type Props = {
  item: CanvasItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<CanvasItem>) => void;
};

const MIN_SIZE = 32;

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

  const bodyRef = useRef(undefined);

  const commit = () => {
    const patch: Partial<CanvasItem> = {
      x: posX.value,
      y: posY.value,
      width: w.value,
      height: h.value,
      rotation: rot.value,
    };
    if (item.kind === "text" && item.width > 0) {
      patch.fontSize = Math.max(
        8,
        (item.fontSize || 28) * (w.value / item.width),
      );
    }
    onChange(item.id, patch);
  };

  const tap = Gesture.Tap().onEnd(() => {
    "worklet";
    scheduleOnRN(onSelect, item.id);
  });

  const pan = Gesture.Pan()
    .withRef(bodyRef)
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
      w.value = Math.max(MIN_SIZE, sw.value * s);
      h.value = Math.max(MIN_SIZE, sh.value * s);
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
        style={[styles.layer, animStyle, selected && styles.selected]}
        testID={`canvas-item-${item.id}`}
      >
        {item.kind === "image" ? (
          <Image
            source={{ uri: item.uri }}
            style={styles.fill}
            contentFit="fill"
            transition={0}
          />
        ) : item.kind === "widget" ? (
          <Widget variant={item.widget || "progress"} tint={item.color || "#ffffff"} />
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

        {selected && (
          <>
            <ResizeHandle
              signX={-1}
              signY={-1}
              style={styles.hTL}
              tid={`handle-tl-${item.id}`}
              {...{ posX, posY, w, h, rot, sw, sh, sx, sy, bodyRef, commit, itemId: item.id, onSelect }}
            />
            <ResizeHandle
              signX={1}
              signY={-1}
              style={styles.hTR}
              tid={`handle-tr-${item.id}`}
              {...{ posX, posY, w, h, rot, sw, sh, sx, sy, bodyRef, commit, itemId: item.id, onSelect }}
            />
            <ResizeHandle
              signX={-1}
              signY={1}
              style={styles.hBL}
              tid={`handle-bl-${item.id}`}
              {...{ posX, posY, w, h, rot, sw, sh, sx, sy, bodyRef, commit, itemId: item.id, onSelect }}
            />
            <ResizeHandle
              signX={1}
              signY={1}
              style={styles.hBR}
              tid={`handle-br-${item.id}`}
              {...{ posX, posY, w, h, rot, sw, sh, sx, sy, bodyRef, commit, itemId: item.id, onSelect }}
            />
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

type HandleProps = {
  signX: number;
  signY: number;
  style: object;
  tid: string;
  posX: SharedValue<number>;
  posY: SharedValue<number>;
  w: SharedValue<number>;
  h: SharedValue<number>;
  rot: SharedValue<number>;
  sw: SharedValue<number>;
  sh: SharedValue<number>;
  sx: SharedValue<number>;
  sy: SharedValue<number>;
  bodyRef: React.MutableRefObject<unknown>;
  commit: () => void;
  itemId: string;
  onSelect: (id: string) => void;
};

// Corner handle: uniform scale around the item's center. Projects the drag
// onto the corner's radial direction (accounting for rotation) so resizing
// feels natural even when the layer is rotated.
function ResizeHandle({
  signX,
  signY,
  style,
  tid,
  posX,
  posY,
  w,
  h,
  rot,
  sw,
  sh,
  sx,
  sy,
  bodyRef,
  commit,
  itemId,
  onSelect,
}: HandleProps) {
  const cx = useSharedValue(0);
  const cy = useSharedValue(0);
  const diag = useSharedValue(1);
  const ux = useSharedValue(0);
  const uy = useSharedValue(0);

  const gesture = Gesture.Pan()
    .blocksExternalGesture(bodyRef)
    .onStart(() => {
      scheduleOnRN(onSelect, itemId);
      sw.value = w.value;
      sh.value = h.value;
      cx.value = posX.value + w.value / 2;
      cy.value = posY.value + h.value / 2;
      const lx = (signX * w.value) / 2;
      const ly = (signY * h.value) / 2;
      const d = Math.hypot(lx, ly) || 1;
      diag.value = d;
      const c = Math.cos(rot.value);
      const s = Math.sin(rot.value);
      ux.value = (lx * c - ly * s) / d;
      uy.value = (lx * s + ly * c) / d;
    })
    .onUpdate((e) => {
      const proj = e.translationX * ux.value + e.translationY * uy.value;
      let scale = (diag.value + proj) / diag.value;
      if (scale < 0.2) scale = 0.2;
      const nw = Math.max(MIN_SIZE, sw.value * scale);
      const nh = Math.max(MIN_SIZE, sh.value * scale);
      w.value = nw;
      h.value = nh;
      posX.value = cx.value - nw / 2;
      posY.value = cy.value - nh / 2;
    })
    .onEnd(() => {
      scheduleOnRN(commit);
    });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.handle, style]} hitSlop={12} testID={tid} />
    </GestureDetector>
  );
}

const HANDLE = 16;
const OFF = -HANDLE / 2;

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    top: 0,
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
  handle: {
    position: "absolute",
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: colors.canvas,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  hTL: { left: OFF, top: OFF },
  hTR: { right: OFF, top: OFF },
  hBL: { left: OFF, bottom: OFF },
  hBR: { right: OFF, bottom: OFF },
});

export default React.memo(CanvasLayer);

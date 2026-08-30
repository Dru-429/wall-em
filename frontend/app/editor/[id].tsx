import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as MediaLibrary from "expo-media-library";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { scheduleOnRN } from "react-native-worklets";

import { BottomSheet } from "@/src/components/BottomSheet";
import CanvasItemView from "@/src/components/editor/CanvasItem";
import { Widget } from "@/src/components/editor/Widget";
import { useToast } from "@/src/components/Toast";
import { Align, mosaicAligned, mosaicFullBleed } from "@/src/lib/mosaic";
import {
  Bucket,
  CanvasItem,
  getBucket,
  ImageAsset,
  saveLayout,
  uid,
} from "@/src/store/buckets";
import {
  CANVAS_BACKGROUNDS,
  colors,
  radius,
  spacing,
  TEXT_COLORS,
  type,
} from "@/src/theme";

const PHONE_RATIO = 1080 / 2340; // ~0.4615

const EMOJIS = [
  "🔥", "⭐", "✨", "💥", "❤️", "🧡", "💛", "💚", "💙", "💜",
  "🖤", "🤍", "😎", "🥹", "🤯", "😤", "💀", "👀", "🙌", "💪",
  "🚀", "🎯", "🏆", "💎", "⚡", "🌙", "☀️", "🌈", "🍀", "🌸",
  "🎵", "📈", "💰", "🧠", "👑", "✅", "❌", "➡️", "⬆️", "♾️",
];

export default function Editor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const canvasRef = useRef<View>(null);
  const win = useWindowDimensions();
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [bg, setBg] = useState<string>("#000000");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);

  const [bgOpen, setBgOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftColor, setDraftColor] = useState(TEXT_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Canvas dimensions: a phone-shaped frame that fits the available space.
  const { canvasW, canvasH } = useMemo(() => {
    const availH =
      win.height - insets.top - insets.bottom - 56 - 132 - spacing.lg * 2;
    const availW = win.width - spacing.xl * 2;
    let h = availH;
    let w = h * PHONE_RATIO;
    if (w > availW) {
      w = availW;
      h = w / PHONE_RATIO;
    }
    return { canvasW: w, canvasH: h };
  }, [win.width, win.height, insets.top, insets.bottom]);

  const reflow = () => setVersion((v) => v + 1);

  const arrange = (mode: "mosaic" | Align) => {
    if (!bucket) return;
    const boxes =
      mode === "mosaic"
        ? mosaicFullBleed(bucket.images, canvasW, canvasH)
        : mosaicAligned(bucket.images, canvasW, canvasH, mode);
    const imageItems: CanvasItem[] = boxes.map((b, i) => ({
      id: b.id,
      kind: "image",
      uri: b.uri,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      rotation: 0,
      z: i,
    }));
    const texts = items
      .filter((it) => it.kind === "text")
      .map((t, i) => ({ ...t, z: imageItems.length + i }));
    setItems([...imageItems, ...texts]);
    setSelectedId(null);
    reflow();
  };

  // Initialise on load.
  useEffect(() => {
    if (!id) return;
    getBucket(id).then((b) => {
      if (!b) return;
      setBucket(b);
      if (b.layout && b.layout.items.length > 0) {
        setBg(b.layout.bg);
        setItems(b.layout.items);
      } else {
        const boxes = mosaicFullBleed(b.images, canvasW, canvasH);
        setItems(
          boxes.map((bx, i) => ({
            id: bx.id,
            kind: "image",
            uri: bx.uri,
            x: bx.x,
            y: bx.y,
            width: bx.width,
            height: bx.height,
            rotation: 0,
            z: i,
          })),
        );
      }
      setReady(true);
      requestAnimationFrame(() => setVersion((v) => v + 1));
    });
  }, [id, canvasW, canvasH]);

  const onChange = (itemId: string, patch: Partial<CanvasItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    );
  };

  const selected = items.find((it) => it.id === selectedId) || null;

  const bringForward = () => {
    if (!selected) return;
    const maxZ = Math.max(...items.map((it) => it.z));
    onChange(selected.id, { z: maxZ + 1 });
    reflow();
  };
  const sendBackward = () => {
    if (!selected) return;
    const minZ = Math.min(...items.map((it) => it.z));
    onChange(selected.id, { z: minZ - 1 });
    reflow();
  };
  const rotate15 = () => {
    if (!selected) return;
    onChange(selected.id, {
      rotation: (selected.rotation || 0) + Math.PI / 12,
    });
    reflow();
  };
  const duplicate = () => {
    if (!selected) return;
    const maxZ = Math.max(...items.map((it) => it.z));
    const copy: CanvasItem = {
      ...selected,
      id: uid(),
      x: selected.x + 16,
      y: selected.y + 16,
      z: maxZ + 1,
    };
    setItems((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  };
  const removeSelected = () => {
    if (!selected) return;
    setItems((prev) => prev.filter((it) => it.id !== selected.id));
    setSelectedId(null);
  };

  // Scatter images across the WHOLE page so no gaps remain — a packed sticker
  // collage. Images are placed on a jittered grid, oversized to cover each cell
  // (even when rotated) and overlap neighbours, with small random rotations.
  const shuffle = () => {
    if (!bucket || bucket.images.length === 0) return;
    const pool = [...bucket.images].sort(() => Math.random() - 0.5);

    const cols = bucket.images.length <= 3 ? 2 : 3;
    const cellW = canvasW / cols;
    const rows = Math.max(2, Math.round(canvasH / cellW));
    const cellH = canvasH / rows;
    const cellDiag = Math.hypot(cellW, cellH);

    const imageItems: CanvasItem[] = [];
    let idx = 0;
    let z = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const im = pool[idx % pool.length];
        idx++;
        const ratio = im.width / im.height;
        // Cover the cell fully (overscan) so rotation never exposes a gap.
        const cover = cellDiag * 1.12;
        let iw: number;
        let ih: number;
        if (ratio >= 1) {
          ih = cover;
          iw = cover * ratio;
        } else {
          iw = cover;
          ih = cover / ratio;
        }
        const jx = (Math.random() - 0.5) * cellW * 0.3;
        const jy = (Math.random() - 0.5) * cellH * 0.3;
        const centerX = c * cellW + cellW / 2 + jx;
        const centerY = r * cellH + cellH / 2 + jy;
        const rotation = (Math.random() - 0.5) * (Math.PI / 9); // +/- 10deg
        imageItems.push({
          id: uid(),
          kind: "image",
          uri: im.uri,
          x: centerX - iw / 2,
          y: centerY - ih / 2,
          width: iw,
          height: ih,
          rotation,
          z: z++,
        });
      }
    }
    // Randomise stacking so overlaps look organic.
    imageItems.sort(() => Math.random() - 0.5).forEach((it, i) => (it.z = i));

    const texts = items
      .filter((it) => it.kind === "text")
      .map((t, i) => ({ ...t, z: imageItems.length + i }));
    setItems([...imageItems, ...texts]);
    setSelectedId(null);
    reflow();
    toast("Shuffled", "success");
  };

  // Clear the whole canvas so images can be re-added as needed.
  const resetCanvas = () => {
    setItems([]);
    setSelectedId(null);
    reflow();
    setResetOpen(false);
    toast("Wallpaper reset", "success");
  };

  // Add a single bucket image to the canvas at its natural aspect ratio.
  const addImageToCanvas = (im: ImageAsset) => {
    const ratio = im.width / im.height;
    const w = canvasW * 0.55;
    const h = w / ratio;
    const maxZ = items.length ? Math.max(...items.map((it) => it.z)) : 0;
    const item: CanvasItem = {
      id: uid(),
      kind: "image",
      uri: im.uri,
      x: (canvasW - w) / 2,
      y: (canvasH - h) / 2,
      width: w,
      height: h,
      rotation: 0,
      z: maxZ + 1,
    };
    setItems((prev) => [...prev, item]);
    setAddOpen(false);
    toast("Image added", "success");
  };

  // Add a live year widget (progress bar or dot matrix) to the canvas.
  const addWidget = (variant: "progress" | "dotmatrix") => {
    const maxZ = items.length ? Math.max(...items.map((it) => it.z)) : 0;
    const w = variant === "progress" ? canvasW * 0.74 : canvasW * 0.62;
    const h = variant === "progress" ? canvasH * 0.11 : canvasW * 0.62;
    const item: CanvasItem = {
      id: uid(),
      kind: "widget",
      widget: variant,
      color: "#ffffff",
      x: (canvasW - w) / 2,
      y: variant === "progress" ? canvasH * 0.08 : (canvasH - h) / 2,
      width: w,
      height: h,
      rotation: 0,
      z: maxZ + 1,
    };
    setItems((prev) => [...prev, item]);
    setWidgetsOpen(false);
    setSelectedId(item.id);
    reflow();
    toast("Widget added", "success");
  };

  // Add an emoji sticker (rendered as a text layer) to the canvas.
  const addEmoji = (emoji: string) => {
    const maxZ = items.length ? Math.max(...items.map((it) => it.z)) : 0;
    const s = canvasW * 0.24;
    const item: CanvasItem = {
      id: uid(),
      kind: "text",
      text: emoji,
      color: "#ffffff",
      fontSize: Math.round(s * 0.8),
      x: (canvasW - s) / 2,
      y: (canvasH - s) / 2,
      width: s,
      height: s,
      rotation: 0,
      z: maxZ + 1,
    };
    setItems((prev) => [...prev, item]);
    setEmojiOpen(false);
    toast("Emoji added", "success");
  };

  const addText = () => {
    if (!draftText.trim()) return;
    const maxZ = items.length ? Math.max(...items.map((it) => it.z)) : 0;
    const item: CanvasItem = {
      id: uid(),
      kind: "text",
      text: draftText.trim(),
      color: draftColor,
      fontSize: 30,
      x: canvasW * 0.15,
      y: canvasH * 0.4,
      width: canvasW * 0.7,
      height: 120,
      rotation: 0,
      z: maxZ + 1,
    };
    setItems((prev) => [...prev, item]);
    setDraftText("");
    setTextOpen(false);
    toast("Text added", "success");
  };

  const captureCanvas = async (): Promise<string | null> => {
    setSelectedId(null);
    await new Promise((r) => setTimeout(r, 120));
    try {
      return await captureRef(canvasRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
    } catch {
      return null;
    }
  };

  const onSave = async () => {
    if (!id) return;
    setBusy(true);
    const thumb = await captureCanvas();
    await saveLayout(id, { bg, items }, thumb || undefined);
    setBusy(false);
    toast("Wallpaper saved", "success");
  };

  const onDownload = async () => {
    if (!id) return;
    const perm = await MediaLibrary.getPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      if (!perm.canAskAgain) {
        setBlocked(true);
        return;
      }
      const req = await MediaLibrary.requestPermissionsAsync();
      status = req.status;
      if (status !== "granted") {
        if (!req.canAskAgain) setBlocked(true);
        else toast("Gallery access needed to save", "info");
        return;
      }
    }

    setBusy(true);
    const uri = await captureCanvas();
    if (!uri) {
      setBusy(false);
      toast("Could not render wallpaper", "error");
      return;
    }
    try {
      await MediaLibrary.saveToLibraryAsync(uri);
      await saveLayout(id, { bg, items }, uri);
      toast("Saved to gallery", "success");
    } catch {
      toast("Failed to save to gallery", "error");
    } finally {
      setBusy(false);
    }
  };

  const rendered = [...items].sort((a, b) => a.z - b.z);

  const bgTap = Gesture.Tap().onEnd(() => {
    "worklet";
    scheduleOnRN(setSelectedId, null);
  });

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={[styles.topbar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          style={styles.iconBtn}
          onPress={() => router.back()}
          testID="editor-back-button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={styles.topActions}>
          <Pressable
            style={styles.ghostBtn}
            onPress={onSave}
            disabled={busy}
            testID="save-button"
          >
            <Ionicons name="bookmark-outline" size={16} color={colors.ink} />
            <Text style={styles.ghostText}>Save</Text>
          </Pressable>
          <Pressable
            style={styles.downloadBtn}
            onPress={onDownload}
            disabled={busy}
            testID="download-button"
          >
            <Ionicons name="download-outline" size={16} color={colors.onPrimary} />
            <Text style={styles.downloadText}>Download</Text>
          </Pressable>
        </View>
      </View>

      {/* Canvas */}
      <View style={styles.canvasWrap}>
        <GestureDetector gesture={bgTap}>
          <View
            ref={canvasRef}
            collapsable={false}
            style={[
              styles.canvas,
              { width: canvasW, height: canvasH, backgroundColor: bg },
            ]}
            testID="editor-canvas"
          >
            {ready &&
              rendered.map((it) => (
                <CanvasItemView
                  key={`${it.id}-${version}`}
                  item={it}
                  selected={selectedId === it.id}
                  onSelect={setSelectedId}
                  onChange={onChange}
                />
              ))}
          </View>
        </GestureDetector>
      </View>

      {/* Bottom toolbar */}
      <View
        style={[styles.toolbar, { paddingBottom: insets.bottom + spacing.sm }]}
      >
        {selected ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolRow}
            testID="selected-toolbar"
          >
            <Tool icon="arrow-up" label="Forward" onPress={bringForward} tid="forward" />
            <Tool icon="arrow-down" label="Backward" onPress={sendBackward} tid="backward" />
            <Tool icon="refresh" label="Rotate 15°" onPress={rotate15} tid="rotate" />
            <Tool icon="copy-outline" label="Duplicate" onPress={duplicate} tid="duplicate" />
            <Tool
              icon="trash-outline"
              label="Delete"
              onPress={removeSelected}
              tid="delete"
              danger
            />
            <Tool
              icon="checkmark"
              label="Done"
              onPress={() => setSelectedId(null)}
              tid="deselect"
            />
          </ScrollView>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolRow}
            testID="canvas-toolbar"
          >
            <Tool icon="grid" label="Mosaic" onPress={() => arrange("mosaic")} tid="mosaic" />
            <Tool icon="shuffle" label="Shuffle" onPress={shuffle} tid="shuffle" />
            <Tool
              icon="add-circle-outline"
              label="Add image"
              onPress={() => setAddOpen(true)}
              tid="add-image"
            />
            <Tool
              icon="chevron-back"
              label="Left"
              onPress={() => arrange("left")}
              tid="align-left"
            />
            <Tool
              icon="reorder-two"
              label="Center"
              onPress={() => arrange("center")}
              tid="align-center"
            />
            <Tool
              icon="chevron-forward"
              label="Right"
              onPress={() => arrange("right")}
              tid="align-right"
            />
            <Tool
              icon="color-palette-outline"
              label="Background"
              onPress={() => setBgOpen(true)}
              tid="bg"
            />
            <Tool
              icon="text"
              label="Add text"
              onPress={() => setTextOpen(true)}
              tid="add-text"
            />
            <Tool
              icon="happy-outline"
              label="Emoji"
              onPress={() => setEmojiOpen(true)}
              tid="emoji"
            />
            <Tool
              icon="stats-chart"
              label="Widgets"
              onPress={() => setWidgetsOpen(true)}
              tid="widgets"
            />
            <Tool
              icon="trash-outline"
              label="Reset"
              onPress={() => setResetOpen(true)}
              tid="reset"
              danger
            />
          </ScrollView>
        )}
      </View>

      {busy && (
        <View style={styles.busyOverlay} testID="busy-overlay">
          <ActivityIndicator color={colors.onDark} size="large" />
        </View>
      )}

      {/* Background picker */}
      <BottomSheet visible={bgOpen} onClose={() => setBgOpen(false)} testID="bg-sheet">
        <Text style={styles.sheetTitle}>Background</Text>
        <View style={styles.swatchWrap}>
          {CANVAS_BACKGROUNDS.map((c) => (
            <Pressable
              key={c}
              style={[
                styles.swatch,
                { backgroundColor: c },
                bg === c && styles.swatchActive,
              ]}
              onPress={() => {
                setBg(c);
                setBgOpen(false);
              }}
              testID={`bg-swatch-${c}`}
            />
          ))}
        </View>
      </BottomSheet>

      {/* Add text */}
      <BottomSheet visible={textOpen} onClose={() => setTextOpen(false)} testID="text-sheet">
        <Text style={styles.sheetTitle}>Add Text</Text>
        <TextInput
          value={draftText}
          onChangeText={setDraftText}
          placeholder="Type something…"
          placeholderTextColor={colors.ash}
          style={styles.input}
          autoFocus
          multiline
          testID="text-input"
        />
        <View style={styles.swatchWrap}>
          {TEXT_COLORS.map((c) => (
            <Pressable
              key={c}
              style={[
                styles.swatch,
                { backgroundColor: c },
                draftColor === c && styles.swatchActive,
              ]}
              onPress={() => setDraftColor(c)}
              testID={`text-color-${c}`}
            />
          ))}
        </View>
        <Pressable
          style={[styles.primaryBtn, !draftText.trim() && styles.btnDisabled]}
          onPress={addText}
          disabled={!draftText.trim()}
          testID="confirm-add-text"
        >
          <Text style={styles.primaryBtnText}>Add</Text>
        </Pressable>
      </BottomSheet>

      {/* Add image from bucket */}
      <BottomSheet visible={addOpen} onClose={() => setAddOpen(false)} testID="add-image-sheet">
        <Text style={styles.sheetTitle}>Add Image</Text>
        {bucket && bucket.images.length > 0 ? (
          <ScrollView
            style={{ maxHeight: 360 }}
            contentContainerStyle={styles.addGrid}
            showsVerticalScrollIndicator={false}
          >
            {bucket.images.map((im) => (
              <Pressable
                key={im.id}
                style={styles.addThumb}
                onPress={() => addImageToCanvas(im)}
                testID={`add-image-${im.id}`}
              >
                <ExpoImage
                  source={{ uri: im.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.permBody}>This bucket has no images.</Text>
        )}
      </BottomSheet>

      {/* Widgets */}
      <BottomSheet visible={widgetsOpen} onClose={() => setWidgetsOpen(false)} testID="widgets-sheet">
        <Text style={styles.sheetTitle}>Live Widgets</Text>
        <Text style={styles.permBody}>
          Auto-updating widgets that track this year’s progress.
        </Text>
        <Pressable
          style={styles.widgetCard}
          onPress={() => addWidget("progress")}
          testID="widget-progress"
        >
          <View style={styles.widgetPreview}>
            <Widget variant="progress" tint="#ffffff" />
          </View>
          <View style={styles.widgetMeta}>
            <Text style={styles.widgetName}>Year Progress Bar</Text>
            <Text style={styles.widgetDesc}>Shows how much of the year is done</Text>
          </View>
        </Pressable>
        <Pressable
          style={styles.widgetCard}
          onPress={() => addWidget("dotmatrix")}
          testID="widget-dotmatrix"
        >
          <View style={styles.widgetPreviewSquare}>
            <Widget variant="dotmatrix" tint="#ffffff" />
          </View>
          <View style={styles.widgetMeta}>
            <Text style={styles.widgetName}>Year Dot Matrix</Text>
            <Text style={styles.widgetDesc}>One dot per day, bright = elapsed</Text>
          </View>
        </Pressable>
      </BottomSheet>

      {/* Emoji picker */}
      <BottomSheet visible={emojiOpen} onClose={() => setEmojiOpen(false)} testID="emoji-sheet">
        <Text style={styles.sheetTitle}>Add Emoji</Text>
        <ScrollView
          style={{ maxHeight: 320 }}
          contentContainerStyle={styles.emojiGrid}
          showsVerticalScrollIndicator={false}
        >
          {EMOJIS.map((e) => (
            <Pressable
              key={e}
              style={styles.emojiCell}
              onPress={() => addEmoji(e)}
              testID={`emoji-${e}`}
            >
              <Text style={styles.emojiChar}>{e}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>

      {/* Reset confirmation */}
      <BottomSheet visible={resetOpen} onClose={() => setResetOpen(false)} testID="reset-sheet">
        <Text style={styles.sheetTitle}>Reset wallpaper?</Text>
        <Text style={styles.permBody}>
          This will remove all the images from this wallpaper. This can’t be undone.
        </Text>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.error }]}
          onPress={resetCanvas}
          testID="confirm-reset"
        >
          <Text style={styles.primaryBtnText}>Yes, reset</Text>
        </Pressable>
        <Pressable
          style={styles.cancelBtn}
          onPress={() => setResetOpen(false)}
          testID="cancel-reset"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </BottomSheet>

      {/* Permission blocked */}
      <BottomSheet visible={blocked} onClose={() => setBlocked(false)} testID="editor-permission-sheet">
        <Text style={styles.sheetTitle}>Gallery access needed</Text>
        <Text style={styles.permBody}>
          Enable photo access in Settings to save your wallpaper.
        </Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            Linking.openSettings();
            setBlocked(false);
          }}
          testID="editor-open-settings"
        >
          <Text style={styles.primaryBtnText}>Open Settings</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

function Tool({
  icon,
  label,
  onPress,
  tid,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tid: string;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.tool} onPress={onPress} testID={`tool-${tid}`}>
      <View style={[styles.toolIcon, danger && styles.toolIconDanger]}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.error : colors.ink}
        />
      </View>
      <Text style={[styles.toolLabel, danger && { color: colors.error }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSoft },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  topActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.secondaryBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 40,
  },
  ghostText: { ...type.button, color: colors.ink },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 40,
  },
  downloadText: { ...type.button, color: colors.onPrimary },

  canvasWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  canvas: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },

  toolbar: {
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    backgroundColor: colors.canvas,
    paddingTop: spacing.md,
  },
  toolRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    alignItems: "center",
  },
  tool: { alignItems: "center", width: 64, flexShrink: 0 },
  toolIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  toolIconDanger: { backgroundColor: "#fdecec" },
  toolLabel: { ...type.captionMd, color: colors.mute },

  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  sheetTitle: { ...type.headingLg, color: colors.ink, marginBottom: spacing.lg },
  swatchWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  swatchActive: {
    borderWidth: 3,
    borderColor: colors.primary,
  },
  input: {
    ...type.bodyMd,
    color: colors.ink,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    minHeight: 80,
    marginBottom: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { ...type.button, color: colors.onPrimary, fontSize: 16 },
  btnDisabled: { backgroundColor: colors.stone },
  permBody: { ...type.bodyMd, color: colors.mute, marginBottom: spacing.lg },
  cancelBtn: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  cancelText: { ...type.button, color: colors.ink, fontSize: 16 },
  addGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  addThumb: {
    width: 88,
    height: 88,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceCard,
  },
  widgetCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  widgetPreview: {
    width: 120,
    height: 56,
    justifyContent: "center",
  },
  widgetPreviewSquare: {
    width: 72,
    height: 72,
  },
  widgetMeta: { flex: 1 },
  widgetName: { ...type.bodyStrong, color: colors.onDark },
  widgetDesc: { ...type.bodySm, color: colors.onDarkMute, marginTop: 2 },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  emojiCell: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceCard,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiChar: { fontSize: 30 },
});

# PhotoLayers — Wallpaper Collage Maker

Build phone wallpapers from your images. Fully offline, on-device.

## Flow
Home (Buckets) → open bucket → bulk upload → Editor (canvas) → Save / Download.

## Features
- **Buckets**: create, rename, delete image collections.
- **Bulk upload**: pick many photos at once; tap **✕** on a tile to remove.
- **Editor canvas** (phone-shaped):
  - **Mosaic**: tiles all images edge-to-edge, **no cropping**, fills the frame.
  - **Shuffle**: packs images across the whole page with slight rotations (no gaps).
  - **Align** left / center / right.
  - **Add image** back from the bucket; **Add text**; **Background** color.
  - **Emoji**: pick stickers onto the canvas.
  - **Widgets** (live, auto-update): **Year Progress Bar**, **Year Dot Matrix**.
  - **Reset**: clears the canvas (with confirm).
- **Per-layer**: tap to select → drag, **corner-handle resize**, pinch, **rotate 15°**, bring forward/back, duplicate, delete.
- **Save** layout in-app; **Download** wallpaper to photo gallery.

## Tech
- Expo SDK 54 + React Native + TypeScript, Expo Router.
- StyleSheet (Pinterest-style theme) + Moti animations.
- Gestures: react-native-gesture-handler + reanimated.
- Local storage (AsyncStorage) + expo-file-system; expo-image-picker; expo-media-library; react-native-view-shot.
- No backend — everything on-device.

## Structure
```
frontend/app/index.tsx          Home (buckets)
frontend/app/bucket/[id].tsx    Bucket detail + upload
frontend/app/editor/[id].tsx    Canvas editor
frontend/src/store/buckets.ts   Local data + image persistence
frontend/src/lib/mosaic.ts      Justified/full-bleed layout engine
frontend/src/components/editor/ CanvasItem (layers) + Widget (live)
frontend/src/theme/             Design tokens
```

## Notes
- Native-only (test in Expo Go / a build): photo upload, gallery save, pinch/rotate.
- Widgets are live while the app is open. Auto-updating a **set** wallpaper needs the
  Android **WallpaperManager** native module — planned (native build required).

## Run
- Preview refreshes automatically. Scan the QR code to open in **Expo Go**.
- Publish → Deploy → generate iOS/Android builds for the full native experience.

## Roadmap
- Set + auto-update Android wallpaper (WallpaperManager).
- Widget colors; more widgets (clock, countdown).
- Undo / redo; free rotate handle; shuffle density slider.

# PRD — Wallpaper Collage Maker (Phase 1)

## Original Problem Statement
Build a mobile app (React Native, Expo 54, TS) that lets a user collect images into
"buckets" and compose them into a phone wallpaper via a Canva-like editor. Flow:
User → Home (Buckets) → select bucket → bulk upload images → canvas → Editor.
The reference wallpaper is a full-bleed mosaic where images are tiled edge-to-edge
with NO cropping. A future "+ Widgets" section (Progress bar, Year dot-matrix) will
auto-update the wallpaper via the Android WallpaperManager. Design follows a
Pinterest-style theme (warm-cream chrome, single red #e60023 accent).

## User Choices (gathered)
- Fully offline / on-device (local storage), no accounts/backend.
- Widgets: SKIPPED for Phase 1 (native-build only; WallpaperManager not in Expo Go).
- Download: save finished wallpaper to the phone photo gallery.
- Canvas: auto-mosaic (justified, no crop, fills phone frame) + free drag/pinch/rotate.
- Tech: React Native StyleSheet + Moti (NativeWind skipped — requires metro.config
  changes that are locked in this environment; visuals identical).

## Architecture
- Frontend: Expo Router (file-based). Screens: `app/index.tsx` (Home/Buckets),
  `app/bucket/[id].tsx` (bucket detail + bulk upload), `app/editor/[id].tsx` (canvas editor).
- State/data: on-device only. Metadata in AsyncStorage via `@/src/utils/storage`
  (`src/store/buckets.ts`); picked images copied to the app document dir with
  `expo-file-system/legacy` (web keeps the picker uri).
- Layout engine: `src/lib/mosaic.ts` — `mosaicFullBleed` (binary-searched justified
  rows filling the whole canvas, no crop) and `mosaicAligned` (last-row left/center/right).
- Editor gestures: react-native-gesture-handler + reanimated 4 (`scheduleOnRN`) in
  `src/components/editor/CanvasItem.tsx` (pan/pinch/rotate/tap-select).
- Export: `react-native-view-shot` captures the canvas; `expo-media-library` saves to gallery.
- Shared UI: `Toast` (Moti), `BottomSheet` (Modal + Moti), theme tokens in `src/theme`.
- Backend: unchanged FastAPI template (not used — app is fully local).

## User Personas
- Aesthetic curators / students building "vision board" style phone wallpapers from
  saved screenshots and photos.

## Core Requirements (static)
- Create/rename/delete buckets; bulk-upload images into a bucket.
- Compose a phone wallpaper: full-bleed no-crop mosaic; per-image bring forward/back,
  rotate, duplicate, delete; background color; text layers; align left/center/right.
- Save layout locally; download the composed wallpaper to gallery.

## Implemented (2026-06)
- Home: Buckets grid, empty state, red + FAB, create/rename/delete via bottom sheets.
- Bucket page: header + back, 3-col image grid, dashed bulk-upload tile (multi-select
  up to 30), long-press to remove image, Edit Wallpaper CTA (disabled when empty).
- Editor: phone-shaped canvas, full-bleed mosaic + aligned arrange, background swatches,
  add-text layers, free drag/pinch/rotate, layer ordering, duplicate/delete, save layout,
  download to gallery. Photo/gallery permissions handled per contract (contextual +
  Open Settings fallback).
- Verified end-to-end by testing agent (iteration_2: PASS).
- Editor extras (2026-06): per-image X delete on bucket tiles; Shuffle (scatter +
  ±15° rotation covering the page); Reset (clear canvas); Add-image sheet to re-add
  individual bucket images; Rotate step changed to 15° increments.
- Editor v3 (2026-06): Reset now confirms before clearing. Live year Widgets
  (Widget.tsx) — Progress bar + Dot matrix (one dot per day, bright=elapsed) that
  recompute from the current date and tick every 30s; added as draggable/resizable
  widget-kind layers. Emoji picker adds emoji stickers as text layers.
  Note: widgets are live only while the app is open; auto-refreshing a SET wallpaper
  needs the Android WallpaperManager native module (backlog, native build).

## Backlog
- P0: `+ Widgets` section — Progress bar & Year dot-matrix widgets that render to a
  wallpaper and auto-set it via Android WallpaperManager (native build required).
- P1: Auto-set wallpaper directly from editor (Android); per-image opacity/border-radius;
  undo/redo; snap-to-grid guides.
- P2: Bucket cover selection; export presets/resolutions; iOS wallpaper shortcut guidance.

## Next Tasks
- Confirm widget scope with user, then integrate a WallpaperManager native module and
  build the widget renderers.

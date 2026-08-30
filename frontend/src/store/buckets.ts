// Fully offline, on-device data layer for buckets, images and saved wallpapers.
// Metadata lives in AsyncStorage (via the shared storage util); picked image
// files are copied into the app's document directory so they persist.

import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

export type ImageAsset = {
  id: string;
  uri: string;
  width: number;
  height: number;
};

export type CanvasItem = {
  id: string;
  kind: "image" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // radians
  z: number;
  // image
  uri?: string;
  // text
  text?: string;
  color?: string;
  fontSize?: number;
};

export type EditorState = {
  bg: string;
  items: CanvasItem[];
};

export type Bucket = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  images: ImageAsset[];
  layout: EditorState | null;
  thumbUri?: string;
};

const KEY = "buckets:v1";
const IMAGE_DIR = FileSystem.documentDirectory + "photolayers/";

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// The storage util's typed surface only accepts primitives, so we stash a JSON
// string and hydrate it here. Reliable round-trip for arrays/objects.
async function readJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await storage.getItem(key, "");
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  await storage.setItem(key, JSON.stringify(value));
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

// Copy a freshly-picked asset into persistent storage and return its new uri.
// On web the filesystem module isn't available, so we keep the picker uri.
export async function persistImage(uri: string): Promise<string> {
  if (Platform.OS === "web") return uri;
  try {
    await ensureDir();
    const ext = (uri.split(".").pop() || "jpg").split("?")[0].slice(0, 5);
    const dest = `${IMAGE_DIR}${uid()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    // Fall back to the original uri if the copy fails.
    return uri;
  }
}

export async function getBuckets(): Promise<Bucket[]> {
  return readJSON<Bucket[]>(KEY, []);
}

export async function getBucket(id: string): Promise<Bucket | undefined> {
  const all = await getBuckets();
  return all.find((b) => b.id === id);
}

export async function saveBuckets(list: Bucket[]): Promise<void> {
  await writeJSON(KEY, list);
}

export async function upsertBucket(bucket: Bucket): Promise<void> {
  const all = await getBuckets();
  const idx = all.findIndex((b) => b.id === bucket.id);
  bucket.updatedAt = Date.now();
  if (idx >= 0) all[idx] = bucket;
  else all.unshift(bucket);
  await saveBuckets(all);
}

export async function createBucket(name: string): Promise<Bucket> {
  const bucket: Bucket = {
    id: uid(),
    name: name.trim() || "Untitled",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    images: [],
    layout: null,
  };
  await upsertBucket(bucket);
  return bucket;
}

export async function renameBucket(id: string, name: string): Promise<void> {
  const b = await getBucket(id);
  if (!b) return;
  b.name = name.trim() || b.name;
  await upsertBucket(b);
}

export async function deleteBucket(id: string): Promise<void> {
  const all = await getBuckets();
  await saveBuckets(all.filter((b) => b.id !== id));
}

export async function addImagesToBucket(
  id: string,
  assets: ImageAsset[],
): Promise<Bucket | undefined> {
  const b = await getBucket(id);
  if (!b) return undefined;
  b.images = [...b.images, ...assets];
  await upsertBucket(b);
  return b;
}

export async function removeImageFromBucket(
  id: string,
  imageId: string,
): Promise<Bucket | undefined> {
  const b = await getBucket(id);
  if (!b) return undefined;
  b.images = b.images.filter((im) => im.id !== imageId);
  if (b.layout) {
    b.layout.items = b.layout.items.filter((it) => it.id !== imageId);
  }
  await upsertBucket(b);
  return b;
}

export async function saveLayout(
  id: string,
  layout: EditorState,
  thumbUri?: string,
): Promise<void> {
  const b = await getBucket(id);
  if (!b) return;
  b.layout = layout;
  if (thumbUri) b.thumbUri = thumbUri;
  await upsertBucket(b);
}

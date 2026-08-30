import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { MotiView } from "moti";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/src/components/BottomSheet";
import { useToast } from "@/src/components/Toast";
import {
  addImagesToBucket,
  Bucket,
  getBucket,
  ImageAsset,
  persistImage,
  removeImageFromBucket,
  uid,
} from "@/src/store/buckets";
import { colors, radius, spacing, type } from "@/src/theme";

const GAP = spacing.sm;
const COL = 3;

export default function BucketScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const TILE = (width - spacing.lg * 2 - GAP * (COL - 1)) / COL;
  const { id } = useLocalSearchParams<{ id: string }>();

  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [uploading, setUploading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [activeImage, setActiveImage] = useState<ImageAsset | null>(null);

  const reload = useCallback(() => {
    if (id) getBucket(id).then((b) => setBucket(b || null));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const pickImages = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      if (!perm.canAskAgain) {
        setBlocked(true);
        return;
      }
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      status = req.status;
      if (status !== "granted") {
        if (!req.canAskAgain) setBlocked(true);
        else toast("Photo access needed to upload", "info");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 30,
      quality: 1,
    });
    if (result.canceled || !id) return;

    setUploading(true);
    try {
      const assets: ImageAsset[] = [];
      for (const a of result.assets) {
        const uri = await persistImage(a.uri);
        assets.push({
          id: uid(),
          uri,
          width: a.width || 1000,
          height: a.height || 1000,
        });
      }
      const updated = await addImagesToBucket(id, assets);
      if (updated) setBucket(updated);
      toast(`${assets.length} image${assets.length > 1 ? "s" : ""} added`, "success");
    } finally {
      setUploading(false);
    }
  };

  const onDeleteImage = async () => {
    if (!id || !activeImage) return;
    const updated = await removeImageFromBucket(id, activeImage.id);
    if (updated) setBucket(updated);
    setActiveImage(null);
    toast("Image removed", "success");
  };

  const removeImage = async (img: ImageAsset) => {
    if (!id) return;
    const updated = await removeImageFromBucket(id, img.id);
    if (updated) setBucket(updated);
    toast("Image removed", "success");
  };

  const hasImages = (bucket?.images.length || 0) > 0;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          style={styles.iconBtn}
          onPress={() => router.back()}
          testID="back-button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {bucket?.name ?? "Bucket"}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {bucket?.images.map((img, i) => (
            <MotiView
              key={img.id}
              from={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "timing", duration: 220, delay: i * 25 }}
              style={{ width: TILE, height: TILE }}
            >
              <Pressable
                style={[styles.tile, { width: TILE, height: TILE }]}
                onLongPress={() => setActiveImage(img)}
                testID={`image-tile-${img.id}`}
              >
                <Image
                  source={{ uri: img.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              </Pressable>
              <Pressable
                style={styles.removeBadge}
                hitSlop={8}
                onPress={() => removeImage(img)}
                testID={`remove-image-${img.id}`}
              >
                <Ionicons name="close" size={16} color={colors.onDark} />
              </Pressable>
            </MotiView>
          ))}

          {/* Bulk upload tile */}
          <Pressable
            style={[styles.tile, styles.uploadTile, { width: TILE, height: TILE }]}
            onPress={pickImages}
            disabled={uploading}
            testID="bulk-upload-tile"
          >
            {uploading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="add" size={26} color={colors.primary} />
                <Text style={styles.uploadText}>Upload</Text>
              </>
            )}
          </Pressable>
        </View>

        {!hasImages && !uploading && (
          <Text style={styles.hint} testID="bucket-empty-hint">
            Bulk upload images, then arrange them into a wallpaper.
          </Text>
        )}
      </ScrollView>

      {/* Edit Wallpaper CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          style={[styles.editBtn, !hasImages && styles.btnDisabled]}
          onPress={() => id && router.push(`/editor/${id}`)}
          disabled={!hasImages}
          testID="edit-wallpaper-button"
        >
          <Ionicons name="brush" size={18} color={colors.onPrimary} />
          <Text style={styles.editBtnText}>Edit Wallpaper</Text>
        </Pressable>
      </View>

      {/* Image options */}
      <BottomSheet
        visible={!!activeImage}
        onClose={() => setActiveImage(null)}
        testID="image-options-sheet"
      >
        <Text style={styles.sheetTitle}>Image</Text>
        <Pressable
          style={styles.row}
          onPress={onDeleteImage}
          testID="delete-image-option"
        >
          <Ionicons name="trash-outline" size={22} color={colors.error} />
          <Text style={[styles.rowText, { color: colors.error }]}>
            Remove from bucket
          </Text>
        </Pressable>
      </BottomSheet>

      {/* Permission blocked */}
      <BottomSheet
        visible={blocked}
        onClose={() => setBlocked(false)}
        testID="permission-sheet"
      >
        <Text style={styles.sheetTitle}>Photo access needed</Text>
        <Text style={styles.permBody}>
          Enable photo access in Settings to upload images to your bucket.
        </Text>
        <Pressable
          style={styles.editBtn}
          onPress={() => {
            Linking.openSettings();
            setBlocked(false);
          }}
          testID="open-settings-button"
        >
          <Text style={styles.editBtnText}>Open Settings</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSoft },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...type.headingXl, color: colors.ink, flex: 1 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceCard,
  },
  removeBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surfaceSoft,
  },
  uploadTile: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.hairline,
    borderStyle: "dashed",
  },
  uploadText: {
    ...type.captionMd,
    color: colors.primary,
    fontWeight: "700",
    marginTop: 2,
  },
  hint: {
    ...type.bodySm,
    color: colors.mute,
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    backgroundColor: colors.surfaceSoft,
  },
  editBtn: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnText: { ...type.button, color: colors.onPrimary, fontSize: 16 },
  btnDisabled: { backgroundColor: colors.stone },

  sheetTitle: { ...type.headingLg, color: colors.ink, marginBottom: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: { ...type.bodyStrong, color: colors.ink },
  permBody: { ...type.bodyMd, color: colors.mute, marginBottom: spacing.lg },
});

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { MotiView } from "moti";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/src/components/BottomSheet";
import { useToast } from "@/src/components/Toast";
import {
  Bucket,
  createBucket,
  deleteBucket,
  getBuckets,
  renameBucket,
} from "@/src/store/buckets";
import { colors, radius, spacing, type } from "@/src/theme";

const GAP = spacing.md;

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const colW = (width - spacing.lg * 2 - GAP) / 2;

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [active, setActive] = useState<Bucket | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState("");

  const reload = useCallback(() => {
    getBuckets().then(setBuckets);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const onCreate = async () => {
    if (!name.trim()) return;
    const b = await createBucket(name);
    setName("");
    setCreateOpen(false);
    reload();
    router.push(`/bucket/${b.id}`);
  };

  const onDelete = async () => {
    if (!active) return;
    await deleteBucket(active.id);
    setActive(null);
    reload();
    toast("Bucket deleted", "success");
  };

  const onRename = async () => {
    if (!active || !renameText.trim()) return;
    await renameBucket(active.id, renameText);
    setRenaming(false);
    setActive(null);
    reload();
    toast("Renamed", "success");
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title} testID="home-title">
          Buckets
        </Text>
        <Text style={styles.subtitle}>
          {buckets.length} {buckets.length === 1 ? "collection" : "collections"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {buckets.length === 0 ? (
          <View style={styles.empty} testID="home-empty">
            <View style={styles.emptyIcon}>
              <Ionicons name="images-outline" size={30} color={colors.mute} />
            </View>
            <Text style={styles.emptyTitle}>No buckets yet</Text>
            <Text style={styles.emptyBody}>
              Create a bucket to start collecting images and building wallpapers.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {buckets.map((b, i) => {
              const cover = b.thumbUri || b.images[0]?.uri;
              return (
                <MotiView
                  key={b.id}
                  from={{ opacity: 0, translateY: 12 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: "timing", duration: 260, delay: i * 45 }}
                >
                  <Pressable
                    style={[styles.card, { width: colW }]}
                    onPress={() => router.push(`/bucket/${b.id}`)}
                    onLongPress={() => {
                      setActive(b);
                      setRenameText(b.name);
                    }}
                    testID={`bucket-card-${b.id}`}
                  >
                    <View
                      style={[
                        styles.cardThumb,
                        { width: colW, height: colW * 1.3 },
                      ]}
                    >
                      {cover ? (
                        <Image
                          source={{ uri: cover }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                        />
                      ) : (
                        <Ionicons
                          name="add"
                          size={28}
                          color={colors.stone}
                        />
                      )}
                      <View style={styles.countPill}>
                        <Text style={styles.countText}>{b.images.length}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {b.name}
                    </Text>
                  </Pressable>
                </MotiView>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + spacing.xl }]}
        onPress={() => setCreateOpen(true)}
        testID="create-bucket-fab"
      >
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </Pressable>

      {/* Create bucket */}
      <BottomSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        testID="create-bucket-sheet"
      >
        <Text style={styles.sheetTitle}>New Bucket</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Bucket name"
          placeholderTextColor={colors.ash}
          style={styles.input}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={onCreate}
          testID="bucket-name-input"
        />
        <Pressable
          style={[styles.primaryBtn, !name.trim() && styles.btnDisabled]}
          onPress={onCreate}
          disabled={!name.trim()}
          testID="confirm-create-bucket"
        >
          <Text style={styles.primaryBtnText}>Create</Text>
        </Pressable>
      </BottomSheet>

      {/* Bucket options */}
      <BottomSheet
        visible={!!active && !renaming}
        onClose={() => setActive(null)}
        testID="bucket-options-sheet"
      >
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {active?.name}
        </Text>
        <Pressable
          style={styles.row}
          onPress={() => setRenaming(true)}
          testID="rename-bucket-option"
        >
          <Ionicons name="create-outline" size={22} color={colors.ink} />
          <Text style={styles.rowText}>Rename</Text>
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={onDelete}
          testID="delete-bucket-option"
        >
          <Ionicons name="trash-outline" size={22} color={colors.error} />
          <Text style={[styles.rowText, { color: colors.error }]}>Delete</Text>
        </Pressable>
      </BottomSheet>

      {/* Rename */}
      <BottomSheet
        visible={!!active && renaming}
        onClose={() => {
          setRenaming(false);
          setActive(null);
        }}
        testID="rename-bucket-sheet"
      >
        <Text style={styles.sheetTitle}>Rename Bucket</Text>
        <TextInput
          value={renameText}
          onChangeText={setRenameText}
          placeholder="Bucket name"
          placeholderTextColor={colors.ash}
          style={styles.input}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={onRename}
          testID="rename-input"
        />
        <Pressable
          style={[styles.primaryBtn, !renameText.trim() && styles.btnDisabled]}
          onPress={onRename}
          disabled={!renameText.trim()}
          testID="confirm-rename"
        >
          <Text style={styles.primaryBtnText}>Save</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSoft },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { ...type.displayXl, color: colors.ink },
  subtitle: { ...type.bodySm, color: colors.mute, marginTop: spacing.xxs },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  card: {},
  cardThumb: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceCard,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  countPill: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.canvas,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  countText: { ...type.captionMd, color: colors.ink, fontWeight: "700" },
  cardName: {
    ...type.bodyStrong,
    color: colors.ink,
    marginTop: spacing.sm,
  },

  empty: {
    alignItems: "center",
    paddingTop: spacing.section,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { ...type.headingLg, color: colors.ink, marginBottom: spacing.xs },
  emptyBody: {
    ...type.bodyMd,
    color: colors.mute,
    textAlign: "center",
  },

  fab: {
    position: "absolute",
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: { boxShadow: "0px 6px 12px rgba(230,0,35,0.35)" },
      default: {
        shadowColor: colors.primary,
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      },
    }),
  },

  sheetTitle: {
    ...type.headingLg,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  input: {
    ...type.bodyMd,
    color: colors.ink,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 48,
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

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: { ...type.bodyStrong, color: colors.ink },
});

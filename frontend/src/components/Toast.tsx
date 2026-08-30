// Lightweight top toast (no Alert — per app conventions). Moti-animated.

import React, { createContext, useCallback, useContext, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AnimatePresence, MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, type } from "@/src/theme";

type ToastKind = "success" | "error" | "info";
type ToastState = { message: string; kind: ToastKind } | null;

const ToastContext = createContext<(msg: string, kind?: ToastKind) => void>(
  () => {},
);

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState>(null);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2200);
  }, []);

  const icon =
    toast?.kind === "success"
      ? "checkmark-circle"
      : toast?.kind === "error"
        ? "alert-circle"
        : "information-circle";

  return (
    <ToastContext.Provider value={show}>
      {children}
      <AnimatePresence>
        {toast && (
          <MotiView
            key="toast"
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: -20 }}
            transition={{ type: "timing", duration: 220 }}
            style={[styles.wrap, { top: insets.top + spacing.sm }]}
            pointerEvents="none"
            testID="app-toast"
          >
            <View style={styles.toast}>
              <Ionicons name={icon} size={18} color={colors.onDark} />
              <Text style={styles.text}>{toast.message}</Text>
            </View>
          </MotiView>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceDark,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    maxWidth: "100%",
  },
  text: { ...type.bodySmStrong, color: colors.onDark, flexShrink: 1 },
});

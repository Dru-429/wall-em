// Bottom sheet built on RN Modal + Moti slide. Mounted at the root of a screen
// so it overlays all other chrome. Keyboard-aware for text inputs.

import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
};

export function BottomSheet({ visible, onClose, children, testID }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onClose} testID="sheet-scrim" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.kav, { pointerEvents: "box-none" }]}
      >
        <MotiView
          key={visible ? "open" : "closed"}
          from={{ translateY: 400 }}
          animate={{ translateY: 0 }}
          transition={{ type: "timing", duration: 260 }}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          testID={testID}
        >
          <View style={styles.handle} />
          {children}
        </MotiView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.stone,
    marginBottom: spacing.lg,
  },
});

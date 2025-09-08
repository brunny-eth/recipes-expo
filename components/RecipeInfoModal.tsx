import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler'; // RNGH version

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  tabs?: React.ReactNode;
  children: React.ReactNode;
  // Pass your PanGestureHandler ref so scroll & pan can cooperate
  panGestureRef?: any;
};

export default function RecipeInfoModal({ visible, onClose, title = 'Recipe Info', tabs, children, panGestureRef }: Props) {
  const { width, height } = useWindowDimensions();
  if (!visible) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Backdrop as a sibling so it doesn't intercept vertical pans */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Card with a hard cap; no flex:1 */}
      <View style={[styles.card, { maxHeight: height * 0.82, width: Math.min(width * 0.92, 560) }]}>
        {/* Close button in top-right corner */}
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10}>
          <Text style={styles.close}>✕</Text>
        </Pressable>

        {/* Fixed tabs area */}
        <View style={styles.tabsContainer}>
          {tabs}
        </View>

        {/* Scrollable content area - only the actual content */}
        <ScrollView
          // cooperate with outer pan
          simultaneousHandlers={panGestureRef}
          directionalLockEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          style={styles.contentBody}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  card: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', flex: 1 },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  close: { fontSize: 18, color: '#666' },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E6E6',
  },
  contentBody: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
});

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/src/components/themed-text';
import { useThemeColor } from '@/src/hooks/use-theme-color';

type Step = {
  label: string;
  status: 'pending' | 'active' | 'done';
};

type Props = {
  steps: Step[];
};

export function AiLoadingOverlay({ steps }: Props) {
  const tint = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');
  const icon = useThemeColor({}, 'icon');

  return (
    <View style={[styles.overlay, { backgroundColor: background + 'F0' }]}>
      <View style={[styles.card, { backgroundColor: background }]}>
        <ThemedText style={styles.title}>Analisando com IA</ThemedText>

        <View style={styles.steps}>
          {steps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.iconContainer}>
                {step.status === 'active' ? (
                  <ActivityIndicator size="small" color={tint} />
                ) : step.status === 'done' ? (
                  <ThemedText style={[styles.stepIcon, { color: tint }]}>✓</ThemedText>
                ) : (
                  <View style={[styles.dot, { backgroundColor: icon }]} />
                )}
              </View>
              <ThemedText
                style={[
                  styles.stepLabel,
                  step.status === 'active' && { color: tint, fontWeight: '600' },
                  step.status === 'done' && { opacity: 0.5 },
                  step.status === 'pending' && { opacity: 0.4 },
                ]}
              >
                {step.label}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    borderRadius: 16,
    padding: 28,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  steps: {
    gap: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
  },
  stepIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepLabel: {
    fontSize: 15,
    flex: 1,
  },
});

import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/src/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { TimeEntry } from '@/src/db';

export interface TimeEntryCardProps {
  item: TimeEntry;
  onDelete: (id: string) => void;
}

export function TimeEntryCard({ item, onDelete }: TimeEntryCardProps) {
  const iconColor = useThemeColor({}, 'icon');

  return (
    <ThemedView
      style={styles.card}
      lightColor="#F8F9FA"
      darkColor="#1E2022"
    >
      <View style={styles.imageWrapper}>
        <View style={styles.imageClip}>
          <Image
            source={{ uri: item.file_path }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <ThemedText type="defaultSemiBold" style={styles.label}>
            Data:
          </ThemedText>
          <ThemedText type="default">{item.date}</ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText type="defaultSemiBold" style={styles.label}>
            Hora:
          </ThemedText>
          <ThemedText type="default">{item.hour}</ThemedText>
        </View>
      </View>

      <Pressable
        style={styles.deleteButton}
        onPress={() => onDelete(item.id)}
      >
        <Ionicons name="trash-outline" size={18} color={iconColor} />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  imageWrapper: {
    marginRight: 12,
  },
  imageClip: {
    width: 90,
    height: 120,
    borderRadius: 6,
    overflow: 'hidden',
  },
  image: {
    width: 90,
    height: 120,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    minWidth: 48,
  },
  deleteButton: {
    padding: 8,
  },
});

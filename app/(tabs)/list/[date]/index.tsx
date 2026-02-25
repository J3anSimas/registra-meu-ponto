import { getAllTimeEntries, TimeEntry, deleteTimeEntry } from '@/src/db';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { ThemedView } from '@/src/components/themed-view';
import { ThemedText } from '@/src/components/themed-text';
import { TimeEntryCard } from '@/src/components/time-entry-card';
import { useThemeColor } from '@/src/hooks/use-theme-color';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';

export default function DateDetailScreen() {
    const { date } = useLocalSearchParams<{ date: string }>();
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const tintColor = useThemeColor({}, 'tint');
    const router = useRouter();

    useEffect(() => {
        const loadTimeEntries = async () => {
            try {
                setIsLoading(true);
                const timeEntriesResult = await getAllTimeEntries();
                // Filter entries for the selected date
                const filteredEntries = timeEntriesResult
                    .filter(e => e.date === date)
                    .sort((a, b) => a.hour.localeCompare(b.hour));
                setEntries(filteredEntries);
            } catch (error) {
                console.error('Erro ao carregar registros:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadTimeEntries();
    }, [date]);

    async function handleDelete(id: string) {
        const entry = entries.find(e => e.id === id);

        Alert.alert(
            'Apagar registro',
            `Deseja apagar o registro das ${entry?.hour} do dia ${entry?.date}?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Apagar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteTimeEntry(id);

                            if (entry?.file_path) {
                                await FileSystem.deleteAsync(entry.file_path, { idempotent: true });
                            }

                            const remaining = entries.filter(e => e.id !== id);
                            setEntries(remaining);

                            if (remaining.length === 0) {
                                router.back();
                            }
                        } catch (error) {
                            console.error('Erro ao deletar registro:', error);
                            Alert.alert('Erro', 'Não foi possível apagar o registro.');
                        }
                    },
                },
            ]
        );
    }

    function navigateToImage(entry: TimeEntry) {
        router.push({
            pathname: '/list/[date]/[id]',
            params: { date, id: entry.id, filePath: entry.file_path, hour: entry.hour }
        });
    }

    function EmptyState() {
        return (
            <ThemedView style={styles.emptyState}>
                <ThemedText style={styles.emptyMessage}>
                    Nenhum registro para esta data.
                </ThemedText>
            </ThemedView>
        );
    }

    if (isLoading) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={tintColor} />
            </ThemedView>
        );
    }

    return (
        <>
            <Stack.Screen options={{ title: date }} />
            <ThemedView style={{ flex: 1 }}>
                <FlatList
                    data={entries}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <Pressable onPress={() => navigateToImage(item)}>
                            <TimeEntryCard item={item} onDelete={handleDelete} />
                        </Pressable>
                    )}
                    ListEmptyComponent={<EmptyState />}
                    contentContainerStyle={
                        entries.length === 0
                            ? styles.emptyContainer
                            : styles.listContainer
                    }
                />
            </ThemedView>
        </>
    );
}

const styles = StyleSheet.create({
    listContainer: {
        paddingTop: 8,
        paddingBottom: 24,
    },
    emptyContainer: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptyMessage: {
        textAlign: 'center',
        opacity: 0.7,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

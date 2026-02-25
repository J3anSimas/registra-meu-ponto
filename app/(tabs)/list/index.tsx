import { TimeEntry } from '@/src/db';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ThemedView } from '@/src/components/themed-view';
import { ThemedText } from '@/src/components/themed-text';
import { ThemedTextInput } from '@/src/components/themed-text-input';
import { useThemeColor } from '@/src/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { useTimeEntries } from '@/src/hooks/use-time-entries';

type DateGroup = { date: string; entries: TimeEntry[] };

export default function ListScreen() {
    const [searchText, setSearchText] = useState('');
    const tintColor = useThemeColor({}, 'tint');
    const iconColor = useThemeColor({}, 'icon');
    const router = useRouter();

    const { data: allEntries = [], isLoading, refetch } = useTimeEntries();

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    const dateGroups: DateGroup[] = Object.values(
        allEntries.reduce<Record<string, DateGroup>>((acc, entry) => {
            if (!acc[entry.date]) acc[entry.date] = { date: entry.date, entries: [] };
            acc[entry.date].entries.push(entry);
            return acc;
        }, {})
    );

    function navigateToDate(date: string) {
        router.push({ pathname: '/list/[date]', params: { date } });
    }

    function getFilteredGroups() {
        if (!searchText.trim()) {
            return dateGroups;
        }

        const lowerSearchText = searchText.toLowerCase();
        return dateGroups.filter(group =>
            group.date.toLowerCase().includes(lowerSearchText)
        );
    }

    function DateGroupCard({ group }: { group: DateGroup }) {
        return (
            <Pressable onPress={() => navigateToDate(group.date)}>
                <ThemedView
                    style={styles.card}
                    lightColor="#F8F9FA"
                    darkColor="#1E2022"
                >
                    <View style={styles.cardContent}>
                        <View style={styles.cardLeft}>
                            <Ionicons name="calendar-outline" size={20} color={tintColor} />
                            <ThemedText type="defaultSemiBold" style={styles.dateText}>
                                {group.date}
                            </ThemedText>
                        </View>
                        <View style={styles.cardRight}>
                            <ThemedText style={styles.countText}>
                                {group.entries.length} registro{group.entries.length !== 1 ? 's' : ''}
                            </ThemedText>
                            <Ionicons name="chevron-forward" size={18} color={iconColor} />
                        </View>
                    </View>
                </ThemedView>
            </Pressable>
        );
    }

    function EmptyState() {
        return (
            <ThemedView style={styles.emptyState}>
                <Ionicons name="time-outline" size={56} color={iconColor} />
                <ThemedText type="subtitle" style={styles.emptyTitle}>
                    Nenhum registro ainda
                </ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                    Fotografe seu cartão de ponto na aba Home para começar.
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

    const filteredGroups = getFilteredGroups();

    return (
        <ThemedView style={{ flex: 1 }}>
            <ThemedView style={styles.header}>
                <ThemedText type="title">Registros</ThemedText>
            </ThemedView>
            <ThemedView style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={iconColor} style={styles.searchIcon} />
                <ThemedTextInput
                    style={styles.searchInput}
                    placeholder="Pesquisar por data..."
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholderTextColor={iconColor}
                />
                {searchText.length > 0 && (
                    <Pressable onPress={() => setSearchText('')}>
                        <Ionicons name="close-circle" size={20} color={iconColor} />
                    </Pressable>
                )}
            </ThemedView>
            <FlatList
                data={filteredGroups}
                keyExtractor={(item) => item.date}
                renderItem={({ item }) => <DateGroupCard group={item} />}
                ListEmptyComponent={<EmptyState />}
                contentContainerStyle={
                    filteredGroups.length === 0
                        ? styles.emptyContainer
                        : styles.listContainer
                }
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 12,
        paddingHorizontal: 12,
        borderRadius: 8,
        height: 40,
        lightColor: '#F8F9FA',
        darkColor: '#1E2022',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        height: 40,
        paddingHorizontal: 0,
    },
    listContainer: {
        paddingTop: 8,
        paddingBottom: 24,
    },
    emptyContainer: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        borderRadius: 10,
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 10,
        elevation: 2,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    cardRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateText: {
        fontSize: 16,
    },
    countText: {
        opacity: 0.6,
        fontSize: 14,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptyTitle: {
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        textAlign: 'center',
        opacity: 0.7,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

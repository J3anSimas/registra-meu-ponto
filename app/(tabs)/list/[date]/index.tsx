import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { ThemedView } from '@/src/components/themed-view';
import { ThemedText } from '@/src/components/themed-text';
import { ThemedTextInput } from '@/src/components/themed-text-input';
import { TimeEntryCard } from '@/src/components/time-entry-card';
import { useThemeColor } from '@/src/hooks/use-theme-color';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { TimeEntry } from '@/src/db';
import { useTimeEntriesByDate, useDeleteTimeEntry, useUpdateTimeEntry } from '@/src/hooks/use-time-entries';

function formatDateInput(text: string): string {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatHourInput(text: string): string {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidDate(date: string): boolean {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return false;
    const [day, month, year] = date.split('/').map(Number);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const daysInMonth = new Date(year, month, 0).getDate();
    return day <= daysInMonth;
}

function isValidHour(hour: string): boolean {
    if (!/^\d{2}:\d{2}$/.test(hour)) return false;
    const [h, m] = hour.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export default function DateDetailScreen() {
    const { date } = useLocalSearchParams<{ date: string }>();
    const tintColor = useThemeColor({}, 'tint');
    const iconColor = useThemeColor({}, 'icon');
    const borderColor = useThemeColor({}, 'icon');
    const bgColor = useThemeColor({}, 'background');
    const router = useRouter();

    const { data: entries = [], isLoading } = useTimeEntriesByDate(date);
    const deleteEntryMutation = useDeleteTimeEntry();
    const updateEntryMutation = useUpdateTimeEntry();

    const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editHour, setEditHour] = useState('');

    function handleEdit(entry: TimeEntry) {
        setEditingEntry(entry);
        setEditDate(entry.date);
        setEditHour(entry.hour);
    }

    function handleCancelEdit() {
        setEditingEntry(null);
        setEditDate('');
        setEditHour('');
    }

    async function handleSaveEdit() {
        if (!editingEntry) return;

        if (!editDate || !editHour) {
            Alert.alert('Erro', 'Data e hora são obrigatórias.');
            return;
        }

        if (!isValidDate(editDate)) {
            Alert.alert('Data inválida', 'Informe a data no formato DD/MM/AAAA com valores válidos.');
            return;
        }

        if (!isValidHour(editHour)) {
            Alert.alert('Hora inválida', 'Informe a hora no formato HH:MM com valores válidos.');
            return;
        }

        try {
            await updateEntryMutation.mutateAsync({
                id: editingEntry.id,
                date: editDate,
                hour: editHour,
            });
            handleCancelEdit();
        } catch (error) {
            console.error('Erro ao atualizar registro:', error);
            Alert.alert('Erro', 'Não foi possível atualizar o registro.');
        }
    }

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
                            if (entry?.file_path) {
                                await FileSystem.deleteAsync(entry.file_path, { idempotent: true });
                            }
                            await deleteEntryMutation.mutateAsync(id);

                            const remainingCount = entries.filter(e => e.id !== id).length;
                            if (remainingCount === 0) {
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
                            <TimeEntryCard item={item} onDelete={handleDelete} onEdit={handleEdit} />
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

            <Modal
                visible={editingEntry !== null}
                transparent
                animationType="fade"
                onRequestClose={handleCancelEdit}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <Pressable style={styles.modalOverlay} onPress={handleCancelEdit}>
                        <Pressable style={[styles.modalContent, { backgroundColor: bgColor, borderColor }]} onPress={() => {}}>
                            <ThemedText type="subtitle" style={styles.modalTitle}>Editar registro</ThemedText>

                            <View style={styles.formGroup}>
                                <ThemedText style={styles.label}>Data:</ThemedText>
                                <ThemedTextInput
                                    style={[styles.input, { borderColor }]}
                                    value={editDate}
                                    onChangeText={(text) => setEditDate(formatDateInput(text))}
                                    keyboardType="numeric"
                                    maxLength={10}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <ThemedText style={styles.label}>Hora:</ThemedText>
                                <ThemedTextInput
                                    style={[styles.input, { borderColor }]}
                                    value={editHour}
                                    onChangeText={(text) => setEditHour(formatHourInput(text))}
                                    keyboardType="numeric"
                                    maxLength={5}
                                />
                            </View>

                            <View style={styles.modalButtons}>
                                <Pressable
                                    style={[styles.modalButton, { borderColor }]}
                                    onPress={handleCancelEdit}
                                >
                                    <ThemedText>Cancelar</ThemedText>
                                </Pressable>
                                <Pressable
                                    style={[styles.modalButton, { backgroundColor: tintColor }]}
                                    onPress={handleSaveEdit}
                                    disabled={updateEntryMutation.isPending}
                                >
                                    {updateEntryMutation.isPending ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <ThemedText style={styles.saveButtonText}>Salvar</ThemedText>
                                    )}
                                </Pressable>
                            </View>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        gap: 16,
    },
    modalTitle: {
        textAlign: 'center',
        marginBottom: 4,
    },
    formGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    label: {
        minWidth: 48,
    },
    input: {
        height: 40,
        flex: 1,
        borderWidth: 1,
        padding: 10,
        borderRadius: 5,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    modalButton: {
        flex: 1,
        alignItems: 'center',
        padding: 10,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});

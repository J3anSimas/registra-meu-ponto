import { ThemedText } from '@/src/components/themed-text';
import { ThemedView } from '@/src/components/themed-view';
import { useThemeColor } from '@/src/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Clipboard, Image, Pressable, StyleSheet, View } from 'react-native';

export default function ImageViewerScreen() {
    const { date, filePath, hour } = useLocalSearchParams<{
        date: string;
        filePath: string;
        hour: string;
    }>();
    const [isSharing, setIsSharing] = useState(false);
    const tintColor = useThemeColor({}, 'tint');

    async function handleShare() {
        if (!filePath) {
            Alert.alert('Erro', 'Não foi possível compartilhar a imagem');
            return;
        }

        try {
            setIsSharing(true);

            // Verify the file exists
            const fileInfo = await FileSystem.getInfoAsync(filePath);

            if (!fileInfo.exists) {
                Alert.alert('Erro', 'Arquivo de imagem não encontrado');
                setIsSharing(false);
                return;
            }

            // For sharing, we need to ensure the file is accessible
            // Copy to cache directory if needed
            const fileName = `ponto_${date?.replace(/\//g, '-')}_${hour?.replace(/:/g, '-')}.jpg`;
            const cacheDir = `${FileSystem.cacheDirectory}`;
            const shareFilePath = `${cacheDir}${fileName}`;

            // Check if file is already in cache, if not, copy it
            const cacheFileInfo = await FileSystem.getInfoAsync(shareFilePath);
            if (!cacheFileInfo.exists) {
                await FileSystem.copyAsync({
                    from: filePath,
                    to: shareFilePath,
                });
            }

            // Check if sharing is available
            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                Alert.alert('Erro', 'Compartilhamento não disponível neste dispositivo');
                setIsSharing(false);
                return;
            }

            // Copy the message to clipboard
            const message = `Meu registro de ponto de ${date} às ${hour}`;
            await Clipboard.setString(message);

            // Share the image file using expo-sharing
            await Sharing.shareAsync(shareFilePath, {
                dialogTitle: `Ponto - ${date} às ${hour}`,
                mimeType: 'image/jpeg',
                UTI: 'public.jpeg',
            });

            // Show a message that text was copied to clipboard
            Alert.alert('Texto Copiado', 'A mensagem "' + message + '" foi copiada para a área de transferência!');

            // Optional: cleanup after sharing (delayed)
            setTimeout(() => {
                FileSystem.deleteAsync(shareFilePath, { idempotent: true }).catch(() => {
                    // Ignore cleanup errors
                });
            }, 10000);
        } catch (error) {
            console.error('Erro ao compartilhar:', error);
            Alert.alert('Erro', 'Não foi possível compartilhar a imagem');
        } finally {
            setIsSharing(false);
        }
    }

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen
                options={{
                    title: date || 'Imagem',
                }}
            />
            <View style={styles.imageContainer}>
                {filePath ? (
                    <Image
                        source={{ uri: filePath }}
                        style={styles.image}
                        resizeMode="contain"
                    />
                ) : (
                    <ThemedText style={styles.errorText}>Imagem não encontrada</ThemedText>
                )}
            </View>

            <View style={styles.bottomBar}>
                <ThemedText style={styles.dateText}>{date}</ThemedText>
                <Pressable
                    style={[styles.shareButton, isSharing && styles.shareButtonDisabled]}
                    onPress={handleShare}
                    disabled={isSharing}
                >
                    {isSharing ? (
                        <ActivityIndicator size="small" color={tintColor} />
                    ) : (
                        <Ionicons name="share-social" size={20} color={tintColor} />
                    )}
                    <ThemedText style={styles.shareButtonText}>
                        {isSharing ? 'Compartilhando...' : 'Compartilhar'}
                    </ThemedText>
                </Pressable>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    imageContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    errorText: {
        color: '#fff',
        fontSize: 16,
    },
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 12,
    },
    dateText: {
        flex: 1,
        fontSize: 14,
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        lightColor: '#F8F9FA',
        darkColor: '#1E2022',
    },
    shareButtonDisabled: {
        opacity: 0.5,
    },
    shareButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

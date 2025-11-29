import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Image, Pressable, StyleSheet, View } from 'react-native';


import { ThemedText } from '@/src/components/themed-text';
import { ThemedTextInput } from '@/src/components/themed-text-input';
import { ThemedView } from '@/src/components/themed-view';
import { Asset } from "expo-asset";
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, Paths } from "expo-file-system";

import { useRef, useState } from 'react';
import MlkitOcr, { MlkitOcrResult } from 'react-native-mlkit-ocr';


const USE_MOCK = false;
// const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK_CAMERA === "true";

function fixHourFormat(rawText: string) {
    // const horaRegex = /(\d{2})[\.\:](\d{2})/;
    const horaRegex = /(\d{2})\s*[:.]\s*(\d{2})/;

    const match = rawText.match(horaRegex);

    if (match) {
        const horaCorrigida = `${match[1]}:${match[2]}`;
        return horaCorrigida;
    }
    return null;
}
function fixDateFormat(rawText: string) {
    const dataRegex = /(\d{1,2})[^\d](\d{1,2})[^\d](\d{2,4})/;
    const match = rawText.match(dataRegex);

    if (match) {
        const dataCorrigida = `${match[1]}/${match[2]}/${match[3]}`;
        return dataCorrigida;
    }
    return null;
}
async function mockTakePicture() {
    try {
        const asset = Asset.fromModule(require("../../src/assets/mock/sample.jpg"));

        await asset.downloadAsync();

        const output = new File(Paths.cache, "mock-photo.jpg");
        try {
            output.delete()
        } catch {
        }
        const source = new File(asset.localUri!);
        await source.copy(output);
        console.log('Usando imagem mock')
        return {
            uri: output.uri,
            width: asset.width ?? 1080,
            height: asset.height ?? 1920,
        };
    } catch (error) {
        console.log(error)
    }
}


export default function HomeScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView | null>(null);
    const [data, setData] = useState('');
    const [hour, setHour] = useState('');
    const [uri, setUri] = useState('');
    const [result, setResult] = useState<MlkitOcrResult | undefined>();
    const [cameraKey, setCameraKey] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    function resetData() {
        setUri('');
        setResult(undefined);
        setData('');
        setHour('');
        setCameraKey(prev => prev + 1);
        setIsLoading(false);
    }

    async function processImage(uri: string,) {
        const resultFromUri = await MlkitOcr.detectFromUri(uri);
        setResult(resultFromUri);
        const joinedLines = resultFromUri.map(block =>
            block.lines.map(line => line.text).join('')
        ).join('')
        console.log(joinedLines);
        const formattedDate = fixDateFormat(joinedLines);
        if (formattedDate) {
            setData(formattedDate);
        }
        const formattedHour = fixHourFormat(joinedLines);
        if (formattedHour) {
            console.log('Hora corrigida:', formattedHour);
            setHour(formattedHour);
        }
    }
    if (!permission) {
        return <ThemedView />;
    }

    if (!permission.granted) {
        return (
            <ThemedView style={styles.takePictureContainer}>
                <ThemedText>Precisamos de permissão para usar a câmera</ThemedText>
                <Button onPress={requestPermission} title="Permitir" />
            </ThemedView>
        );
    }
    async function handleTakePicture() {
        if (cameraRef.current && !isLoading) {
            setIsLoading(true);
            try {
                if (USE_MOCK) {
                    const photo = await mockTakePicture();
                    if (!photo) {
                        setIsLoading(false);
                        return;
                    }
                    setUri(photo.uri);
                    await processImage(photo.uri);
                } else {
                    const photo = await cameraRef.current.takePictureAsync({
                        quality: 1,
                        shutterSound: false,
                    });

                    setUri(photo.uri);
                    await processImage(photo.uri);
                }
            } catch (error) {
                console.error('Erro ao processar foto:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }


    return (
        result ? (
            <ThemedView style={styles.pictureTakenContainer}>
                <View style={styles.imageContainer}>
                    <Pressable style={styles.resetButton} onPress={resetData} >
                        <Ionicons name="refresh-outline" size={24} color="black" />
                    </Pressable>
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                </View>
                <ThemedView style={styles.form}>
                    <ThemedView style={styles.formGroup}>
                        <ThemedText>Data:</ThemedText>
                        <ThemedTextInput style={styles.input} value={data} onChangeText={setData} />
                    </ThemedView>
                    <ThemedView style={styles.formGroup}>
                        <ThemedText>Hora:</ThemedText>
                        <ThemedTextInput style={styles.input} value={hour} onChangeText={setHour} />
                    </ThemedView>
                    <Pressable style={styles.button} onPress={resetData}>
                        <ThemedText style={styles.buttonText}>Salvar</ThemedText>
                    </Pressable>
                </ThemedView>
            </ThemedView>
        ) : (
            <ThemedView style={styles.takePictureContainer}>
                <CameraView
                    key={cameraKey}
                    style={styles.camera}
                    facing="back"
                    ref={cameraRef}
                    mute={true}
                />
                {isLoading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#0a7ea4" />
                        <ThemedText style={styles.loadingText}>Processando imagem...</ThemedText>
                    </View>
                )}
                <Pressable
                    style={[styles.cameraButton, isLoading && styles.cameraButtonDisabled]}
                    onPress={handleTakePicture}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Ionicons name="camera" size={32} color="white" />
                    )}
                </Pressable>
            </ThemedView>
        )
    );
}

const styles = StyleSheet.create({
    pictureTakenContainer: {
        flexDirection: 'column',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 12
    },
    imageContainer: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: '50%',
        gap: 12
    },
    resetButton: {
        position: 'absolute',
        top: 5,
        right: 5,
        borderWidth: 1,
        borderRadius: 5,
        padding: 12,
        zIndex: 1000,
        backgroundColor: 'white'
    },
    form: {
        borderWidth: 1,
        borderRadius: 5,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 6,
        width: '100%',
        padding: 12
    },
    formGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 6,
        width: '100%',
    },
    input: {
        height: 40,
        // width: '100%',
        margin: 12,
        borderWidth: 1,
        padding: 10,
        borderRadius: 5
    },
    takePictureContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: '100%',
        height: '100%',
    },
    camera: {
        width: '100%',
        height: '100%',
    },
    buttonContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginBottom: 20,
    },
    button: {
        width: '100%',
        alignItems: 'center',
        backgroundColor: 'blue',
        padding: 10,
        borderRadius: 5,
    },
    cameraButton: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        backgroundColor: 'blue',
        borderRadius: 35,
        width: 70,
        height: 70,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    text: {
        color: 'red'
    },
    message: {
        color: 'red'
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
    },
    cameraButtonDisabled: {
        opacity: 0.5,
    },
})


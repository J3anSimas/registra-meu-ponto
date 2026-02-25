import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Button, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';


import { ThemedText } from '@/src/components/themed-text';
import { ThemedTextInput } from '@/src/components/themed-text-input';
import { ThemedView } from '@/src/components/themed-view';
import { useThemeColor } from '@/src/hooks/use-theme-color';
import { Asset } from "expo-asset";
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Directory, File, Paths } from "expo-file-system";


import { v4 } from '@/src/common/uuid';
import { createTimeEntry } from '@/src/db';
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
    const [date, setDate] = useState('');
    const [hour, setHour] = useState('');
    const [uri, setUri] = useState('');
    const [result, setResult] = useState<MlkitOcrResult | undefined>();
    const [cameraKey, setCameraKey] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const tintColor = useThemeColor({}, 'tint');
    const borderColor = useThemeColor({}, 'icon');

    function resetData() {
        setUri('');
        setResult(undefined);
        setDate('');
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
            setDate(formattedDate);
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
                    setDate('27/11/2025')
                    setHour('13:01')
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

    async function handleSave() {
        if (!date || !hour) {
            Alert.alert('Erro', 'Data e hora são obrigatórias');
            return;
        }

        if (!isValidDate(date)) {
            Alert.alert('Data inválida', 'Informe a data no formato DD/MM/AAAA com valores válidos.');
            return;
        }

        if (!isValidHour(hour)) {
            Alert.alert('Hora inválida', 'Informe a hora no formato HH:MM com valores válidos.');
            return;
        }

        if (!uri) {
            Alert.alert('Erro', 'Imagem é obrigatória');
            return;
        }

        if (isSaving) return;
        setIsSaving(true);

        try {
            const id = v4();
            // const file = new File(Paths.document, 'time_entries')
            // if (file.exists) {
            //     file.delete()

            // }
            // 1. Cria ou valida diretório
            const folder = new Directory(Paths.document, 'time_entries');

            if (!folder.exists) {
                await folder.create({
                    intermediates: true,
                    idempotent: true
                });
            }

            // 2. Define arquivo destino
            const destinationFile = new File(folder, `${id}.jpg`);

            // // Se já existir, remover
            if (destinationFile.exists) {
                await destinationFile.delete();
            }

            // 3. Arquivo origem (foto capturada)
            const sourceFile = new File(uri);

            if (!sourceFile.exists) {
                throw new Error('A imagem capturada não pôde ser localizada.');
            }

            // 4. Copiar arquivo
            await sourceFile.copy(destinationFile);

            // 5. Salvar no DB
            const timeEntry = await createTimeEntry({
                id,
                date,
                hour,
                file_path: destinationFile.uri,
                created_at: new Date(),
            });
            console.log(timeEntry)
            resetData();
            Alert.alert('Sucesso', 'Registro salvo com sucesso!');
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            Alert.alert('Erro', error?.message ?? 'Erro desconhecido ao salvar');
        } finally {
            setIsSaving(false);
        }
    }

    return (
        result ? (
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            >
                <ThemedView style={styles.pictureTakenContainer}>
                    <View style={styles.imageContainer}>
                        <Pressable style={[styles.resetButton, { backgroundColor: 'rgba(255,255,255,0.85)' }]} onPress={resetData} >
                            <Ionicons name="refresh-outline" size={24} color="black" />
                        </Pressable>
                        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                    </View>
                    <ThemedView style={[styles.form, { borderColor }]}>
                        <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.label}>Data:</ThemedText>
                            <ThemedTextInput style={styles.input} value={date} onChangeText={(text) => setDate(formatDateInput(text))} keyboardType="numeric" maxLength={10} />
                        </ThemedView>
                        <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.label}>Hora:</ThemedText>
                            <ThemedTextInput style={styles.input} value={hour} onChangeText={(text) => setHour(formatHourInput(text))} keyboardType="numeric" maxLength={5} />
                        </ThemedView>
                        <Pressable
                            style={[styles.button, { backgroundColor: tintColor }, isSaving && styles.buttonDisabled]}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <ThemedText style={styles.buttonText}>Salvar</ThemedText>
                            )}
                        </Pressable>
                    </ThemedView>
                </ThemedView>
            </KeyboardAvoidingView>
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
                    style={[styles.cameraButton, { backgroundColor: tintColor }, isLoading && styles.cameraButtonDisabled]}
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
        flex: 1,
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
    label: {
        minWidth: 48,
    },
    button: {
        width: '100%',
        alignItems: 'center',
        padding: 10,
        borderRadius: 5,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    cameraButton: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
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


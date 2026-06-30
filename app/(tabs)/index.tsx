import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Button, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { ThemedTextInput } from '@/src/components/themed-text-input';
import { ThemedView } from '@/src/components/themed-view';
import { AiLoadingOverlay } from '@/src/components/ai-loading-overlay';
import { CameraGuideOverlay, computeGuideRegion } from '@/src/components/camera-guide-overlay';
import { useThemeColor } from '@/src/hooks/use-theme-color';
import { Asset } from "expo-asset";
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Directory, File, Paths } from "expo-file-system";

import { v4 } from '@/src/common/uuid';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCreateTimeEntry } from '@/src/hooks/use-time-entries';
import { useReceiptAutodetect } from '@/src/hooks/use-receipt-autodetect';
import { extractFromImageLocally, isValidDate } from '@/src/services/ocr';
import { extractFromImageWithOpenAI } from '@/src/services/openai';
import { getOpenAISettings } from '@/src/services/settings';
import { compressForStorage, cropToGuide, preprocessForOcr } from '@/src/services/image-preprocess';


const USE_MOCK = false;
// const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK_CAMERA === "true";

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
        try { output.delete(); } catch { }
        const source = new File(asset.localUri!);
        await source.copy(output);
        return { uri: output.uri, width: asset.width ?? 1080, height: asset.height ?? 1920 };
    } catch (error) {
        console.log(error);
    }
}

type StepStatus = 'pending' | 'active' | 'done';
type Step = { label: string; status: StepStatus };

const LOCAL_STEP_LABELS = [
    'Pré-processando imagem...',
    'Executando OCR on-device...',
    'Extraindo data e hora...',
];

const OPENAI_STEP_LABELS = [
    'Pré-processando imagem...',
    'Enviando para análise...',
    'Processando resultado...',
];

function makeSteps(labels: string[], activeIndex: number): Step[] {
    return labels.map((label, i) => ({
        label,
        status: i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending',
    }));
}

function getConfiancaColor(confianca: number): string {
    if (confianca >= 80) return '#22c55e';
    if (confianca >= 50) return '#f59e0b';
    return '#ef4444';
}

// Janela de detecção automática iniciada pelo usuário. Limitada no tempo porque o polling
// de OCR é custoso (captura frame + crop + OCR a cada 250ms); 15s bastam para enquadrar o
// comprovante sem manter a câmera varrendo indefinidamente.
const SCAN_DURATION_S = 15;

export default function HomeScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView | null>(null);
    const [date, setDate] = useState('');
    const [hour, setHour] = useState('');
    const [uri, setUri] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [cameraKey, setCameraKey] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showAiLoading, setShowAiLoading] = useState(false);
    const [aiSteps, setAiSteps] = useState<Step[]>(makeSteps(LOCAL_STEP_LABELS, 0));
    const [aiConfianca, setAiConfianca] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanSecondsLeft, setScanSecondsLeft] = useState(0);
    const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopScan = useCallback(() => {
        if (scanTimerRef.current) {
            clearInterval(scanTimerRef.current);
            scanTimerRef.current = null;
        }
        setIsScanning(false);
        setScanSecondsLeft(0);
    }, []);

    // Liga a varredura automática por SCAN_DURATION_S segundos; um tick por segundo atualiza o
    // contador na UI e desliga sozinho ao chegar a zero, sem precisar de um segundo timer.
    const startScan = useCallback(() => {
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        setIsScanning(true);
        setScanSecondsLeft(SCAN_DURATION_S);
        scanTimerRef.current = setInterval(() => {
            setScanSecondsLeft(prev => {
                if (prev <= 1) {
                    if (scanTimerRef.current) {
                        clearInterval(scanTimerRef.current);
                        scanTimerRef.current = null;
                    }
                    setIsScanning(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    // Mantém a UI em portrait enquanto a Home está focada. NÃO chamamos unlockAsync
    // no cleanup: ao destravar a orientação, o expo-camera passa a produzir fotos na
    // orientação física do aparelho (landscape se inclinado), o que desalinha a guia e
    // o cropToGuide. O app.json já força "orientation": "portrait" nas demais telas.
    // Ao sair da tela paramos qualquer varredura em andamento para não vazar o timer.
    useFocusEffect(useCallback(() => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
        return () => stopScan();
    }, [stopScan]));

    const windowDims = useWindowDimensions();
    const [cameraViewSize, setCameraViewSize] = useState({ width: 0, height: 0 });
    const effectiveWidth = cameraViewSize.width || windowDims.width;
    const effectiveHeight = cameraViewSize.height || windowDims.height;
    const createEntryMutation = useCreateTimeEntry();
    const isSaving = createEntryMutation.isPending;
    const tintColor = useThemeColor({}, 'tint');
    const borderColor = useThemeColor({}, 'icon');

    // Dispara a captura a partir do autodetect. Mantida em ref porque handleTakePicture
    // só é declarada após os returns de permissão, depois dos hooks.
    const triggerCaptureRef = useRef<() => void>(() => {});
    const autodetectEnabled = isScanning && !!permission?.granted && !USE_MOCK && !isLoading && !showConfirmation;
    const { detected } = useReceiptAutodetect({
        cameraRef,
        viewWidth: effectiveWidth,
        viewHeight: effectiveHeight,
        enabled: autodetectEnabled,
        onDetected: () => triggerCaptureRef.current(),
    });

    function resetData() {
        stopScan();
        setUri('');
        setShowConfirmation(false);
        setDate('');
        setHour('');
        setCameraKey(prev => prev + 1);
        setIsLoading(false);
        setShowAiLoading(false);
        setAiConfianca(null);
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

    triggerCaptureRef.current = handleTakePicture;

    async function handleTakePicture() {
        if (cameraRef.current && !isLoading) {
            stopScan();
            setIsLoading(true);
            try {
                let photoUri: string;

                if (USE_MOCK) {
                    const photo = await mockTakePicture();
                    if (!photo) { setIsLoading(false); return; }
                    photoUri = photo.uri;
                    setUri(photoUri);
                    setDate('27/11/2025');
                    setHour('13:01');
                    setShowConfirmation(true);
                    return;
                }

                // Reafirma o lock portrait imediatamente antes de capturar. Como
                // responsiveOrientationWhenOrientationLocked é false, com a tela travada o
                // expo-camera sempre entrega a foto em portrait, alinhada à guia/crop.
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 1,
                    shutterSound: false,
                    exif: true,
                });
                const guideRegion = computeGuideRegion(effectiveWidth, effectiveHeight);
                // Passa as dimensões da view para mapear a guia (frações da tela) para os
                // pixels da foto, compensando o "cover" do preview da câmera. cropToGuide
                // corrige só paisagem (90°) via dimensão; o EXIF dá a direção do giro.
                photoUri = await cropToGuide(photo.uri, guideRegion, effectiveWidth, effectiveHeight, photo.exif?.Orientation);
                setUri(photoUri);

                const settings = await getOpenAISettings();
                const useOpenAI = settings.enabled && !!settings.apiKey;
                const stepLabels = useOpenAI ? OPENAI_STEP_LABELS : LOCAL_STEP_LABELS;

                setShowAiLoading(true);
                setAiSteps(makeSteps(stepLabels, 0));
                try {
                    const preprocessedUri = await preprocessForOcr(photoUri);
                    setAiSteps(makeSteps(stepLabels, 1));

                    if (useOpenAI) {
                        const aiResult = await extractFromImageWithOpenAI(
                            preprocessedUri,
                            settings.apiKey,
                            settings.model,
                            settings.imageQuality,
                            (step) => setAiSteps(makeSteps(stepLabels, step === 0 ? 1 : step + 1))
                        );
                        setShowAiLoading(false);
                        if (aiResult.data) setDate(aiResult.data);
                        if (aiResult.hora) setHour(aiResult.hora);
                        setAiConfianca(aiResult.confianca ?? null);
                        setShowConfirmation(true);
                    } else {
                        const ocrResult = await extractFromImageLocally(preprocessedUri);
                        setAiSteps(makeSteps(stepLabels, 2));
                        setShowAiLoading(false);
                        if (ocrResult.data) setDate(ocrResult.data);
                        if (ocrResult.hora) setHour(ocrResult.hora);
                        setAiConfianca(ocrResult.confianca);
                        setShowConfirmation(true);
                    }
                } catch (ocrError: any) {
                    console.error('OCR falhou:', ocrError);
                    setShowAiLoading(false);
                    setShowConfirmation(true);
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

        try {
            const id = v4();
            const folder = new Directory(Paths.document, 'time_entries');
            if (!folder.exists) {
                await folder.create({ intermediates: true, idempotent: true });
            }
            const destinationFile = new File(folder, `${id}.jpg`);
            if (destinationFile.exists) {
                await destinationFile.delete();
            }
            const capturedFile = new File(uri);
            if (!capturedFile.exists) {
                throw new Error('A imagem capturada não pôde ser localizada.');
            }
            const compressedUri = await compressForStorage(uri);
            const sourceFile = new File(compressedUri);
            await sourceFile.copy(destinationFile);

            const timeEntry = await createEntryMutation.mutateAsync({
                id,
                date,
                hour,
                file_path: destinationFile.uri,
                created_at: new Date(),
            });
            console.log(timeEntry);
            resetData();
            Alert.alert('Sucesso', 'Registro salvo com sucesso!');
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            Alert.alert('Erro', error?.message ?? 'Erro desconhecido ao salvar');
        }
    }

    return (
        showConfirmation ? (
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            >
                <ThemedView style={styles.pictureTakenContainer}>
                    <View style={styles.imageContainer}>
                        <Pressable style={[styles.resetButton, { backgroundColor: 'rgba(255,255,255,0.85)' }]} onPress={resetData}>
                            <Ionicons name="refresh-outline" size={24} color="black" />
                        </Pressable>
                        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                    </View>

                    {aiConfianca !== null && (
                        <View style={[styles.confiancaBadge, { backgroundColor: getConfiancaColor(aiConfianca) + '22', borderColor: getConfiancaColor(aiConfianca) }]}>
                            <ThemedText style={[styles.confiancaText, { color: getConfiancaColor(aiConfianca) }]}>
                                Confiança do OCR: {aiConfianca}%
                            </ThemedText>
                        </View>
                    )}

                    <ThemedView style={[styles.form, { borderColor }]}>
                        <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.label}>Data:</ThemedText>
                            <ThemedTextInput
                                style={styles.input}
                                value={date}
                                onChangeText={(text) => setDate(formatDateInput(text))}
                                keyboardType="numeric"
                                maxLength={10}
                            />
                        </ThemedView>
                        <ThemedView style={styles.formGroup}>
                            <ThemedText style={styles.label}>Hora:</ThemedText>
                            <ThemedTextInput
                                style={styles.input}
                                value={hour}
                                onChangeText={(text) => setHour(formatHourInput(text))}
                                keyboardType="numeric"
                                maxLength={5}
                            />
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
            <ThemedView
                style={styles.takePictureContainer}
                onLayout={(e) => setCameraViewSize({
                    width: e.nativeEvent.layout.width,
                    height: e.nativeEvent.layout.height,
                })}
            >
                <CameraView
                    key={cameraKey}
                    style={styles.camera}
                    facing="back"
                    ref={cameraRef}
                    mute={true}
                    // Foto sempre em portrait: ignora a inclinação física do aparelho
                    // enquanto a orientação da tela está travada, evitando fotos giradas.
                    responsiveOrientationWhenOrientationLocked={false}
                />
                {!isLoading && (
                    <CameraGuideOverlay
                        containerWidth={effectiveWidth}
                        containerHeight={effectiveHeight}
                        detected={detected}
                    />
                )}
                {isLoading && !showAiLoading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#0a7ea4" />
                        <ThemedText style={styles.loadingText}>Processando imagem...</ThemedText>
                    </View>
                )}
                {showAiLoading && <AiLoadingOverlay steps={aiSteps} />}
                {!isLoading && (
                    <Pressable
                        style={[styles.scanButton, { backgroundColor: isScanning ? '#ef4444' : tintColor }]}
                        onPress={isScanning ? stopScan : startScan}
                    >
                        <Ionicons name={isScanning ? 'stop-circle-outline' : 'scan-outline'} size={20} color="white" />
                        <ThemedText style={styles.scanButtonText}>
                            {isScanning ? `Detectando... ${scanSecondsLeft}s (toque para parar)` : 'Detectar automaticamente'}
                        </ThemedText>
                    </Pressable>
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
    confiancaBadge: {
        alignSelf: 'stretch',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignItems: 'center',
    },
    confiancaText: {
        fontSize: 13,
        fontWeight: '600',
    },
    fallbackBanner: {
        alignSelf: 'stretch',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    fallbackText: {
        fontSize: 12,
        flex: 1,
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
    scanButton: {
        position: 'absolute',
        bottom: 105,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 24,
    },
    scanButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
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
});

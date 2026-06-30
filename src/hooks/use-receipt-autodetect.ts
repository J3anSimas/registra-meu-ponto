import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';

import { computeGuideRegion } from '@/src/components/camera-guide-overlay';
import { cropToGuide, preprocessForScan } from '@/src/services/image-preprocess';
import { extractFromImageLocally, isValidDate } from '@/src/services/ocr';

// Espera entre o fim de uma varredura e o início da próxima. Curto de propósito: o OCR já
// serializa as varreduras (busyRef), então um intervalo grande seria só ociosidade e deixaria
// a detecção lenta. Um respiro pequeno evita martelar a câmera sem pausa.
const SCAN_INTERVAL_MS = 250;

type AutoDetectParams = {
  cameraRef: React.RefObject<CameraView | null>;
  viewWidth: number;
  viewHeight: number;
  // Liga/desliga o loop. Deve ser false durante captura/confirmação e fora de foco.
  enabled: boolean;
  // Chamado UMA vez quando o comprovante é detectado de forma estável.
  onDetected: () => void;
};

function deleteQuietly(uri: string | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Limpeza best-effort: arquivos de varredura vivem no cache e somem com o SO.
  }
}

/**
 * Detecta automaticamente um comprovante legível no preview da câmera.
 *
 * Como o expo-camera não expõe frame processor contínuo, fazemos polling: a cada
 * SCAN_INTERVAL_MS capturamos um frame leve, recortamos pela guia e rodamos o OCR local.
 * Só disparamos quando DUAS leituras seguidas concordam na mesma data+hora — isso descarta
 * frames borrados e evita captura prematura enquanto o usuário ainda enquadra.
 *
 * @example const { detected } = useReceiptAutodetect({ cameraRef, viewWidth, viewHeight, enabled, onDetected: handleTakePicture })
 */
export function useReceiptAutodetect(params: AutoDetectParams): { detected: boolean } {
  const { cameraRef, viewWidth, viewHeight, enabled, onDetected } = params;
  const [detected, setDetected] = useState(false);

  // Mantém o callback em ref para o loop não reiniciar a cada render do componente pai.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const lastReadingRef = useRef<string | null>(null);
  const triggeredRef = useRef(false);
  const busyRef = useRef(false);
  const scanCountRef = useRef(0);

  const scanOnce = useCallback(async () => {
    if (busyRef.current || triggeredRef.current || !cameraRef.current) {
      console.log('[autodetect] scan pulado', {
        busy: busyRef.current,
        triggered: triggeredRef.current,
        hasCamera: !!cameraRef.current,
      });
      return;
    }
    busyRef.current = true;
    const scanId = ++scanCountRef.current;
    const startedAt = Date.now();
    let photoUri: string | undefined;
    let croppedUri: string | undefined;
    let preprocessedUri: string | undefined;
    try {
      console.log(`[autodetect] #${scanId} capturando frame`, { viewWidth, viewHeight });
      // Sem skipProcessing: assim o frame chega em portrait (igual ao caminho manual),
      // mantendo o cropToGuide alinhado à guia. quality baixa basta para o OCR de varredura.
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        shutterSound: false,
        exif: true,
      });
      if (!photo) {
        console.log(`[autodetect] #${scanId} takePictureAsync retornou vazio`);
        return;
      }
      photoUri = photo.uri;
      const capturedAt = Date.now();
      console.log(`[autodetect] #${scanId} frame capturado (${capturedAt - startedAt}ms)`, {
        photoW: photo.width,
        photoH: photo.height,
        exif: photo.exif?.Orientation,
      });

      const guideRegion = computeGuideRegion(viewWidth, viewHeight);
      croppedUri = await cropToGuide(photo.uri, guideRegion, viewWidth, viewHeight, photo.exif?.Orientation);
      preprocessedUri = await preprocessForScan(croppedUri);
      const result = await extractFromImageLocally(preprocessedUri);
      console.log(`[autodetect] #${scanId} OCR (captura ${capturedAt - startedAt}ms + proc/ocr ${Date.now() - capturedAt}ms)`, {
        data: result.data,
        hora: result.hora,
        confianca: result.confianca,
        rawText: result.rawText.slice(0, 200),
      });

      // Gatilho pela DATA, não pela hora: nos testes a hora oscila entre frames (lida em
      // ~1/3 deles), enquanto a data sai estável. A varredura só confirma "há um comprovante
      // legível enquadrado"; data+hora precisas saem da captura final em alta qualidade.
      //
      // Frame sem data válida é IGNORADO sem zerar o progresso: o OCR cospe leituras absurdas
      // pontuais (ex.: "00/00/1400") que, se resetassem, atrasariam a confirmação de 2 frames.
      if (!result.data || !isValidDate(result.data)) {
        console.log(`[autodetect] #${scanId} sem data válida ("${result.data}") — ignorando frame`);
        return;
      }

      const reading = result.data;
      if (lastReadingRef.current === reading) {
        console.log(`[autodetect] #${scanId} DETECTADO (mesma data em 2 leituras): ${reading} — disparando captura`);
        triggeredRef.current = true;
        setDetected(true);
        onDetectedRef.current();
        return;
      }
      console.log(`[autodetect] #${scanId} 1ª leitura data="${reading}" — aguardando confirmação na próxima`);
      lastReadingRef.current = reading;
    } catch (error) {
      // Varredura é best-effort; um frame ruim não deve quebrar o loop.
      console.log(`[autodetect] #${scanId} erro na varredura:`, error);
      lastReadingRef.current = null;
    } finally {
      deleteQuietly(photoUri);
      deleteQuietly(croppedUri);
      deleteQuietly(preprocessedUri);
      busyRef.current = false;
    }
  }, [cameraRef, viewWidth, viewHeight]);

  useEffect(() => {
    if (!enabled || viewWidth === 0 || viewHeight === 0) {
      console.log('[autodetect] loop OFF', { enabled, viewWidth, viewHeight });
      lastReadingRef.current = null;
      triggeredRef.current = false;
      setDetected(false);
      return;
    }

    console.log('[autodetect] loop ON', { viewWidth, viewHeight, intervalMs: SCAN_INTERVAL_MS });
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (!active) return;
      await scanOnce();
      if (active && !triggeredRef.current) timer = setTimeout(loop, SCAN_INTERVAL_MS);
    };
    loop();

    return () => {
      console.log('[autodetect] loop cleanup');
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, viewWidth, viewHeight, scanOnce]);

  return { detected };
}

import { Skia, type SkImage } from '@shopify/react-native-skia';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import type { GuideRegion } from '@/src/components/camera-guide-overlay';

const GRAYSCALE_MATRIX = [
  0.299, 0.587, 0.114, 0, 0,
  0.299, 0.587, 0.114, 0, 0,
  0.299, 0.587, 0.114, 0, 0,
  0, 0, 0, 1, 0,
];

function contrastMatrix(factor: number): number[] {
  const offset = 0.5 - 0.5 * factor;
  return [
    factor, 0, 0, 0, offset,
    0, factor, 0, 0, offset,
    0, 0, factor, 0, offset,
    0, 0, 0, 1, 0,
  ];
}

/**
 * Aplica a orientação EXIF aos pixels e devolve uma cópia com EXIF neutro ("baked").
 *
 * Necessário porque o Skia decodifica de forma ambígua entre aparelhos (uns consomem a
 * tag EXIF, outros não) e porque a heurística por dimensão de `reorientToUpright` não
 * detecta rotação de 180° — a foto continua portrait, só de cabeça para baixo. O
 * expo-image-manipulator achata a orientação de forma determinística ao re-encodar,
 * cobrindo 90° e 180° em qualquer aparelho.
 *
 * @example const upright = await normalizeOrientation(photo.uri)
 */
export async function normalizeOrientation(uri: string): Promise<string> {
    const result = await manipulateAsync(uri, [], { compress: 1, format: SaveFormat.JPEG });
    return result.uri;
}

/**
 * Garante que a imagem decodificada fique em portrait ("upright").
 *
 * Decisão baseada na DIMENSÃO que o Skia realmente decodificou, não na tag EXIF: em
 * alguns aparelhos o Skia já consome o EXIF e devolve a imagem de pé (3060×4080), então
 * reaplicar a rotação da tag a deitaria de novo. Como o comprovante é sempre fotografado
 * com o telefone em pé, o alvo é portrait — só corrigimos quando vier em paisagem.
 *
 * A tag EXIF é usada apenas para escolher a direção do giro de 90° (8 = anti-horário;
 * 6/ausente = horário, o caso comum da câmera traseira).
 *
 * @example reorientToUpright(landscapeImage, 6) // devolve a imagem girada para portrait
 */
function reorientToUpright(image: SkImage, exifOrientation?: number): SkImage {
    const w = image.width();
    const h = image.height();
    if (w <= h) return image; // já está em portrait — nada a fazer

    const dstW = h;
    const dstH = w;
    const surface = Skia.Surface.MakeOffscreen(dstW, dstH);
    if (!surface) throw new Error(`Falha ao alocar superfície de reorientação (orientation=${exifOrientation ?? 'n/a'}).`);
    const canvas = surface.getCanvas();

    if (exifOrientation === 8) {
        canvas.translate(0, dstH);
        canvas.rotate(270, 0, 0);
    } else {
        canvas.translate(dstW, 0);
        canvas.rotate(90, 0, 0);
    }
    canvas.drawImage(image, 0, 0);
    return surface.makeImageSnapshot();
}

export async function cropToGuide(uri: string, region: GuideRegion, exifOrientation?: number): Promise<string> {
    const data = await Skia.Data.fromURI(uri);
    const decoded = Skia.Image.MakeImageFromEncoded(data);
    if (!decoded) throw new Error('Não foi possível decodificar a imagem para crop.');

    // Garante pixels upright antes de aplicar as frações da guia (calculadas em portrait).
    const image = reorientToUpright(decoded, exifOrientation);

    const srcW = image.width();
    const srcH = image.height();
    const cropX = Math.round(srcW * region.leftFraction);
    const cropY = Math.round(srcH * region.topFraction);
    const cropW = Math.round(srcW * region.widthFraction);
    const cropH = Math.round(srcH * region.heightFraction);

    const surface = Skia.Surface.MakeOffscreen(cropW, cropH);
    if (!surface) throw new Error('Falha ao alocar superfície de crop.');

    const canvas = surface.getCanvas();
    canvas.drawImageRect(image, Skia.XYWHRect(cropX, cropY, cropW, cropH), Skia.XYWHRect(0, 0, cropW, cropH), Skia.Paint());

    const bytes = surface.makeImageSnapshot().encodeToBytes();
    const outFile = new File(Paths.cache, `ocr-cropped-${Date.now()}.png`);
    if (outFile.exists) outFile.delete();
    outFile.create();
    outFile.write(bytes);
    return outFile.uri;
}

export async function preprocessForOcr(uri: string): Promise<string> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    throw new Error('Não foi possível decodificar a imagem.');
  }

  const srcW = image.width();
  const srcH = image.height();
  const maxDim = Math.max(srcW, srcH);
  const scale = maxDim < 1500 ? 2 : 1;
  const dstW = Math.round(srcW * scale);
  const dstH = Math.round(srcH * scale);

  const surface = Skia.Surface.MakeOffscreen(dstW, dstH);
  if (!surface) {
    throw new Error('Falha ao alocar superfície de pré-processamento.');
  }

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  const grayFilter = Skia.ColorFilter.MakeMatrix(GRAYSCALE_MATRIX);
  const contrastFilter = Skia.ColorFilter.MakeMatrix(contrastMatrix(1.6));
  paint.setColorFilter(Skia.ColorFilter.MakeCompose(contrastFilter, grayFilter));

  const srcRect = Skia.XYWHRect(0, 0, srcW, srcH);
  const dstRect = Skia.XYWHRect(0, 0, dstW, dstH);
  canvas.drawImageRect(image, srcRect, dstRect, paint);

  const snapshot = surface.makeImageSnapshot();
  const bytes = snapshot.encodeToBytes();

  const outFile = new File(Paths.cache, `ocr-preprocessed-${Date.now()}.png`);
  if (outFile.exists) {
    outFile.delete();
  }
  outFile.create();
  outFile.write(bytes);

  return outFile.uri;
}

import { Skia } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

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

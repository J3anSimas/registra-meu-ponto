import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

// Dimensões físicas do comprovante: 5.7 cm (largura) × 4.6 cm (altura)
const RECEIPT_RATIO = 5.7 / 4.6;
const GUIDE_WIDTH_FRACTION = 0.82;
const CORNER_SIZE = 26;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = '#ffffff';
const MASK_COLOR = 'rgba(0,0,0,0.55)';

export type GuideRegion = {
    leftFraction: number;
    topFraction: number;
    widthFraction: number;
    heightFraction: number;
};

export function computeGuideRegion(containerWidth: number, containerHeight: number): GuideRegion {
    const guideWidth = containerWidth * GUIDE_WIDTH_FRACTION;
    const guideHeight = guideWidth / RECEIPT_RATIO;
    const sideMargin = (containerWidth - guideWidth) / 2;
    const topMargin = (containerHeight - guideHeight) / 2 - 30;
    return {
        leftFraction: sideMargin / containerWidth,
        topFraction: topMargin / containerHeight,
        widthFraction: GUIDE_WIDTH_FRACTION,
        heightFraction: guideHeight / containerHeight,
    };
}

type CameraGuideOverlayProps = {
    containerWidth?: number;
    containerHeight?: number;
};

export function CameraGuideOverlay({ containerWidth, containerHeight }: CameraGuideOverlayProps) {
    const windowDims = useWindowDimensions();
    const screenWidth = containerWidth || windowDims.width;
    const screenHeight = containerHeight || windowDims.height;

    const guideWidth = screenWidth * GUIDE_WIDTH_FRACTION;
    const guideHeight = guideWidth / RECEIPT_RATIO;
    const sideMargin = (screenWidth - guideWidth) / 2;
    // Desloca ligeiramente para cima para deixar espaço ao botão da câmera
    const topMargin = (screenHeight - guideHeight) / 2 - 30;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={{ height: topMargin, backgroundColor: MASK_COLOR }} />

            <View style={{ flexDirection: 'row', height: guideHeight }}>
                <View style={{ width: sideMargin, backgroundColor: MASK_COLOR }} />

                <View style={{ width: guideWidth, height: guideHeight }}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                </View>

                <View style={{ width: sideMargin, backgroundColor: MASK_COLOR }} />
            </View>

            <View style={styles.bottomMask}>
                <Text style={styles.hint}>
                    Centralize o comprovante
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    bottomMask: {
        flex: 1,
        backgroundColor: MASK_COLOR,
        alignItems: 'center',
        paddingTop: 14,
    },
    corner: {
        position: 'absolute',
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderColor: CORNER_COLOR,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: CORNER_THICKNESS,
        borderLeftWidth: CORNER_THICKNESS,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: CORNER_THICKNESS,
        borderRightWidth: CORNER_THICKNESS,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: CORNER_THICKNESS,
        borderLeftWidth: CORNER_THICKNESS,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: CORNER_THICKNESS,
        borderRightWidth: CORNER_THICKNESS,
    },
    hint: {
        color: '#ffffff',
        fontSize: 13,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
});

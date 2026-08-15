import React from 'react';
import { resolvePlaceholders, generateBarcodeDataUrl } from '../utils/barcodeRenderer';

const MM_TO_PX = 96 / 25.4;

const LabelElementRenderer = ({
    element,
    productData = {},
    isSelected = false,
    isEditor = false,
    onMouseDown = null,
    onResizeMouseDown = null
}) => {
    const el = element;
    if (!el) return null;

    const resolvedText = resolvePlaceholders(el.text || '', productData);

    const alignJustify = el.align === 'center' ? 'center' : (el.align === 'right' ? 'flex-end' : 'flex-start');

    return (
        <div
            className={`canvas-element-node ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}`}
            style={{
                position: 'absolute',
                left: `${el.x || 0}mm`,
                top: `${el.y || 0}mm`,
                width: `${el.width || 10}mm`,
                height: `${el.height || 5}mm`,
                transform: `rotate(${el.rotation || 0}deg)`,
                zIndex: el.zIndex || 1,
                pointerEvents: isEditor ? 'auto' : 'none',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: alignJustify
            }}
            onMouseDown={(e) => isEditor && onMouseDown && onMouseDown(e, el)}
        >
            {/* TEXT ELEMENT */}
            {el.type === 'text' && (
                <div
                    style={{
                        width: el.autoWidth ? 'auto' : '100%',
                        minWidth: el.autoWidth ? 'max-content' : '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: alignJustify,
                        textAlign: el.align || 'left',
                        fontFamily: el.fontFamily ? `${el.fontFamily}, sans-serif` : 'Arial, Helvetica, sans-serif',
                        fontSize: `${el.fontSize || 10}pt`,
                        fontWeight: el.fontWeight || 'bold',
                        fontStyle: el.fontStyle || 'normal',
                        textDecoration: el.textDecoration || 'none',
                        color: el.color || '#000000',
                        letterSpacing: `${el.letterSpacing || 0}px`,
                        lineHeight: el.lineHeight || 1.1,
                        whiteSpace: 'nowrap',
                        overflow: el.autoWidth ? 'visible' : 'hidden',
                        textOverflow: 'ellipsis',
                        border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || '#000000'}` : 'none',
                        borderRadius: `${el.borderRadius || 0}px`,
                        padding: el.padding ? `${el.padding}mm` : 0,
                        backgroundColor: el.backgroundColor || 'transparent',
                        wordBreak: 'break-word',
                        boxSizing: 'border-box'
                    }}
                >
                    {resolvedText || 'Sample Text'}
                </div>
            )}

            {/* BARCODE ELEMENT */}
            {el.type === 'barcode' && (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                    <img
                        src={generateBarcodeDataUrl(resolvedText, el.format || 'code128', {
                            showText: false,
                            barHeight: el.barHeight || 12,
                            color: el.color || '#000000',
                            scale: 4
                        })}
                        alt="barcode"
                        style={{ width: '100%', flex: 1, maxHeight: `${el.barHeight || 12}mm`, objectFit: 'contain', pointerEvents: 'none' }}
                    />
                    {el.showText !== false && (
                        <div
                            style={{
                                marginTop: `${el.textMargin ?? 2}pt`,
                                fontSize: `${el.textSize || 10}pt`,
                                fontWeight: el.textWeight === 'black' ? 900 : el.textWeight === 'extrabold' ? 800 : el.textWeight === 'semibold' ? 600 : el.textWeight === 'medium' ? 500 : el.textWeight === 'normal' ? 400 : 700,
                                fontFamily: el.textFont === 'OCR-B' ? 'monospace, "Courier New", sans-serif' : el.textFont === 'Courier' ? 'monospace' : el.textFont || 'sans-serif',
                                color: el.color || '#000000',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                lineHeight: 1.1,
                                letterSpacing: '0.5px',
                                width: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            {resolvedText || '123456789'}
                        </div>
                    )}
                </div>
            )}

            {/* QR CODE ELEMENT */}
            {el.type === 'qrcode' && (
                <img
                    src={generateBarcodeDataUrl(resolvedText, 'qrcode', { scale: 4 })}
                    alt="qr"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                />
            )}

            {/* RECTANGLE */}
            {(el.type === 'rectangle' || (el.type === 'shape' && el.shapeType === 'rect')) && (
                <div style={{
                    width: '100%',
                    height: '100%',
                    background: el.background || el.fillColor || 'transparent',
                    border: `${el.borderWidth || 1}px solid ${el.borderColor || '#000000'}`,
                    borderRadius: `${el.borderRadius || 0}px`
                }} />
            )}

            {/* CIRCLE */}
            {(el.type === 'circle' || (el.type === 'shape' && el.shapeType === 'circle')) && (
                <div style={{
                    width: '100%',
                    height: '100%',
                    background: el.background || el.fillColor || 'transparent',
                    border: `${el.borderWidth || 1}px solid ${el.borderColor || '#000000'}`,
                    borderRadius: '50%'
                }} />
            )}

            {/* IMAGE */}
            {el.type === 'image' && (
                <img
                    src={el.src || '/Salescope.png'}
                    alt="element"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                />
            )}

            {/* RESIZE HANDLES FOR SELECTED UNLOCKED ELEMENT IN EDITOR MODE */}
            {isEditor && isSelected && !el.locked && onResizeMouseDown && (
                <>
                    <div className="resize-handle resize-se" onMouseDown={(e) => onResizeMouseDown(e, el, 'se')} />
                    <div className="resize-handle resize-sw" onMouseDown={(e) => onResizeMouseDown(e, el, 'sw')} />
                    <div className="resize-handle resize-ne" onMouseDown={(e) => onResizeMouseDown(e, el, 'ne')} />
                    <div className="resize-handle resize-nw" onMouseDown={(e) => onResizeMouseDown(e, el, 'nw')} />
                </>
            )}
        </div>
    );
};

export default LabelElementRenderer;

import React, { useRef, useState, useEffect } from 'react';
import { resolvePlaceholders, generateBarcodeDataUrl } from '../utils/barcodeRenderer';

const CanvasEditor = ({
    preset,
    elements,
    selectedId,
    setSelectedId,
    onUpdateElement,
    zoom,
    showGrid,
    sampleProduct,
    canvasRef
}) => {
    const labelWidthMm = preset.label_width || 50;
    const labelHeightMm = preset.label_height || 25;

    // Convert mm to pixels at 96 DPI scale (1mm ≈ 3.7795px)
    const MM_TO_PX = 3.7795;
    const canvasWidthPx = labelWidthMm * MM_TO_PX;
    const canvasHeightPx = labelHeightMm * MM_TO_PX;

    const [draggingId, setDraggingId] = useState(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [elementStart, setElementStart] = useState({ x: 0, y: 0 });

    const [resizingId, setResizingId] = useState(null);
    const [resizeHandle, setResizeHandle] = useState(null);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

    // Keydown for keyboard movement (Arrow keys)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selectedId) return;
            const targetTag = e.target.tagName.toLowerCase();
            if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') return;

            const element = elements.find(el => el.id === selectedId);
            if (!element || element.locked) return;

            const step = e.shiftKey ? 1.0 : 0.2; // mm
            let dx = 0;
            let dy = 0;

            if (e.key === 'ArrowLeft') dx = -step;
            else if (e.key === 'ArrowRight') dx = step;
            else if (e.key === 'ArrowUp') dy = -step;
            else if (e.key === 'ArrowDown') dy = step;

            if (dx !== 0 || dy !== 0) {
                e.preventDefault();
                onUpdateElement(selectedId, {
                    x: Math.max(0, Math.min(labelWidthMm - element.width, element.x + dx)),
                    y: Math.max(0, Math.min(labelHeightMm - element.height, element.y + dy))
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedId, elements, labelWidthMm, labelHeightMm, onUpdateElement]);

    // Drag start
    const handleMouseDown = (e, el) => {
        if (el.locked) {
            setSelectedId(el.id);
            return;
        }
        e.stopPropagation();
        setSelectedId(el.id);
        setDraggingId(el.id);
        setDragStart({ x: e.clientX, y: e.clientY });
        setElementStart({ x: el.x, y: el.y });
    };

    // Resize start
    const handleResizeMouseDown = (e, el, handle) => {
        e.stopPropagation();
        setResizingId(el.id);
        setResizeHandle(handle);
        setResizeStart({ x: e.clientX, y: e.clientY, w: el.width, h: el.height, posX: el.x, posY: el.y });
    };

    // Mouse Move for Drag & Resize
    const handleMouseMove = (e) => {
        if (draggingId) {
            const dxMm = (e.clientX - dragStart.x) / (MM_TO_PX * zoom);
            const dyMm = (e.clientY - dragStart.y) / (MM_TO_PX * zoom);

            const newX = Math.round((elementStart.x + dxMm) * 10) / 10;
            const newY = Math.round((elementStart.y + dyMm) * 10) / 10;

            onUpdateElement(draggingId, {
                x: Math.max(0, newX),
                y: Math.max(0, newY)
            });
        } else if (resizingId) {
            const dxMm = (e.clientX - resizeStart.x) / (MM_TO_PX * zoom);
            const dyMm = (e.clientY - resizeStart.y) / (MM_TO_PX * zoom);

            let newW = resizeStart.w;
            let newH = resizeStart.h;

            if (resizeHandle.includes('e')) newW = Math.max(2, resizeStart.w + dxMm);
            if (resizeHandle.includes('s')) newH = Math.max(2, resizeStart.h + dyMm);

            onUpdateElement(resizingId, {
                width: Math.round(newW * 10) / 10,
                height: Math.round(newH * 10) / 10
            });
        }
    };

    const handleMouseUp = () => {
        setDraggingId(null);
        setResizingId(null);
    };

    const layoutCols = preset.page_layout?.cols || 1;
    const gapHPx = (preset.page_layout?.gapH || 0) * MM_TO_PX;

    return (
        <div
            className="designer-canvas-viewport custom-scrollbar"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={() => setSelectedId(null)}
        >
            <div className="canvas-stage">
                <div style={{ display: 'flex', alignItems: 'center', gap: `${gapHPx * zoom}px` }}>
                    {Array.from({ length: layoutCols }).map((_, colIdx) => {
                        const isMainEditor = colIdx === 0;
                        let extraX = 0;
                        let extraY = 0;

                        if (colIdx === 1) {
                            extraX = preset.page_layout?.col2OffsetX || 0;
                            extraY = preset.page_layout?.col2OffsetY || 0;
                        } else if (colIdx === 2) {
                            extraX = preset.page_layout?.col3OffsetX || 0;
                            extraY = preset.page_layout?.col3OffsetY || 0;
                        }

                        return (
                            <div
                                key={colIdx}
                                ref={isMainEditor ? canvasRef : null}
                                className={`label-canvas-artboard ${!isMainEditor ? 'replica-artboard' : ''}`}
                                style={{
                                    width: `${canvasWidthPx}px`,
                                    height: `${canvasHeightPx}px`,
                                    transform: `scale(${zoom})`,
                                    borderRadius: `${preset.corner_radius || 0}mm`,
                                    opacity: isMainEditor ? 1 : 0.88,
                                    position: 'relative',
                                    left: extraX ? `${extraX * MM_TO_PX * zoom}px` : '0px',
                                    top: extraY ? `${extraY * MM_TO_PX * zoom}px` : '0px',
                                    transition: 'left 0.05s ease-out, top 0.05s ease-out'
                                }}
                            >
                                {isMainEditor && showGrid && <div className="canvas-grid-lines" />}
                                {!isMainEditor && (
                                    <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(59,130,246,0.8)', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', zIndex: 10 }}>
                                        Sticker {colIdx + 1} (2-Up Roll)
                                    </div>
                                )}

                                {elements.map((el) => {
                                    const isSelected = isMainEditor && selectedId === el.id;
                                    const xPx = el.x * MM_TO_PX;
                                    const yPx = el.y * MM_TO_PX;
                                    const wPx = el.width * MM_TO_PX;
                                    const hPx = el.height * MM_TO_PX;

                                    const resolvedText = resolvePlaceholders(el.text || '', sampleProduct);

                                    return (
                                        <div
                                            key={el.id}
                                            className={`canvas-element-node ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}`}
                                            style={{
                                                left: `${xPx}px`,
                                                top: `${yPx}px`,
                                                width: `${wPx}px`,
                                                height: `${hPx}px`,
                                                transform: `rotate(${el.rotation || 0}deg)`,
                                                zIndex: el.zIndex || 1,
                                                pointerEvents: isMainEditor ? 'auto' : 'none'
                                            }}
                                            onMouseDown={(e) => isMainEditor && handleMouseDown(e, el)}
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
                                                        justifyContent: el.align === 'center' ? 'center' : (el.align === 'right' ? 'flex-end' : 'flex-start'),
                                                        fontFamily: el.fontFamily || 'sans-serif',
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
                                                        padding: el.padding ? `${el.padding * MM_TO_PX}px` : 0,
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
                                            {el.type === 'rectangle' && (
                                                <div style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    background: el.background || 'transparent',
                                                    border: `${el.borderWidth || 1}px solid ${el.borderColor || '#000000'}`,
                                                    borderRadius: `${el.borderRadius || 0}px`
                                                }} />
                                            )}

                                            {/* CIRCLE */}
                                            {el.type === 'circle' && (
                                                <div style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    background: el.background || 'transparent',
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

                                            {/* RESIZE HANDLES FOR SELECTED UNLOCKED ELEMENT */}
                                            {isSelected && !el.locked && (
                                                <>
                                                    <div className="resize-handle resize-se" onMouseDown={(e) => handleResizeMouseDown(e, el, 'se')} />
                                                    <div className="resize-handle resize-sw" onMouseDown={(e) => handleResizeMouseDown(e, el, 'sw')} />
                                                    <div className="resize-handle resize-ne" onMouseDown={(e) => handleResizeMouseDown(e, el, 'ne')} />
                                                    <div className="resize-handle resize-nw" onMouseDown={(e) => handleResizeMouseDown(e, el, 'nw')} />
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default CanvasEditor;

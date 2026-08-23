import React, { useRef, useState, useEffect } from 'react';
import LabelElementRenderer from './LabelElementRenderer';

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

    // Convert mm to pixels at 96 DPI scale (1mm = 96/25.4 px)
    const MM_TO_PX = 96 / 25.4;
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

    return (
        <div
            className="designer-canvas-viewport custom-scrollbar"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={() => setSelectedId(null)}
        >
            <div className="canvas-stage">
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: `${preset.page_layout?.gapH || 0}mm`,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease-out'
                }}>
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
                                    width: `${labelWidthMm}mm`,
                                    height: `${labelHeightMm}mm`,
                                    borderRadius: `${preset.corner_radius || 0}mm`,
                                    opacity: isMainEditor ? 1 : 0.88,
                                    position: 'relative',
                                    left: extraX ? `${extraX}mm` : '0mm',
                                    top: extraY ? `${extraY}mm` : '0mm',
                                    transition: 'left 0.05s ease-out, top 0.05s ease-out'
                                }}
                            >
                                {isMainEditor && showGrid && <div className="canvas-grid-lines" />}
                                {!isMainEditor && (
                                    <div style={{ position: 'absolute', top: '-24px', right: '0px', background: 'var(--primary, rgba(59,130,246,0.8))', color: '#fff', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', zIndex: 10, whiteSpace: 'nowrap' }}>
                                        Sticker {colIdx + 1} Replica
                                    </div>
                                )}

                                {elements.map((el) => (
                                    <LabelElementRenderer
                                        key={el.id}
                                        element={el}
                                        productData={{ product: sampleProduct, store: sampleProduct?.store }}
                                        isSelected={isMainEditor && selectedId === el.id}
                                        isEditor={isMainEditor}
                                        onMouseDown={handleMouseDown}
                                        onResizeMouseDown={handleResizeMouseDown}
                                    />
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default CanvasEditor;

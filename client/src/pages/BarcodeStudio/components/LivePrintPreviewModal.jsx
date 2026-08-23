import React, { useRef } from 'react';
import { X, Printer, Download, Eye } from 'lucide-react';
import { isElementVisible } from '../utils/barcodeRenderer';
import { exportAsPDF, getPrintPageStyle } from '../utils/printEngine';
import LabelElementRenderer from './LabelElementRenderer';

const LivePrintPreviewModal = ({
    isOpen,
    onClose,
    preset,
    presets,
    onSelectPreset,
    printerProfile,
    queue,
    storeInfo
}) => {
    const printContainerRef = useRef(null);

    if (!isOpen) return null;

    const isSheet = preset.paper_type === 'sheet';
    const labelW = preset.label_width || 50;
    const labelH = preset.label_height || 25;
    const layout = preset.page_layout || {};

    const cols = layout.cols || (isSheet ? 3 : 1);
    const rows = isSheet ? (layout.rows || 8) : 1;
    const labelsPerPage = cols * rows;

    const totalRollW = (cols * labelW) + ((cols - 1) * (layout.gapH || 0)) + (layout.marginLeft || 0) + (layout.marginRight || 0);

    // Expand queue into individual label items array according to printQty
    const expandedLabels = queue.flatMap(item => {
        const qty = Number(item.printQty) || 1;
        return Array(qty).fill(item);
    });

    // Group labels into pages (or thermal roll rows)
    const pages = [];
    for (let i = 0; i < expandedLabels.length; i += labelsPerPage) {
        pages.push(expandedLabels.slice(i, i + labelsPerPage));
    }

    const handlePrintNow = () => {
        if (!printContainerRef.current) return;

        // 1. Clean up existing mount if present
        let printMount = document.getElementById('barcode-print-mount');
        if (printMount) {
            printMount.remove();
        }

        // 2. Create isolated root print container
        printMount = document.createElement('div');
        printMount.id = 'barcode-print-mount';
        printMount.innerHTML = printContainerRef.current.innerHTML;
        document.body.appendChild(printMount);

        // 3. Inject print CSS
        const styleText = getPrintPageStyle(preset, printerProfile);
        const styleEl = document.createElement('style');
        styleEl.id = 'barcode-print-style';
        styleEl.type = 'text/css';
        styleEl.appendChild(document.createTextNode(styleText));
        document.head.appendChild(styleEl);

        // 4. Trigger browser print
        window.print();

        // 5. Clean up temporary mount and styles
        setTimeout(() => {
            if (printMount && printMount.parentNode) {
                printMount.parentNode.removeChild(printMount);
            }
            if (styleEl && styleEl.parentNode) {
                styleEl.parentNode.removeChild(styleEl);
            }
        }, 1000);
    };

    return (
        <div className="studio-modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            boxSizing: 'border-box'
        }}>
            <div className="studio-modal-card" style={{ maxWidth: '1050px', height: '90vh' }}>
                <div className="studio-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <Eye size={20} className="text-primary" />
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Live Print Preview ({expandedLabels.length} Labels)</h3>

                        {presets && presets.length > 0 && (
                            <select
                                className="prop-input"
                                style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: '#1e293b', borderColor: 'var(--primary)', color: '#60a5fa', fontWeight: 700, borderRadius: '6px', cursor: 'pointer' }}
                                value={preset?.id || ''}
                                onChange={(e) => {
                                    const found = presets.find(p => String(p.id) === String(e.target.value));
                                    if (found && onSelectPreset) onSelectPreset(found);
                                }}
                            >
                                {presets.map(p => (
                                    <option key={p.id} value={p.id}>
                                        📋 {p.name} ({p.label_width}×{p.label_height}mm)
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => exportAsPDF(printContainerRef.current, preset)}>
                            <Download size={16} style={{ marginRight: '4px' }} /> PDF
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handlePrintNow} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                            <Printer size={16} style={{ marginRight: '6px' }} /> Print Now
                        </button>
                        <button type="button" className="btn-icon" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="studio-modal-body custom-scrollbar" style={{ background: '#090d16', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                    <div ref={printContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {pages.map((pageItems, pageIdx) => (
                            <div
                                key={pageIdx}
                                className="print-page-unit"
                                style={{
                                    width: isSheet ? '210mm' : `${totalRollW}mm`,
                                    height: isSheet ? '297mm' : `${labelH}mm`,
                                    background: '#ffffff',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                    paddingTop: `${layout.marginTop || (isSheet ? 10 : 0)}mm`,
                                    paddingLeft: `${layout.marginLeft || (isSheet ? 10 : 0)}mm`,
                                    paddingRight: `${layout.marginRight || 0}mm`,
                                    paddingBottom: `${layout.marginBottom || 0}mm`,
                                    boxSizing: 'border-box',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: `${layout.gapV || 0}mm ${layout.gapH || 0}mm`,
                                    position: 'relative'
                                }}
                            >
                                {pageItems.map((item, labelIdx) => {
                                    const productData = { product: item, store: storeInfo };
                                    const colIndex = labelIdx % cols;
                                    let extraX = 0;
                                    let extraY = 0;

                                    if (colIndex === 1) {
                                        extraX = layout.col2OffsetX || 0;
                                        extraY = layout.col2OffsetY || 0;
                                    } else if (colIndex === 2) {
                                        extraX = layout.col3OffsetX || 0;
                                        extraY = layout.col3OffsetY || 0;
                                    }

                                    return (
                                        <div
                                            key={labelIdx}
                                            style={{
                                                width: `${labelW}mm`,
                                                height: `${labelH}mm`,
                                                position: 'relative',
                                                left: extraX ? `${extraX}mm` : '0mm',
                                                top: extraY ? `${extraY}mm` : '0mm',
                                                background: '#ffffff',
                                                borderRadius: preset.corner_radius ? `${preset.corner_radius}mm` : 0,
                                                overflow: 'hidden',
                                                boxSizing: 'border-box'
                                            }}
                                        >
                                            {(preset.canvas_data || []).map((el) => {
                                                if (!isElementVisible(el, productData)) return null;
                                                return (
                                                    <LabelElementRenderer
                                                        key={el.id}
                                                        element={el}
                                                        productData={productData}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LivePrintPreviewModal;

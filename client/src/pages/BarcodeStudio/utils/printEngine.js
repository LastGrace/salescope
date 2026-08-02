import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Calculate total paper roll width for multi-up thermal rolls
 */
export const getCalculatedRollWidth = (preset) => {
    const layout = preset.page_layout || {};
    const cols = layout.cols || 1;
    const labelW = preset.label_width || 50;
    const gapH = layout.gapH || 0;
    const marginLeft = layout.marginLeft || 0;
    const marginRight = layout.marginRight || 0;

    if (cols <= 1) return labelW;
    return (cols * labelW) + ((cols - 1) * gapH) + marginLeft + marginRight;
};

/**
 * Export label canvas container as Image (PNG/JPEG)
 */
export const exportAsImage = async (elementRef, filename = 'label', format = 'png') => {
    if (!elementRef) return;
    try {
        const canvas = await html2canvas(elementRef, {
            scale: 4,
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const image = canvas.toDataURL(mimeType, 1.0);
        const link = document.createElement('a');
        link.download = `${filename}.${format}`;
        link.href = image;
        link.click();
    } catch (err) {
        console.error('Export as image error:', err);
    }
};

/**
 * Export batch print as PDF document
 */
export const exportAsPDF = async (printContainerRef, preset, filename = 'barcode_labels') => {
    if (!printContainerRef) return;
    try {
        const isSheet = preset.paper_type === 'sheet';
        const pdfWidth = isSheet ? 210 : getCalculatedRollWidth(preset);
        const pdfHeight = isSheet ? 297 : (preset.label_height || 25);

        const doc = new jsPDF({
            orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pdfWidth, pdfHeight]
        });

        const pages = printContainerRef.querySelectorAll('.print-page-unit');
        for (let i = 0; i < pages.length; i++) {
            if (i > 0) doc.addPage([pdfWidth, pdfHeight]);

            const canvas = await html2canvas(pages[i], {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        }

        doc.save(`${filename}.pdf`);
    } catch (err) {
        console.error('Export as PDF error:', err);
    }
};

/**
 * Generate CSS `@page` rule for standard printing
 */
export const getPrintPageStyle = (preset, printerProfile = {}) => {
    const isSheet = preset.paper_type === 'sheet';
    const totalRollW = getCalculatedRollWidth(preset);
    const labelH = preset.label_height || 25;
    const offsetX = printerProfile.offset_x || 0;
    const offsetY = printerProfile.offset_y || 0;

    let pageSizeCSS = `${totalRollW}mm ${labelH}mm`;
    if (isSheet) {
        pageSizeCSS = `${printerProfile.page_size || 'A4'} portrait`;
    }

    return `
        @page {
            size: ${pageSizeCSS};
            margin: 0mm;
        }
        @media print {
            /* Hide all web application elements, sidebars, headers, and modals */
            body > *:not(#barcode-print-mount) {
                display: none !important;
            }

            html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }

            #barcode-print-mount {
                display: flex !important;
                flex-direction: column !important;
                align-items: flex-start !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
            }

            .print-page-unit {
                box-sizing: border-box !important;
                page-break-after: always !important;
                break-after: page !important;
                transform: translate(${offsetX}mm, ${offsetY}mm) !important;
                margin: 0 !important;
                box-shadow: none !important;
                background: #ffffff !important;
            }

            .print-page-unit:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
            }
        }
    `;
};

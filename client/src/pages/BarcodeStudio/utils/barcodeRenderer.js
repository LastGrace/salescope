import bwipjs from 'bwip-js';

/**
 * Replace placeholders like {{product_name}}, {{barcode}}, {{selling_price}}, etc.
 */
export const resolvePlaceholders = (text, data = {}) => {
    if (!text || typeof text !== 'string') return '';

    const store = data.store || data.storeInfo || (data.store_name || data.shop_name ? data : {});
    const product = data.product || (data.name || data.barcode || data.price ? data : {});
    const storeName = store.store_name || store.shop_name || store.name || 'SaleScope POS';

    const mappings = {
        '{{product_name}}': product.name || 'Sample Product',
        '{{barcode}}': product.barcode || '123456789012',
        '{{sku}}': product.sku || product.barcode || 'SKU-1001',
        '{{selling_price}}': product.selling_price ? Number(product.selling_price).toFixed(2) : (product.price ? Number(product.price).toFixed(2) : '0.00'),
        '{{mrp}}': product.mrp ? Number(product.mrp).toFixed(2) : (product.selling_price ? Number(product.selling_price).toFixed(2) : (product.price ? Number(product.price).toFixed(2) : '0.00')),
        '{{cost_price}}': product.cost_price ? Number(product.cost_price).toFixed(2) : '0.00',
        '{{brand}}': product.brand || '',
        '{{category}}': product.category || '',
        '{{weight}}': product.weight || '',
        '{{size}}': product.size || '',
        '{{color}}': product.color || '',
        '{{batch}}': product.batch || '',
        '{{expiry}}': product.expiry || '',
        '{{hsn}}': product.hsn || '',
        '{{company}}': storeName,
        '{{shop_name}}': storeName,
        '{{store_name}}': storeName,
        '{{serial_number}}': product.serial_number || 'SN-001',
        '{{date}}': new Date().toLocaleDateString()
    };

    let result = text;
    Object.entries(mappings).forEach(([key, val]) => {
        result = result.replaceAll(key, val);
    });

    return result;
};

/**
 * Check visibility condition for an element against product data
 */
export const isElementVisible = (element, productData = {}) => {
    const visibility = element.visibility || 'always';
    if (visibility === 'always') return true;

    const resolvedText = resolvePlaceholders(element.text || '', productData).trim();

    if (visibility === 'hide_if_empty') {
        return resolvedText !== '' && resolvedText !== '0' && resolvedText !== '0.00';
    }

    if (visibility === 'hide_if_zero') {
        return resolvedText !== '0' && resolvedText !== '0.00' && resolvedText !== '';
    }

    return true;
};

/**
 * Render a 1D or 2D barcode to an HTML Canvas or Data URL using bwip-js
 */
export const generateBarcodeDataUrl = (bcText, format = 'code128', options = {}) => {
    try {
        const canvas = document.createElement('canvas');
        const bcFormat = (format || 'code128').toLowerCase();

        let bcid = 'code128';
        if (bcFormat === 'ean13') bcid = 'ean13';
        else if (bcFormat === 'ean8') bcid = 'ean8';
        else if (bcFormat === 'upca') bcid = 'upca';
        else if (bcFormat === 'upce') bcid = 'upce';
        else if (bcFormat === 'code39') bcid = 'code39';
        else if (bcFormat === 'itf') bcid = 'itf14';
        else if (bcFormat === 'codabar') bcid = 'codabar';
        else if (bcFormat === 'msi') bcid = 'msi';
        else if (bcFormat === 'qrcode') bcid = 'qrcode';
        else if (bcFormat === 'datamatrix') bcid = 'datamatrix';
        else if (bcFormat === 'pdf417') bcid = 'pdf417';
        else if (bcFormat === 'aztec') bcid = 'aztec';

        const barColor = (options.color || options.barColor || '#000000').replace('#', '');

        bwipjs.toCanvas(canvas, {
            bcid,
            text: bcText || '123456789',
            scale: options.scale || 4,
            height: options.barHeight !== undefined ? Number(options.barHeight) : (options.height || 12),
            includetext: options.showText !== undefined ? Boolean(options.showText) : false,
            textxalign: 'center',
            barcolor: barColor,
            rotate: options.rotation ? 'R' : 'N'
        });

        return canvas.toDataURL('image/png');
    } catch (e) {
        console.warn('BWIP-js render error fallback:', e.message);
        return null;
    }
};

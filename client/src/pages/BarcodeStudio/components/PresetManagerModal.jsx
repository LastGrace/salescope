import React, { useState, useRef } from 'react';
import { X, Star, Check, Copy, Trash2, Download, Upload, Sparkles, Search, Tag, Zap, Package, Gem, ShoppingBag, Truck, Grid, AlignLeft, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Built-in Template Definitions ────────────────────────────────────────────
export const BUILTIN_TEMPLATES = [
    // ─── TSC 83mm 2-Up Templates ──────────────────────────────────────────
    {
        id: 'builtin-tsc-2up-standard',
        name: 'TSC 83mm — Standard 2-Up',
        category: 'Thermal 2-Up (TSC)',
        description: 'TSC TE244/TE344 · 83mm roll · 2 stickers per row · 38×25mm each',
        icon: '🖨️',
        style: 'standard',
        label_width: 38, label_height: 25,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 2, mode: '2up', marginTop: 0, marginBottom: 0, marginLeft: 2.5, marginRight: 2.5, gapH: 3, gapV: 0 },
        canvas_data: [
            { id: 't1', type: 'text', text: '{{shop_name}}', x: 1, y: 1.5, width: 36, height: 4, fontSize: 8, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 't2', type: 'text', text: '{{product_name}}', x: 1, y: 5.5, width: 36, height: 3.5, fontSize: 7.5, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 't3', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 3, y: 9.5, width: 32, height: 9, showText: true, fontSize: 7, visibility: 'always' },
            { id: 't4', type: 'text', text: 'MRP: ₹{{mrp}}', x: 1, y: 19.5, width: 36, height: 4, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
        ]
    },
    {
        id: 'builtin-tsc-2up-price-tag',
        name: 'TSC 83mm — Price Tag 2-Up',
        category: 'Thermal 2-Up (TSC)',
        description: 'Prominent price display · Selling price & MRP both visible · 2-up roll',
        icon: '💰',
        style: 'price',
        label_width: 38, label_height: 25,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 2, mode: '2up', marginTop: 0, marginBottom: 0, marginLeft: 2.5, marginRight: 2.5, gapH: 3, gapV: 0 },
        canvas_data: [
            { id: 'p1', type: 'text', text: '{{product_name}}', x: 1, y: 1.5, width: 36, height: 4.5, fontSize: 8.5, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'p2', type: 'text', text: '{{brand}}', x: 1, y: 6, width: 36, height: 3, fontSize: 7, fontWeight: 'normal', align: 'center', color: '#555555', visibility: 'always' },
            { id: 'p3', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 4, y: 9.5, width: 30, height: 8.5, showText: false, visibility: 'always' },
            { id: 'p4', type: 'text', text: '₹{{selling_price}}', x: 1, y: 18.5, width: 21, height: 5, fontSize: 11, fontWeight: 'bold', align: 'left', color: '#000000', visibility: 'always' },
            { id: 'p5', type: 'text', text: 'MRP ₹{{mrp}}', x: 22, y: 19.5, width: 14, height: 3.5, fontSize: 7, fontWeight: 'normal', align: 'right', color: '#777777', visibility: 'always' },
        ]
    },
    {
        id: 'builtin-tsc-2up-grocery',
        name: 'TSC 83mm — Grocery 2-Up',
        category: 'Thermal 2-Up (TSC)',
        description: 'Best for grocery & FMCG · Includes batch, expiry & HSN code',
        icon: '🛒',
        style: 'grocery',
        label_width: 38, label_height: 30,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 2, mode: '2up', marginTop: 0, marginBottom: 0, marginLeft: 2.5, marginRight: 2.5, gapH: 3, gapV: 0 },
        canvas_data: [
            { id: 'g1', type: 'text', text: '{{shop_name}}', x: 1, y: 1, width: 36, height: 3.5, fontSize: 8, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'g2', type: 'text', text: '{{product_name}}', x: 1, y: 4.5, width: 36, height: 3.5, fontSize: 8, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'g3', type: 'barcode', format: 'EAN13', text: '{{barcode}}', x: 3, y: 8.5, width: 32, height: 9, showText: true, fontSize: 7, visibility: 'always' },
            { id: 'g4', type: 'text', text: 'MRP: ₹{{mrp}}', x: 1, y: 18.5, width: 22, height: 4, fontSize: 9.5, fontWeight: 'bold', align: 'left', color: '#000000', visibility: 'always' },
            { id: 'g5', type: 'text', text: 'Batch: {{batch}}', x: 1, y: 23, width: 18, height: 3, fontSize: 6.5, fontWeight: 'normal', align: 'left', color: '#555555', visibility: 'hide_if_empty' },
            { id: 'g6', type: 'text', text: 'Exp: {{expiry}}', x: 20, y: 23, width: 17, height: 3, fontSize: 6.5, fontWeight: 'normal', align: 'right', color: '#cc0000', visibility: 'hide_if_empty' },
        ]
    },
    {
        id: 'builtin-tsc-2up-sku',
        name: 'TSC 83mm — SKU Inventory 2-Up',
        category: 'Thermal 2-Up (TSC)',
        description: 'Warehouse & inventory labels · SKU code + barcode · 2-up format',
        icon: '📦',
        style: 'inventory',
        label_width: 38, label_height: 25,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 2, mode: '2up', marginTop: 0, marginBottom: 0, marginLeft: 2.5, marginRight: 2.5, gapH: 3, gapV: 0 },
        canvas_data: [
            { id: 's1', type: 'text', text: '{{product_name}}', x: 1, y: 1, width: 36, height: 3.5, fontSize: 8, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 's2', type: 'text', text: 'SKU: {{sku}}', x: 1, y: 5, width: 36, height: 3, fontSize: 7.5, fontWeight: 'normal', align: 'center', color: '#333333', visibility: 'always' },
            { id: 's3', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 2, y: 8.5, width: 34, height: 12, showText: true, fontSize: 7, visibility: 'always' },
            { id: 's4', type: 'text', text: '{{category}} | {{brand}}', x: 1, y: 21.5, width: 36, height: 3, fontSize: 6.5, fontWeight: 'normal', align: 'center', color: '#777777', visibility: 'hide_if_empty' },
        ]
    },

    // ─── Single Thermal (1-Up) Templates ──────────────────────────────────
    {
        id: 'builtin-thermal-1up-standard',
        name: 'Standard Product Label',
        category: 'Thermal 1-Up',
        description: 'Classic product barcode label · 50×25mm · Works on all thermal printers',
        icon: '🏷️',
        style: 'standard',
        label_width: 50, label_height: 25,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, mode: '1up', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: 'st1', type: 'text', text: '{{shop_name}}', x: 2, y: 1.5, width: 46, height: 4.5, fontSize: 10, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'st2', type: 'text', text: '{{product_name}}', x: 2, y: 6.2, width: 46, height: 4, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'st3', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 5, y: 10.5, width: 40, height: 9.5, showText: true, fontSize: 8, visibility: 'always' },
            { id: 'st4', type: 'text', text: 'MRP: ₹{{mrp}}', x: 2, y: 20.5, width: 46, height: 3.8, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
        ]
    },
    {
        id: 'builtin-thermal-1up-large',
        name: 'Large Thermal Label (58×40)',
        category: 'Thermal 1-Up',
        description: 'Larger label for more info · Shop name, product, barcode, price & date',
        icon: '📋',
        style: 'detailed',
        label_width: 58, label_height: 40,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, mode: '1up', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: 'l1', type: 'rectangle', x: 0, y: 0, width: 58, height: 7, background: '#000000', borderColor: '#000000', borderWidth: 0, visibility: 'always' },
            { id: 'l2', type: 'text', text: '{{shop_name}}', x: 1, y: 0.5, width: 56, height: 6, fontSize: 11, fontWeight: 'bold', align: 'center', color: '#ffffff', visibility: 'always' },
            { id: 'l3', type: 'text', text: '{{product_name}}', x: 2, y: 8.5, width: 54, height: 5, fontSize: 10, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'l4', type: 'text', text: '{{brand}} · {{category}}', x: 2, y: 14, width: 54, height: 3.5, fontSize: 7.5, fontWeight: 'normal', align: 'center', color: '#555555', visibility: 'hide_if_empty' },
            { id: 'l5', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 4, y: 17.5, width: 50, height: 13, showText: true, fontSize: 8, visibility: 'always' },
            { id: 'l6', type: 'text', text: 'MRP: ₹{{mrp}}', x: 2, y: 31.5, width: 30, height: 5, fontSize: 12, fontWeight: 'bold', align: 'left', color: '#000000', visibility: 'always' },
            { id: 'l7', type: 'text', text: '{{date}}', x: 32, y: 33, width: 24, height: 3.5, fontSize: 7, fontWeight: 'normal', align: 'right', color: '#777777', visibility: 'always' },
        ]
    },
    {
        id: 'builtin-thermal-1up-compact',
        name: 'Compact Mini Label (38×19)',
        category: 'Thermal 1-Up',
        description: 'Smallest practical label · Good for small bottles, boxes & sachets',
        icon: '⬛',
        style: 'compact',
        label_width: 38, label_height: 19,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, mode: '1up', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: 'm1', type: 'text', text: '{{product_name}}', x: 1, y: 1, width: 36, height: 3.5, fontSize: 8, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'm2', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 2, y: 5, width: 34, height: 9, showText: true, fontSize: 7, visibility: 'always' },
            { id: 'm3', type: 'text', text: '₹{{mrp}}', x: 1, y: 14.5, width: 36, height: 3.5, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
        ]
    },
    {
        id: 'builtin-thermal-3up-roll',
        name: 'Triple Label 3-Up Roll (105mm)',
        category: 'Thermal 1-Up',
        description: '3 stickers per row on 105mm roll · Great for high-volume retail printing',
        icon: '🔢',
        style: 'multiup',
        label_width: 30, label_height: 20,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 3, mode: '3up', marginTop: 0, marginBottom: 0, marginLeft: 2.5, marginRight: 2.5, gapH: 2.5, gapV: 0 },
        canvas_data: [
            { id: '3u1', type: 'text', text: '{{product_name}}', x: 1, y: 1, width: 28, height: 3.5, fontSize: 7, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: '3u2', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 2, y: 5, width: 26, height: 10, showText: true, fontSize: 6, visibility: 'always' },
            { id: '3u3', type: 'text', text: '₹{{mrp}}', x: 1, y: 15.5, width: 28, height: 3.5, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
        ]
    },

    // ─── Jewellery Tags ────────────────────────────────────────────────────
    {
        id: 'builtin-jewellery-tag-standard',
        name: 'Jewellery Hang Tag — Standard',
        category: 'Jewellery',
        description: 'Classic jewellery paper tag · Product, weight, karat & price · Portrait',
        icon: '💎',
        style: 'jewellery',
        label_width: 25, label_height: 50,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, mode: '1up', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: 'jt1', type: 'rectangle', x: 0, y: 0, width: 25, height: 10, background: '#111111', borderColor: '#111111', borderWidth: 0, visibility: 'always' },
            { id: 'jt2', type: 'text', text: '{{shop_name}}', x: 1, y: 0.5, width: 23, height: 9, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#ffffff', visibility: 'always' },
            { id: 'jt3', type: 'text', text: '{{product_name}}', x: 1, y: 11, width: 23, height: 5, fontSize: 8.5, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'jt4', type: 'text', text: 'Wt: {{weight}}g', x: 1, y: 17, width: 11, height: 3.5, fontSize: 7, fontWeight: 'normal', align: 'left', color: '#333333', visibility: 'hide_if_empty' },
            { id: 'jt5', type: 'text', text: '{{sku}}', x: 12, y: 17, width: 12, height: 3.5, fontSize: 7, fontWeight: 'normal', align: 'right', color: '#333333', visibility: 'always' },
            { id: 'jt6', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 1, y: 21, width: 23, height: 14, showText: false, visibility: 'always' },
            { id: 'jt7', type: 'text', text: '{{barcode}}', x: 1, y: 35.5, width: 23, height: 3, fontSize: 6.5, fontWeight: 'normal', align: 'center', color: '#444444', visibility: 'always' },
            { id: 'jt8', type: 'text', text: '₹{{mrp}}', x: 1, y: 40, width: 23, height: 7, fontSize: 14, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
        ]
    },
    {
        id: 'builtin-jewellery-sticker-square',
        name: 'Jewellery Square Sticker',
        category: 'Jewellery',
        description: 'Small square sticker for rings & earrings · Landscape 30×20mm',
        icon: '💍',
        style: 'jewellery-square',
        label_width: 30, label_height: 20,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, mode: '1up', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: 'js1', type: 'text', text: '{{product_name}}', x: 1, y: 1, width: 28, height: 4.5, fontSize: 8.5, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'js2', type: 'text', text: 'Wt: {{weight}}g  SKU: {{sku}}', x: 1, y: 6, width: 28, height: 3, fontSize: 6.5, fontWeight: 'normal', align: 'center', color: '#555555', visibility: 'always' },
            { id: 'js3', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 2, y: 9.5, width: 26, height: 7, showText: false, visibility: 'always' },
            { id: 'js4', type: 'text', text: '₹{{mrp}}', x: 1, y: 17, width: 28, height: 3, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
        ]
    },
    {
        id: 'builtin-jewellery-qr-tag',
        name: 'Jewellery QR Code Tag',
        category: 'Jewellery',
        description: 'Modern QR-based jewellery tag · QR code + price display',
        icon: '📱',
        style: 'qr-jewellery',
        label_width: 35, label_height: 45,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, mode: '1up', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: 'qj1', type: 'text', text: '{{shop_name}}', x: 1, y: 1, width: 33, height: 5, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'qj2', type: 'text', text: '{{product_name}}', x: 1, y: 7, width: 33, height: 4, fontSize: 8, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'qj3', type: 'qrcode', text: '{{barcode}}', x: 8, y: 12, width: 19, height: 19, visibility: 'always' },
            { id: 'qj4', type: 'text', text: 'Wt: {{weight}}g', x: 1, y: 33, width: 16, height: 3.5, fontSize: 7.5, fontWeight: 'normal', align: 'left', color: '#333333', visibility: 'hide_if_empty' },
            { id: 'qj5', type: 'text', text: '{{sku}}', x: 18, y: 33, width: 16, height: 3.5, fontSize: 7.5, fontWeight: 'normal', align: 'right', color: '#333333', visibility: 'always' },
            { id: 'qj6', type: 'text', text: '₹{{mrp}}', x: 1, y: 38, width: 33, height: 7, fontSize: 14, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
        ]
    },

    // ─── A4 Sheet Templates ────────────────────────────────────────────────
    {
        id: 'builtin-a4-3x8-standard',
        name: 'A4 Sheet — 3×8 Grid (24 labels)',
        category: 'A4 Sheets',
        description: 'Standard A4 sticker sheet · 3 columns × 8 rows = 24 labels per page · 63×33mm each',
        icon: '📄',
        style: 'a4-standard',
        label_width: 63, label_height: 33,
        paper_type: 'sheet',
        page_layout: { rows: 8, cols: 3, marginTop: 10, marginBottom: 10, marginLeft: 7, marginRight: 7, gapH: 3, gapV: 0 },
        canvas_data: [
            { id: 'a1', type: 'text', text: '{{product_name}}', x: 2, y: 2, width: 59, height: 5, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'a2', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 5, y: 8, width: 53, height: 15, showText: true, fontSize: 7.5, visibility: 'always' },
            { id: 'a3', type: 'text', text: 'MRP: ₹{{mrp}}', x: 2, y: 24, width: 59, height: 5, fontSize: 10, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
        ]
    },
    {
        id: 'builtin-a4-2x5-large',
        name: 'A4 Sheet — 2×5 Grid (10 labels)',
        category: 'A4 Sheets',
        description: 'Large A4 labels · 2 columns × 5 rows · 96×55mm each · Good for full-detail labels',
        icon: '📃',
        style: 'a4-large',
        label_width: 96, label_height: 55,
        paper_type: 'sheet',
        page_layout: { rows: 5, cols: 2, marginTop: 12, marginBottom: 12, marginLeft: 8, marginRight: 8, gapH: 5, gapV: 3 },
        canvas_data: [
            { id: 'al1', type: 'text', text: '{{shop_name}}', x: 2, y: 2, width: 92, height: 6, fontSize: 11, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'al2', type: 'text', text: '{{product_name}}', x: 2, y: 9, width: 92, height: 6, fontSize: 10, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'al3', type: 'text', text: '{{brand}} · {{category}}', x: 2, y: 16, width: 92, height: 4, fontSize: 8, fontWeight: 'normal', align: 'center', color: '#666666', visibility: 'hide_if_empty' },
            { id: 'al4', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 10, y: 21, width: 76, height: 20, showText: true, fontSize: 9, visibility: 'always' },
            { id: 'al5', type: 'text', text: 'MRP: ₹{{mrp}}', x: 2, y: 43, width: 50, height: 8, fontSize: 14, fontWeight: 'bold', align: 'left', color: '#000000', visibility: 'always' },
            { id: 'al6', type: 'text', text: 'SKU: {{sku}}', x: 52, y: 45, width: 42, height: 5, fontSize: 8, fontWeight: 'normal', align: 'right', color: '#777777', visibility: 'always' },
        ]
    },

    // ─── Fashion & Apparel Tags ────────────────────────────────────────────
    {
        id: 'builtin-fashion-hang-tag',
        name: 'Fashion Hang Tag — Portrait',
        category: 'Fashion & Apparel',
        description: 'Garment hang tag · Brand, name, size, MRP · 40×70mm portrait',
        icon: '👗',
        style: 'fashion',
        label_width: 40, label_height: 70,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, mode: '1up', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: 'f1', type: 'rectangle', x: 0, y: 0, width: 40, height: 12, background: '#1a1a2e', borderColor: '#1a1a2e', borderWidth: 0, visibility: 'always' },
            { id: 'f2', type: 'text', text: '{{brand}}', x: 1, y: 0.5, width: 38, height: 11, fontSize: 13, fontWeight: 'bold', align: 'center', color: '#ffffff', visibility: 'always' },
            { id: 'f3', type: 'text', text: '{{product_name}}', x: 2, y: 14, width: 36, height: 6, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'f4', type: 'text', text: '{{category}}', x: 2, y: 21, width: 36, height: 4, fontSize: 8, fontWeight: 'normal', align: 'center', color: '#555555', visibility: 'hide_if_empty' },
            { id: 'f5', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 3, y: 27, width: 34, height: 20, showText: true, fontSize: 8, visibility: 'always' },
            { id: 'f6', type: 'text', text: 'SKU: {{sku}}', x: 2, y: 49, width: 36, height: 4, fontSize: 7.5, fontWeight: 'normal', align: 'center', color: '#777777', visibility: 'always' },
            { id: 'f7', type: 'text', text: 'MRP: ₹{{mrp}}', x: 2, y: 54, width: 36, height: 7, fontSize: 12, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'f8', type: 'text', text: '(incl. all taxes)', x: 2, y: 62, width: 36, height: 3.5, fontSize: 6.5, fontWeight: 'normal', align: 'center', color: '#aaaaaa', visibility: 'always' },
        ]
    },
    {
        id: 'builtin-fashion-small-tag',
        name: 'Fashion Small Tag — 50×30',
        category: 'Fashion & Apparel',
        description: 'Compact apparel tag · Name, barcode, price · Good for folded garments',
        icon: '👔',
        style: 'fashion-small',
        label_width: 50, label_height: 30,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, mode: '1up', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: 'fs1', type: 'text', text: '{{brand}}', x: 2, y: 1.5, width: 46, height: 4.5, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'fs2', type: 'text', text: '{{product_name}}', x: 2, y: 6.5, width: 46, height: 4, fontSize: 8, fontWeight: 'normal', align: 'center', color: '#333333', visibility: 'always' },
            { id: 'fs3', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 5, y: 11, width: 40, height: 11, showText: true, fontSize: 7, visibility: 'always' },
            { id: 'fs4', type: 'text', text: 'MRP: ₹{{mrp}}', x: 2, y: 23.5, width: 46, height: 5, fontSize: 10, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
        ]
    },

    // ─── Pharmacy / Medical ───────────────────────────────────────────────
    {
        id: 'builtin-pharma-label',
        name: 'Pharmacy / Medicine Label',
        category: 'Pharmacy',
        description: 'Pharmaceutical label · Medicine name, batch, expiry & HSN · 50×30mm',
        icon: '💊',
        style: 'pharma',
        label_width: 50, label_height: 30,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, mode: '1up', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: 'ph1', type: 'text', text: '{{product_name}}', x: 2, y: 1.5, width: 46, height: 5, fontSize: 10, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'ph2', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 5, y: 7.5, width: 40, height: 11, showText: true, fontSize: 7, visibility: 'always' },
            { id: 'ph3', type: 'text', text: 'MRP: ₹{{mrp}}', x: 2, y: 19.5, width: 24, height: 4, fontSize: 9, fontWeight: 'bold', align: 'left', color: '#000000', visibility: 'always' },
            { id: 'ph4', type: 'text', text: 'Batch: {{batch}}', x: 2, y: 24, width: 23, height: 3.5, fontSize: 7, fontWeight: 'normal', align: 'left', color: '#333333', visibility: 'hide_if_empty' },
            { id: 'ph5', type: 'text', text: 'Exp: {{expiry}}', x: 26, y: 19.5, width: 22, height: 4, fontSize: 9, fontWeight: 'bold', align: 'right', color: '#cc0000', visibility: 'hide_if_empty' },
            { id: 'ph6', type: 'text', text: 'HSN: {{hsn}}', x: 26, y: 24, width: 22, height: 3.5, fontSize: 7, fontWeight: 'normal', align: 'right', color: '#555555', visibility: 'hide_if_empty' },
        ]
    },

    // ─── Electronics ──────────────────────────────────────────────────────
    {
        id: 'builtin-electronics-label',
        name: 'Electronics / Serial No. Label',
        category: 'Electronics',
        description: 'Electronics item label · Serial number, warranty, specs',
        icon: '🔌',
        style: 'electronics',
        label_width: 60, label_height: 35,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, mode: '1up', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: 'e1', type: 'rectangle', x: 0, y: 0, width: 60, height: 9, background: '#0d47a1', borderColor: '#0d47a1', borderWidth: 0, visibility: 'always' },
            { id: 'e2', type: 'text', text: '{{brand}}', x: 2, y: 0.5, width: 56, height: 8, fontSize: 12, fontWeight: 'bold', align: 'center', color: '#ffffff', visibility: 'always' },
            { id: 'e3', type: 'text', text: '{{product_name}}', x: 2, y: 11, width: 56, height: 5, fontSize: 10, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'e4', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 5, y: 17, width: 50, height: 11, showText: true, fontSize: 7, visibility: 'always' },
            { id: 'e5', type: 'text', text: 'Serial: {{sku}}', x: 2, y: 29.5, width: 30, height: 3.5, fontSize: 7, fontWeight: 'normal', align: 'left', color: '#333333', visibility: 'always' },
            { id: 'e6', type: 'text', text: 'MRP: ₹{{mrp}}', x: 32, y: 29.5, width: 26, height: 3.5, fontSize: 7, fontWeight: 'bold', align: 'right', color: '#000000', visibility: 'always' },
        ]
    },

    // ─── QR Code Labels ────────────────────────────────────────────────────
    {
        id: 'builtin-qr-price-tag',
        name: 'QR Price Tag — Square',
        category: 'QR Labels',
        description: 'QR code based product label · Modern design for digital-savvy stores',
        icon: '📱',
        style: 'qr-price',
        label_width: 40, label_height: 40,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, mode: '1up', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: 'qp1', type: 'text', text: '{{product_name}}', x: 2, y: 1.5, width: 36, height: 5, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'qp2', type: 'qrcode', text: '{{barcode}}', x: 10, y: 7.5, width: 20, height: 20, visibility: 'always' },
            { id: 'qp3', type: 'text', text: '{{barcode}}', x: 2, y: 28.5, width: 36, height: 3.5, fontSize: 7, fontWeight: 'normal', align: 'center', color: '#555555', visibility: 'always' },
            { id: 'qp4', type: 'text', text: '₹{{mrp}}', x: 2, y: 33, width: 36, height: 7, fontSize: 14, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
        ]
    },
    {
        id: 'builtin-qr-dual-code',
        name: 'Dual Code — Barcode + QR',
        category: 'QR Labels',
        description: 'Both 1D barcode and QR code on one label · For multi-scanner environments',
        icon: '🔄',
        style: 'dual-code',
        label_width: 70, label_height: 35,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, mode: '1up', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: 'dc1', type: 'text', text: '{{product_name}}', x: 2, y: 1, width: 66, height: 5, fontSize: 10, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: 'dc2', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 2, y: 7, width: 44, height: 16, showText: true, fontSize: 8, visibility: 'always' },
            { id: 'dc3', type: 'qrcode', text: '{{barcode}}', x: 52, y: 7, width: 16, height: 16, visibility: 'always' },
            { id: 'dc4', type: 'text', text: '₹{{mrp}}', x: 2, y: 25, width: 34, height: 7, fontSize: 13, fontWeight: 'bold', align: 'left', color: '#000000', visibility: 'always' },
            { id: 'dc5', type: 'text', text: 'SKU: {{sku}}', x: 36, y: 26.5, width: 32, height: 4, fontSize: 7.5, fontWeight: 'normal', align: 'right', color: '#777777', visibility: 'always' },
        ]
    },
];

const CATEGORY_CONFIG = [
    { id: 'ALL', label: 'All Templates', icon: Grid },
    { id: 'Thermal 2-Up (TSC)', label: 'TSC 2-Up (83mm)', icon: AlignLeft },
    { id: 'Thermal 1-Up', label: 'Single Thermal', icon: Tag },
    { id: 'Jewellery', label: 'Jewellery Tags', icon: Gem },
    { id: 'Fashion & Apparel', label: 'Fashion Tags', icon: ShoppingBag },
    { id: 'A4 Sheets', label: 'A4 Sheet Labels', icon: BookOpen },
    { id: 'Pharmacy', label: 'Pharmacy', icon: Zap },
    { id: 'Electronics', label: 'Electronics', icon: Package },
    { id: 'QR Labels', label: 'QR Code Labels', icon: Sparkles },
];

const STYLE_COLORS = {
    'standard': { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', accent: '#60a5fa' },
    'price': { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', accent: '#fbbf24' },
    'grocery': { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', accent: '#34d399' },
    'inventory': { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', accent: '#94a3b8' },
    'jewellery': { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', accent: '#fbbf24' },
    'jewellery-square': { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', accent: '#fbbf24' },
    'qr-jewellery': { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', accent: '#fbbf24' },
    'fashion': { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.35)', accent: '#c084fc' },
    'fashion-small': { bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)', accent: '#c084fc' },
    'pharma': { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', accent: '#f87171' },
    'electronics': { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.35)', accent: '#38bdf8' },
    'qr-price': { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', accent: '#4ade80' },
    'dual-code': { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', accent: '#4ade80' },
    'compact': { bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', accent: '#9ca3af' },
    'multiup': { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', accent: '#60a5fa' },
    'detailed': { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', accent: '#60a5fa' },
    'a4-standard': { bg: 'rgba(15,118,110,0.1)', border: 'rgba(15,118,110,0.3)', accent: '#2dd4bf' },
    'a4-large': { bg: 'rgba(15,118,110,0.12)', border: 'rgba(15,118,110,0.35)', accent: '#2dd4bf' },
};

// ─── Mini Visual Preview of label layout ──────────────────────────────────────
const LabelMiniPreview = ({ template }) => {
    const { label_width, label_height, page_layout, style } = template;
    const cols = page_layout?.cols || 1;
    const colors = STYLE_COLORS[style] || STYLE_COLORS['standard'];

    const previewW = 70;
    const previewH = Math.min(50, Math.round((label_height / label_width) * previewW));

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', margin: '0.5rem 0' }}>
            {Array.from({ length: Math.min(cols, 3) }).map((_, i) => (
                <div key={i} style={{
                    width: `${previewW / cols - (cols > 1 ? 3 : 0)}px`,
                    height: `${previewH}px`,
                    background: '#f8f8f8',
                    border: `1.5px solid ${colors.accent}`,
                    borderRadius: '3px',
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: i === 0 ? 1 : 0.55,
                    flexShrink: 0,
                }}>
                    {/* Simulated lines */}
                    <div style={{ position: 'absolute', top: '12%', left: '10%', right: '10%', height: '6%', background: '#333', borderRadius: '1px' }} />
                    <div style={{ position: 'absolute', top: '22%', left: '5%', right: '5%', height: '35%', background: `linear-gradient(90deg, #222 1px, transparent 1px) 0 0 / 3px 100%`, opacity: 0.8 }} />
                    <div style={{ position: 'absolute', bottom: '10%', left: '10%', right: '10%', height: '8%', background: colors.accent, borderRadius: '1px', opacity: 0.7 }} />
                </div>
            ))}
        </div>
    );
};


const PresetManagerModal = ({
    isOpen,
    onClose,
    presets,
    activePresetId,
    onSelectPreset,
    onDuplicatePreset,
    onSetDefaultPreset,
    onToggleFavorite,
    onDeletePreset,
    onImportPreset
}) => {
    const [selectedCategoryTab, setSelectedCategoryTab] = useState('ALL');
    const [search, setSearch] = useState('');
    const [importJsonText, setImportJsonText] = useState('');
    const [showImportForm, setShowImportForm] = useState(false);
    const [activeTab, setActiveTab] = useState('builtin'); // 'builtin' | 'saved'
    const fileInputRef = useRef(null);

    // ⚠️ Early return MUST be after all hooks (Rules of Hooks)
    if (!isOpen) return null;

    // Combine built-in templates with saved presets
    const builtinFiltered = BUILTIN_TEMPLATES.filter(t => {
        const matchesCat = selectedCategoryTab === 'ALL' || t.category === selectedCategoryTab;
        const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
        return matchesCat && matchesSearch;
    });

    const savedFiltered = presets.filter(p => {
        const matchesCat = selectedCategoryTab === 'ALL' || p.category === selectedCategoryTab;
        const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
        return matchesCat && matchesSearch;
    });

    const handleExport = async (preset) => {
        if (!preset) return;
        const exportData = {
            name: preset.name || 'Exported Barcode Template',
            category: preset.category || 'General',
            paper_type: preset.paper_type || 'thermal',
            label_width: preset.label_width || 50,
            label_height: preset.label_height || 25,
            corner_radius: preset.corner_radius || 0,
            description: preset.description || '',
            page_layout: preset.page_layout || {
                rows: 1, cols: 1, mode: '1up',
                marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
                gapH: 0, gapV: 0,
                col2OffsetX: 0, col2OffsetY: 0,
                col3OffsetX: 0, col3OffsetY: 0
            },
            canvas_data: (preset.canvas_data || []).map(el => ({ ...el })),
            exported_at: new Date().toISOString(),
            version: '2.0'
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const fileName = `${(preset.name || 'barcode_template').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_preset.json`;

        // 1. Try OS Save File Dialog (Chrome/Edge/Brave/Opera File System Access API)
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'JSON Template File',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(jsonStr);
                await writable.close();
                toast.success(`Exported "${preset.name}" as JSON file!`);
                return;
            } catch (err) {
                // If user clicks Cancel in the OS file picker dialog, exit gracefully
                if (err.name === 'AbortError') {
                    return;
                }
            }
        }

        // 2. Fallback to automatic browser download if showSaveFilePicker is not supported or blocked
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported "${preset.name}" as JSON file!`);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const parsed = JSON.parse(evt.target.result);
                if (!parsed.name || !parsed.canvas_data || !Array.isArray(parsed.canvas_data)) {
                    toast.error('Invalid template JSON file — must contain "name" and "canvas_data" array');
                    return;
                }
                onImportPreset(parsed);
                setShowImportForm(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                onClose();
                toast.success(`Template "${parsed.name}" imported successfully!`);
            } catch (err) {
                console.error('Import JSON file error:', err);
                toast.error('Invalid JSON file — check JSON syntax');
            }
        };
        reader.readAsText(file);
    };

    const handleImportSubmit = (e) => {
        e.preventDefault();
        try {
            const parsed = JSON.parse(importJsonText);
            if (!parsed.name || !parsed.canvas_data || !Array.isArray(parsed.canvas_data)) {
                toast.error('Invalid preset JSON – needs "name" and "canvas_data" array');
                return;
            }
            onImportPreset(parsed);
            setShowImportForm(false);
            setImportJsonText('');
            onClose();
            toast.success(`Template "${parsed.name}" imported successfully!`);
        } catch {
            toast.error('JSON parsing error – check your JSON syntax');
        }
    };

    return (
        <div className="studio-modal-overlay" onClick={onClose}>
            <div
                className="studio-modal-card"
                style={{ maxWidth: '1000px', width: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="studio-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Sparkles size={20} color="#fff" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Template Library</h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                                {BUILTIN_TEMPLATES.length} built-in templates · TSC, Jewellery, A4, Fashion & more
                            </span>
                        </div>
                    </div>
                    <button type="button" className="btn-icon" onClick={onClose} style={{ color: '#94a3b8' }}>
                        <X size={20} />
                    </button>
                </div>

                <div className="studio-modal-body" style={{ padding: '0.85rem 1.25rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Sub-tabs: Built-in vs Saved */}
                    <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="studio-nav-tabs">
                            <button
                                type="button"
                                className={`studio-tab-btn ${activeTab === 'builtin' ? 'active' : ''}`}
                                onClick={() => setActiveTab('builtin')}
                            >
                                <Sparkles size={14} /> Built-in Templates
                            </button>
                            <button
                                type="button"
                                className={`studio-tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
                                onClick={() => setActiveTab('saved')}
                            >
                                <Star size={14} /> My Saved Presets ({presets.length})
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowImportForm(!showImportForm)} style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}>
                                <Upload size={13} style={{ marginRight: 4 }} /> Import JSON
                            </button>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            type="text"
                            className="prop-input"
                            style={{ width: '100%', paddingLeft: '2rem', boxSizing: 'border-box' }}
                            placeholder="Search by printer name, label format, use-case..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Category Tabs */}
                    <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'nowrap', flexShrink: 0 }}>
                        {CATEGORY_CONFIG.map(cat => {
                            const Icon = cat.icon;
                            const isActive = selectedCategoryTab === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategoryTab(cat.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '5px',
                                        padding: '0.3rem 0.7rem',
                                        borderRadius: 6,
                                        border: `1px solid ${isActive ? 'var(--primary, #3b82f6)' : '#334155'}`,
                                        background: isActive ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.5)',
                                        color: isActive ? '#60a5fa' : '#94a3b8',
                                        fontSize: '0.75rem', fontWeight: 600,
                                        cursor: 'pointer', whiteSpace: 'nowrap',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <Icon size={12} />
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Hidden File Input for JSON import */}
                    <input
                        type="file"
                        accept=".json,application/json"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                    />

                    {/* Import Form */}
                    {showImportForm && (
                        <div style={{ background: 'rgba(15,23,42,0.7)', padding: '1rem', borderRadius: 10, marginBottom: '0.75rem', border: '1px solid #3b82f6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#f8fafc', fontWeight: 700 }}>Import Barcode Template JSON</h4>
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Upload a downloaded .json template file or paste raw JSON below</span>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload size={14} /> Upload .JSON File From Computer
                                </button>
                            </div>

                            <form onSubmit={handleImportSubmit}>
                                <textarea
                                    rows={4}
                                    className="prop-input"
                                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.75rem', background: '#090d16' }}
                                    placeholder='Or paste custom JSON code here: {"name": "My Custom Label", "label_width": 50, "label_height": 25, "canvas_data": [...] }'
                                    value={importJsonText}
                                    onChange={(e) => setImportJsonText(e.target.value)}
                                />
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowImportForm(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Import Pasted JSON</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Built-in Templates Grid */}
                    {activeTab === 'builtin' && (
                        <div>
                            {builtinFiltered.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                    <Search size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                                    <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>No templates found</div>
                                    <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Try a different search or category</div>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '0.75rem'
                                }}>
                                    {builtinFiltered.map(template => {
                                        const colors = STYLE_COLORS[template.style] || STYLE_COLORS['standard'];
                                        return (
                                            <div
                                                key={template.id}
                                                style={{
                                                    background: colors.bg,
                                                    border: `1.5px solid ${colors.border}`,
                                                    borderRadius: 12,
                                                    padding: '1rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.5rem',
                                                    transition: 'transform 0.15s, box-shadow 0.15s',
                                                    cursor: 'default',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.3)`; }}
                                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                                            >
                                                {/* Card Header */}
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                                                    <span style={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>{template.icon}</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{template.name}</div>
                                                        <div style={{ fontSize: '0.68rem', color: colors.accent, fontWeight: 600, marginTop: 2 }}>
                                                            {template.category} · {template.label_width}×{template.label_height}mm
                                                            {template.page_layout?.cols > 1 ? ` · ${template.page_layout.cols}-Up` : ''}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Mini visual preview */}
                                                <LabelMiniPreview template={template} />

                                                {/* Description */}
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.4, flex: 1 }}>
                                                    {template.description}
                                                </div>

                                                {/* Action Buttons */}
                                                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.55rem', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                        onClick={() => handleExport(template)}
                                                        title="Export JSON configuration file"
                                                    >
                                                        <Download size={13} /> Export JSON
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary"
                                                        style={{ flex: 1, fontSize: '0.78rem', padding: '0.35rem 0', background: `linear-gradient(135deg, ${colors.accent}22, ${colors.accent}33)`, color: colors.accent, border: `1px solid ${colors.accent}55`, fontWeight: 700 }}
                                                        onClick={() => {
                                                            onSelectPreset({ ...template });
                                                            onClose();
                                                            toast.success(`Loaded: ${template.name}`);
                                                        }}
                                                    >
                                                        Use This Template →
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Saved Presets */}
                    {activeTab === 'saved' && (
                        <div>
                            {savedFiltered.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                    <Star size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                                    <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>No saved presets yet</div>
                                    <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Load a built-in template and click "Save Preset" to store it here</div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                    {savedFiltered.map(p => {
                                        const isActive = p.id === activePresetId;
                                        return (
                                            <div
                                                key={p.id}
                                                style={{
                                                    background: isActive ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.5)',
                                                    border: `1.5px solid ${isActive ? 'var(--primary, #3b82f6)' : '#334155'}`,
                                                    borderRadius: 12,
                                                    padding: '1rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.5rem',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#60a5fa', marginTop: 2 }}>
                                                            {p.category || 'General'} · {p.label_width}×{p.label_height}mm
                                                        </div>
                                                    </div>
                                                    <button type="button" className="btn-icon" onClick={() => onToggleFavorite(p.id)} style={{ flexShrink: 0 }}>
                                                        <Star size={15} fill={p.is_favorite ? '#f59e0b' : 'none'} color={p.is_favorite ? '#f59e0b' : '#94a3b8'} />
                                                    </button>
                                                </div>

                                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                                    {p.is_default && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '2px 7px', borderRadius: 4 }}>DEFAULT</span>}
                                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', background: 'rgba(148,163,184,0.1)', padding: '2px 7px', borderRadius: 4 }}>
                                                        {p.paper_type === 'sheet' ? 'A4 Sheet' : 'Thermal Roll'}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(51,65,85,0.5)' }}>
                                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                        {!p.is_default && (
                                                            <button type="button" className="btn-icon" onClick={() => onSetDefaultPreset(p.id)} title="Set as Default">
                                                                <Check size={14} />
                                                            </button>
                                                        )}
                                                        <button type="button" className="btn-icon" onClick={() => onDuplicatePreset(p.id)} title="Duplicate">
                                                            <Copy size={14} />
                                                        </button>
                                                        <button type="button" className="btn-icon" onClick={() => handleExport(p)} title="Export JSON">
                                                            <Download size={14} />
                                                        </button>
                                                        {!p.is_default && (
                                                            <button type="button" className="btn-icon" onClick={() => onDeletePreset(p.id)} style={{ color: '#ef4444' }} title="Delete">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                                                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                                                        onClick={() => {
                                                            onSelectPreset(p);
                                                            onClose();
                                                            toast.success(`Loaded: ${p.name}`);
                                                        }}
                                                    >
                                                        {isActive ? '✓ Active' : 'Load'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PresetManagerModal;

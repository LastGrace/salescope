import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

import DesignerToolbar from './components/DesignerToolbar';
import ElementsSidebar from './components/ElementsSidebar';
import CanvasEditor from './components/CanvasEditor';
import InspectorSidebar from './components/InspectorSidebar';
import PrintQueueTable from './components/PrintQueueTable';
import ProductSelectorModal from './components/ProductSelectorModal';
import LivePrintPreviewModal from './components/LivePrintPreviewModal';
import PresetManagerModal from './components/PresetManagerModal';
import PrinterProfileModal from './components/PrinterProfileModal';

import './styles/BarcodeStudio.css';
import useSessionState from '../../hooks/useSessionState';

const BarcodeStudio = () => {
    // Mode: 'designer' or 'queue'
    const [mode, setMode] = useSessionState('bs_mode', 'designer');

    // Presets list & active preset
    const [presets, setPresets] = useState([]);
    const [activePreset, setActivePreset] = useSessionState('bs_activePreset', {
        id: null,
        name: 'Product Barcode (Standard)',
        category: 'Product Barcode',
        label_width: 50.00,
        label_height: 25.00,
        paper_type: 'thermal',
        page_layout: { rows: 1, cols: 1, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapH: 0, gapV: 0 },
        canvas_data: [
            { id: '1', type: 'text', text: '{{shop_name}}', x: 2, y: 1.5, width: 46, height: 4.5, fontSize: 10, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: '2', type: 'text', text: '{{product_name}}', x: 2, y: 6.2, width: 46, height: 4, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' },
            { id: '3', type: 'barcode', format: 'CODE128', text: '{{barcode}}', x: 5, y: 10.5, width: 40, height: 9.5, showText: true, fontSize: 8, visibility: 'always' },
            { id: '4', type: 'text', text: 'MRP: ₹{{mrp}}', x: 2, y: 20.5, width: 46, height: 3.8, fontSize: 9, fontWeight: 'bold', align: 'center', color: '#000000', visibility: 'always' }
        ]
    });

    // Printer Profiles
    const [printerProfiles, setPrinterProfiles] = useState([]);
    const [activePrinterProfile, setActivePrinterProfile] = useState({});

    // Store Settings
    const [storeInfo, setStoreInfo] = useState({ store_name: 'SaleScope' });

    // Canvas Selection & History
    const [selectedElementId, setSelectedElementId] = useState(null);
    const [history, setHistory] = useSessionState('bs_history', []);
    const [historyIndex, setHistoryIndex] = useSessionState('bs_historyIndex', -1);

    // Zoom & Grid
    const [zoom, setZoom] = useSessionState('bs_zoom', 1.5);
    const [showGrid, setShowGrid] = useSessionState('bs_showGrid', true);

    // Print Batch Queue
    const [queue, setQueue] = useSessionState('bs_queue', []);

    // Modals
    const [showProductSelector, setShowProductSelector] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [showPrinterModal, setShowPrinterModal] = useState(false);

    const canvasRef = useRef(null);

    // Products catalog for sample selection
    const [products, setProducts] = useState([]);

    // Sample Product Data for live designer preview
    const [sampleProduct, setSampleProduct] = useSessionState('bs_sampleProduct', {
        id: 'default',
        name: 'MEN COTTON T-SHIRT',
        barcode: '8901234567890',
        sku: 'TSH-BLK-M',
        price: '499.00',
        mrp: '999.00',
        cost_price: '250.00',
        brand: 'URBAN STYLE',
        category: 'Apparel',
        weight: '0.2',
        batch: 'B2026-07',
        expiry: '12/2028',
        hsn: '61091000'
    });

    useEffect(() => {
        fetchPresets();
        fetchPrinterProfiles();
        fetchStoreSettings();
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            let data = [];
            try {
                const res = await axios.get('/api/barcode/batch-products?limit=9999999');
                data = Array.isArray(res.data) ? res.data : (res.data?.products || []);
            } catch {
                const res = await axios.get('/api/products?limit=9999999');
                data = Array.isArray(res.data) ? res.data : (res.data?.products || []);
            }
            setProducts(data);
        } catch (err) {
            console.error('Failed to load products:', err);
        }
    };

    const fetchPresets = async () => {
        try {
            const res = await axios.get('/api/barcode/presets');
            if (res.data && res.data.length > 0) {
                setPresets(res.data);
                setActivePreset(prev => {
                    if (prev && prev.id !== null) return prev;
                    return res.data.find(p => p.is_default) || res.data[0];
                });
            }
        } catch (e) {
            console.error('Fetch presets error:', e);
        }
    };

    const fetchPrinterProfiles = async () => {
        try {
            const res = await axios.get('/api/barcode/printer-profiles');
            if (res.data && res.data.length > 0) {
                setPrinterProfiles(res.data);
                const def = res.data.find(p => p.is_default) || res.data[0];
                setActivePrinterProfile(def);
            }
        } catch (e) {
            console.error('Fetch printer profiles error:', e);
        }
    };

    const fetchStoreSettings = async () => {
        try {
            const res = await axios.get('/api/settings/store');
            if (res.data) setStoreInfo(res.data);
        } catch (e) { }
    };

    // Canvas Edit Handlers
    const updateCanvasElements = (newElements) => {
        const nextPreset = { ...activePreset, canvas_data: newElements };
        setActivePreset(nextPreset);

        // Push history
        const newHist = history.slice(0, historyIndex + 1);
        newHist.push(newElements);
        setHistory(newHist);
        setHistoryIndex(newHist.length - 1);
    };

    const handleAddElement = (type) => {
        const id = Date.now().toString();
        let newEl = {
            id,
            type,
            x: 2,
            y: 2,
            width: 20,
            height: 10,
            rotation: 0,
            zIndex: (activePreset.canvas_data || []).length + 1,
            visibility: 'always'
        };

        if (type === 'text') {
            newEl = { ...newEl, text: 'New Text', width: 30, height: 5, fontSize: 9, align: 'left', color: '#000000' };
        } else if (type === 'barcode') {
            newEl = { ...newEl, text: '{{barcode}}', format: 'CODE128', width: 35, height: 10, showText: true };
        } else if (type === 'qrcode') {
            newEl = { ...newEl, text: '{{barcode}}', width: 15, height: 15 };
        } else if (type === 'rectangle') {
            newEl = { ...newEl, width: 25, height: 15, background: 'transparent', borderColor: '#000000', borderWidth: 1 };
        } else if (type === 'circle') {
            newEl = { ...newEl, width: 15, height: 15, background: 'transparent', borderColor: '#000000', borderWidth: 1 };
        } else if (type === 'image') {
            newEl = { ...newEl, src: '/Salescope.png', width: 15, height: 15 };
        }

        const nextElements = [...(activePreset.canvas_data || []), newEl];
        updateCanvasElements(nextElements);
        setSelectedElementId(id);
    };

    const handleAddPlaceholder = (placeholderKey) => {
        const id = Date.now().toString();
        const newEl = {
            id,
            type: 'text',
            text: placeholderKey,
            x: 2,
            y: 2,
            width: 35,
            height: 5,
            fontSize: 9,
            fontWeight: 'normal',
            align: 'left',
            color: '#000000',
            rotation: 0,
            zIndex: (activePreset.canvas_data || []).length + 1,
            visibility: 'always'
        };
        updateCanvasElements([...(activePreset.canvas_data || []), newEl]);
        setSelectedElementId(id);
    };

    const handleUpdateElement = (id, props) => {
        const nextElements = (activePreset.canvas_data || []).map(el => el.id === id ? { ...el, ...props } : el);
        updateCanvasElements(nextElements);
    };

    const handleMoveLayer = (id, direction) => {
        const list = [...(activePreset.canvas_data || [])];
        const idx = list.findIndex(el => el.id === id);
        if (idx === -1) return;

        if (direction === 'up' && idx < list.length - 1) {
            const temp = list[idx];
            list[idx] = list[idx + 1];
            list[idx + 1] = temp;
        } else if (direction === 'down' && idx > 0) {
            const temp = list[idx];
            list[idx] = list[idx - 1];
            list[idx - 1] = temp;
        }

        updateCanvasElements(list);
    };

    const handleToggleLock = (id) => {
        const nextElements = (activePreset.canvas_data || []).map(el => el.id === id ? { ...el, locked: !el.locked } : el);
        updateCanvasElements(nextElements);
    };

    const handleDeleteElement = (id) => {
        const nextElements = (activePreset.canvas_data || []).filter(el => el.id !== id);
        updateCanvasElements(nextElements);
        if (selectedElementId === id) setSelectedElementId(null);
    };

    const handleReorderElements = (reorderedElements) => {
        updateCanvasElements(reorderedElements);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setActivePreset({ ...activePreset, canvas_data: history[historyIndex - 1] });
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setActivePreset({ ...activePreset, canvas_data: history[historyIndex + 1] });
        }
    };

    // Save Preset API
    const handleSavePreset = async () => {
        try {
            if (activePreset.id) {
                await axios.put(`/api/barcode/presets/${activePreset.id}`, activePreset);
                toast.success(`Preset "${activePreset.name}" updated!`);
            } else {
                const res = await axios.post('/api/barcode/presets', activePreset);
                setActivePreset({ ...activePreset, id: res.data.id });
                toast.success(`Preset "${activePreset.name}" created!`);
            }
            fetchPresets();
        } catch (e) {
            console.error('Save preset error:', e);
            toast.error('Failed to save preset');
        }
    };

    // Batch Queue Handlers
    const handleAddProductsToQueue = (selectedProducts) => {
        const newQueue = [...queue];
        selectedProducts.forEach(p => {
            const uid = `${p.id}-${Date.now()}-${Math.random()}`;
            newQueue.push({ ...p, uid, printQty: p.printQty || 1, priceMode: 'selling_price' });
        });
        setQueue(newQueue);
        toast.success(`Added ${selectedProducts.length} items to print queue`);
    };

    const handleUpdateQueueQty = (uid, qty) => {
        setQueue(queue.map(item => item.uid === uid ? { ...item, printQty: Math.max(1, qty) } : item));
    };

    const handleUpdateQueuePriceMode = (uid, mode) => {
        setQueue(queue.map(item => item.uid === uid ? { ...item, priceMode: mode } : item));
    };

    const handleRemoveFromQueue = (uid) => {
        setQueue(queue.filter(item => item.uid !== uid));
    };

    const selectedElement = (activePreset.canvas_data || []).find(el => el.id === selectedElementId);

    return (
        <div className="barcode-studio-container">
            {/* Top Toolbar */}
            <DesignerToolbar
                preset={activePreset}
                onSave={handleSavePreset}
                onDuplicate={() => { }}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={historyIndex > 0}
                canRedo={historyIndex < history.length - 1}
                zoom={zoom}
                setZoom={setZoom}
                showGrid={showGrid}
                setShowGrid={setShowGrid}
                products={products}
                sampleProduct={sampleProduct}
                setSampleProduct={setSampleProduct}
                onOpenPreview={() => setShowPreviewModal(true)}
                onOpenPrintBatch={() => setMode('queue')}
                onOpenPresetsModal={() => setShowPresetModal(true)}
                onOpenPrinterProfilesModal={() => setShowPrinterModal(true)}
            />

            {/* Mode Selector Tabs */}
            <div className="studio-mode-row">
                <div className="studio-nav-tabs">
                    <button
                        type="button"
                        className={`studio-tab-btn ${mode === 'designer' ? 'active' : ''}`}
                        onClick={() => setMode('designer')}
                    >
                        🎨 Designer Canvas
                    </button>
                    <button
                        type="button"
                        className={`studio-tab-btn ${mode === 'queue' ? 'active' : ''}`}
                        onClick={() => setMode('queue')}
                    >
                        🖨️ Print Batch Queue ({queue.reduce((acc, i) => acc + (parseInt(i.printQty) || 0), 0)})
                    </button>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Preset: <strong style={{ color: '#94a3b8' }}>{activePreset.name}</strong>
                    {' · '}{activePreset.label_width}×{activePreset.label_height}mm
                </div>
            </div>

            {/* Main Workbench View */}
            {mode === 'designer' ? (
                <div className="studio-workbench">
                    <ElementsSidebar
                        elements={activePreset.canvas_data || []}
                        selectedId={selectedElementId}
                        setSelectedId={setSelectedElementId}
                        onAddElement={handleAddElement}
                        onAddPlaceholder={handleAddPlaceholder}
                        onMoveLayer={handleMoveLayer}
                        onToggleLock={handleToggleLock}
                        onDeleteElement={handleDeleteElement}
                        onReorderElements={handleReorderElements}
                    />

                    <CanvasEditor
                        preset={activePreset}
                        elements={activePreset.canvas_data || []}
                        selectedId={selectedElementId}
                        setSelectedId={setSelectedElementId}
                        onUpdateElement={handleUpdateElement}
                        zoom={zoom}
                        showGrid={showGrid}
                        sampleProduct={{ ...sampleProduct, store: storeInfo }}
                        canvasRef={canvasRef}
                    />

                    <InspectorSidebar
                        preset={activePreset}
                        onUpdatePreset={(props) => setActivePreset({ ...activePreset, ...props })}
                        selectedElement={selectedElement}
                        onUpdateElement={handleUpdateElement}
                    />
                </div>
            ) : (
                <PrintQueueTable
                    queue={queue}
                    onUpdateQty={handleUpdateQueueQty}
                    onUpdatePriceMode={handleUpdateQueuePriceMode}
                    onRemoveFromQueue={handleRemoveFromQueue}
                    onClearQueue={() => setQueue([])}
                    onOpenProductSelector={() => setShowProductSelector(true)}
                    onOpenPreview={() => setShowPreviewModal(true)}
                />
            )}

            {/* Modals */}
            <ProductSelectorModal
                isOpen={showProductSelector}
                onClose={() => setShowProductSelector(false)}
                onAddProductsToQueue={handleAddProductsToQueue}
            />

            <LivePrintPreviewModal
                isOpen={showPreviewModal}
                onClose={() => setShowPreviewModal(false)}
                preset={activePreset}
                presets={presets}
                onSelectPreset={(p) => setActivePreset(p)}
                printerProfile={activePrinterProfile}
                queue={queue.length > 0 ? queue : [{ ...sampleProduct, printQty: 1 }]}
                storeInfo={storeInfo}
            />

            <PresetManagerModal
                isOpen={showPresetModal}
                onClose={() => setShowPresetModal(false)}
                presets={presets}
                activePresetId={activePreset.id}
                onSelectPreset={(p) => setActivePreset(p)}
                onDuplicatePreset={async (id) => {
                    await axios.post(`/api/barcode/presets/${id}/duplicate`);
                    fetchPresets();
                    toast.success('Preset duplicated!');
                }}
                onSetDefaultPreset={async (id) => {
                    await axios.post(`/api/barcode/presets/${id}/default`);
                    fetchPresets();
                }}
                onToggleFavorite={async (id) => {
                    await axios.post(`/api/barcode/presets/${id}/favorite`);
                    fetchPresets();
                }}
                onDeletePreset={async (id) => {
                    await axios.delete(`/api/barcode/presets/${id}`);
                    fetchPresets();
                    toast.success('Preset deleted!');
                }}
                onImportPreset={async (json) => {
                    await axios.post('/api/barcode/presets/import', json);
                    fetchPresets();
                }}
            />

            <PrinterProfileModal
                isOpen={showPrinterModal}
                onClose={() => setShowPrinterModal(false)}
                profiles={printerProfiles}
                activeProfileId={activePrinterProfile.id}
                onSelectProfile={(pr) => setActivePrinterProfile(pr)}
                onSaveProfile={async (pr) => {
                    if (pr.id) await axios.put(`/api/barcode/printer-profiles/${pr.id}`, pr);
                    else await axios.post('/api/barcode/printer-profiles', pr);
                    fetchPrinterProfiles();
                }}
                onDeleteProfile={async (id) => {
                    await axios.delete(`/api/barcode/printer-profiles/${id}`);
                    fetchPrinterProfiles();
                }}
                onSetDefaultProfile={async (id) => {
                    await axios.post(`/api/barcode/printer-profiles/${id}/default`);
                    fetchPrinterProfiles();
                }}
            />
        </div>
    );
};

export default BarcodeStudio;

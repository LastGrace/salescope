import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit, Trash, ChevronRight, Folder, FolderOpen, Layers, Hash, Info, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/CategoryManager.css';

const CategoryManager = () => {
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);

    // Selection States
    const [selectedCatIds, setSelectedCatIds] = useState(new Set());
    const [selectedSubIds, setSelectedSubIds] = useState(new Set());

    // Form States
    const [catForm, setCatForm] = useState({ name: '' });
    const [subForm, setSubForm] = useState({ name: '' });

    // Confirmation Modal State
    const [confirmAction, setConfirmAction] = useState({ isOpen: false, type: 'category', target: 'single', id: null, title: '', message: '' });

    // Edit States
    const [editingCategory, setEditingCategory] = useState(null);
    const [editingSubcategory, setEditingSubcategory] = useState(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        if (selectedCategory) {
            fetchSubcategories(selectedCategory.id);
            setSelectedSubIds(new Set());
        } else {
            setSubcategories([]);
            setSelectedSubIds(new Set());
        }
    }, [selectedCategory]);

    const fetchCategories = async () => {
        try {
            const res = await axios.get('/api/categories');
            setCategories(res.data);
            if (selectedCategory && !res.data.find(c => c.id === selectedCategory.id)) {
                setSelectedCategory(null);
            }
        } catch (err) {
            toast.error('Failed to load categories');
        }
    };

    const fetchSubcategories = async (categoryId) => {
        try {
            const res = await axios.get(`/api/subcategories?category_id=${categoryId}`);
            setSubcategories(res.data);
        } catch (err) {
            toast.error('Failed to load subcategories');
        }
    };

    // Selection Handlers
    const toggleCatAll = () => {
        if (selectedCatIds.size === categories.length) setSelectedCatIds(new Set());
        else setSelectedCatIds(new Set(categories.map(c => c.id)));
    };

    const toggleCat = (id, e) => {
        e.stopPropagation();
        const next = new Set(selectedCatIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedCatIds(next);
    };

    const toggleSubAll = () => {
        if (selectedSubIds.size === subcategories.length) setSelectedSubIds(new Set());
        else setSelectedSubIds(new Set(subcategories.map(s => s.id)));
    };

    const toggleSub = (id, e) => {
        e.stopPropagation();
        const next = new Set(selectedSubIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedSubIds(next);
    };

    const handleBulkDelete = (type) => {
        const count = type === 'category' ? selectedCatIds.size : selectedSubIds.size;
        setConfirmAction({
            isOpen: true,
            type,
            target: 'bulk',
            title: `Delete ${count} ${type}s`,
            message: `Are you sure you want to delete ${count} ${type}s? ${type === 'category' ? 'Associated subcategories and product mappings will be affected.' : 'This will affect product mappings.'}`
        });
    };

    const confirmDeleteAction = async () => {
        try {
            if (confirmAction.target === 'bulk') {
                const endpoint = confirmAction.type === 'category' ? '/api/categories/bulk-delete' : '/api/subcategories/bulk-delete';
                const ids = Array.from(confirmAction.type === 'category' ? selectedCatIds : selectedSubIds);
                await axios.post(endpoint, { ids });
                toast.success(`${ids.length} ${confirmAction.type}s deleted`);
                if (confirmAction.type === 'category') {
                    setSelectedCatIds(new Set());
                    fetchCategories();
                } else {
                    setSelectedSubIds(new Set());
                    fetchSubcategories(selectedCategory.id);
                }
            } else {
                const endpoint = confirmAction.type === 'category' ? `/api/categories/${confirmAction.id}` : `/api/subcategories/${confirmAction.id}`;
                await axios.delete(endpoint);
                toast.success(`${confirmAction.type === 'category' ? 'Category' : 'Subcategory'} deleted`);
                if (confirmAction.type === 'category') {
                    fetchCategories();
                    if (selectedCategory?.id === confirmAction.id) setSelectedCategory(null);
                } else {
                    fetchSubcategories(selectedCategory.id);
                }
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error occurred');
        }
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        try {
            if (editingCategory) {
                await axios.put(`/api/categories/${editingCategory.id}`, catForm);
                toast.success('Category updated');
            } else {
                await axios.post('/api/categories', catForm);
                toast.success('Category created');
            }
            fetchCategories();
            setCatForm({ name: '' });
            setEditingCategory(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save category');
        }
    };

    const handleDeleteCategory = (id, e) => {
        e.stopPropagation();
        setConfirmAction({
            isOpen: true,
            type: 'category',
            target: 'single',
            id,
            title: 'Delete Category',
            message: 'Are you sure you want to delete this category? All associated subcategories will also be permanently deleted.'
        });
    };

    const handleSaveSubcategory = async (e) => {
        e.preventDefault();
        if (!selectedCategory) return;
        try {
            const payload = { ...subForm, category_id: selectedCategory.id };
            if (editingSubcategory) {
                await axios.put(`/api/subcategories/${editingSubcategory.id}`, payload);
                toast.success('Subcategory updated');
            } else {
                await axios.post('/api/subcategories', payload);
                toast.success('Subcategory created');
            }
            fetchSubcategories(selectedCategory.id);
            setSubForm({ name: '' });
            setEditingSubcategory(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save subcategory');
        }
    };

    const handleDeleteSubcategory = (id) => {
        setConfirmAction({
            isOpen: true,
            type: 'subcategory',
            target: 'single',
            id,
            title: 'Delete Subcategory',
            message: 'Are you sure you want to delete this subcategory?'
        });
    };

    return (
        <div className="category-manager-container category-animate">
            <header className="category-header">
                <div className="category-title-group">
                    <div className="category-icon-box"><Layers size={24} /></div>
                    <div className="category-title"><h1>Category Studio</h1><p>Organize products into hierarchical groups</p></div>
                </div>
            </header>

            <div className="category-kpi-grid">
                <div className="category-kpi-card">
                    <div className="category-kpi-info"><span className="category-kpi-label">Main Categories</span><span className="category-kpi-value">{categories.length}</span></div>
                    <div className="category-kpi-icon"><Folder size={20} /></div>
                </div>
                <div className="category-kpi-card">
                    <div className="category-kpi-info"><span className="category-kpi-label">Sub-Hierarchies</span><span className="category-kpi-value">{selectedCategory ? subcategories.length : '--'}</span></div>
                    <div className="category-kpi-icon"><Hash size={20} /></div>
                </div>
            </div>

            <main className="category-main-content">
                <div className="category-sidebar">
                    <div className="sidebar-header">
                        <div className="header-with-checkbox">
                            <input type="checkbox" className="custom-checkbox" checked={selectedCatIds.size > 0 && selectedCatIds.size === categories.length} onChange={toggleCatAll} />
                            <span className="sidebar-title">Parent Categories</span>
                        </div>
                    </div>

                    <form onSubmit={handleSaveCategory} className="category-form-compact">
                        <input className="input" style={{ height: '36px', fontSize: '0.8125rem' }} placeholder={editingCategory ? "Update..." : "New..."} value={catForm.name} onChange={e => setCatForm({ name: e.target.value })} required />
                        <button type="submit" className="btn btn-primary" style={{ padding: '0 0.75rem' }}>{editingCategory ? 'Save' : <Plus size={16} />}</button>
                        {editingCategory && <button type="button" className="btn-icon" onClick={() => { setEditingCategory(null); setCatForm({ name: '' }); }}><X size={16} /></button>}
                    </form>

                    <div className="category-list custom-scrollbar">
                        {categories.length === 0 ? (
                            <div className="empty-state"><Folder size={32} /><p>No categories found</p></div>
                        ) : (
                            categories.map(cat => (
                                <div key={cat.id} className={`category-item ${selectedCategory?.id === cat.id ? 'active' : ''} ${selectedCatIds.has(cat.id) ? 'row-selected' : ''}`} onClick={() => setSelectedCategory(cat)}>
                                    <div className="checkbox-cell" onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" className="custom-checkbox" checked={selectedCatIds.has(cat.id)} onChange={e => toggleCat(cat.id, e)} />
                                    </div>
                                    <div className="item-icon">{selectedCategory?.id === cat.id ? <FolderOpen size={18} /> : <Folder size={18} />}</div>
                                    <span className="item-name">{cat.name}</span>
                                    <div className="item-actions">
                                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setCatForm({ name: cat.name }); }}><Edit size={14} /></button>
                                        <button className="btn-icon" style={{ color: '#ef4444' }} onClick={(e) => handleDeleteCategory(cat.id, e)}><Trash size={14} /></button>
                                    </div>
                                    <ChevronRight size={14} style={{ opacity: 0.3 }} />
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="category-detail-panel">
                    {selectedCategory ? (
                        <>
                            <div className="detail-header">
                                <div className="breadcrumb"><span>Inventory</span><ChevronRight size={12} /><span>Categories</span></div>
                                <h2 className="detail-title">{selectedCategory.name}</h2>
                            </div>
                            <div className="category-form-compact" style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <input type="checkbox" className="custom-checkbox" checked={selectedSubIds.size > 0 && selectedSubIds.size === subcategories.length} onChange={toggleSubAll} />
                                <div style={{ flex: 1, display: 'flex', gap: '0.75rem' }}>
                                    <input className="input" placeholder={editingSubcategory ? "Edit Subcategory" : "Add new subcategory..."} value={subForm.name} onChange={e => setSubForm({ name: e.target.value })} required />
                                    <button type="submit" className="btn btn-primary" onClick={handleSaveSubcategory}>{editingSubcategory ? 'Update' : 'Create'}</button>
                                    {editingSubcategory && <button type="button" className="btn" onClick={() => { setEditingSubcategory(null); setSubForm({ name: '' }); }}>Cancel</button>}
                                </div>
                            </div>

                            <div className="subcategory-list custom-scrollbar">
                                {subcategories.length === 0 ? (
                                    <div className="empty-state"><Layers size={48} /><p>No subcategories defined.</p></div>
                                ) : (
                                    <div className="subcategory-grid">
                                        {subcategories.map(sub => (
                                            <div key={sub.id} className={`subcategory-card ${selectedSubIds.has(sub.id) ? 'row-selected' : ''}`} onClick={(e) => toggleSub(sub.id, e)}>
                                                <div className="sub-info">
                                                    <input type="checkbox" className="custom-checkbox" checked={selectedSubIds.has(sub.id)} onChange={e => toggleSub(sub.id, e)} />
                                                    <Hash size={16} className="text-muted" />
                                                    <span className="sub-name">{sub.name}</span>
                                                </div>
                                                <div className="item-actions" style={{ opacity: 1 }}>
                                                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setEditingSubcategory(sub); setSubForm({ name: sub.name }); }}><Edit size={14} /></button>
                                                    <button className="btn-icon" style={{ color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); handleDeleteSubcategory(sub.id); }}><Trash size={14} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <div style={{ padding: '2rem', background: 'rgba(225, 29, 72, 0.05)', borderRadius: '50%', marginBottom: '1.5rem' }}><FolderOpen size={48} className="text-primary" /></div>
                            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Parent Selected</h3>
                            <p style={{ maxWidth: '300px' }}>Choose a category from the sidebar to manage its nested sub-hierarchies.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Contextual Bulk Action Bar */}
            <div className={`bulk-actions-bar ${(selectedCatIds.size > 0 || selectedSubIds.size > 0) ? 'visible' : ''}`}>
                <span className="selected-count">
                    {selectedCatIds.size > 0 ? `${selectedCatIds.size} Categories` : `${selectedSubIds.size} Subcategories`} Selected
                </span>
                <button className="bulk-btn-delete" onClick={() => handleBulkDelete(selectedCatIds.size > 0 ? 'category' : 'subcategory')}>
                    <Trash size={16} /> Delete Selected
                </button>
                <button className="bulk-btn-cancel" onClick={() => { setSelectedCatIds(new Set()); setSelectedSubIds(new Set()); }}>Cancel</button>
            </div>

            <ConfirmModal
                isOpen={confirmAction.isOpen}
                onClose={() => setConfirmAction({ ...confirmAction, isOpen: false })}
                onConfirm={confirmDeleteAction}
                title={confirmAction.title}
                message={confirmAction.message}
                type="danger"
            />
        </div>
    );
};

export default CategoryManager;

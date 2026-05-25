import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';
import { Save, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './RoleManager.css';

const RoleManager = () => {
    const navigate = useNavigate();
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);

    // New Role Modal
    const [showModal, setShowModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDesc, setNewRoleDesc] = useState('');

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [rolesRes, permsRes] = await Promise.all([
                axios.get('/api/roles'),
                axios.get('/api/roles/permissions')
            ]);
            setRoles(rolesRes.data);
            setPermissions(permsRes.data);
            setLoading(false);
        } catch (err) {
            toast.error('Failed to load roles data');
            setLoading(false);
        }
    };

    const handlePermissionToggle = (roleId, permId) => {
        const role = roles.find(r => r.id === roleId);
        if (role.is_system && role.name === 'Super Admin') return; // Cannot edit Super Admin

        const currentPerms = role.permissions ? role.permissions.map(p => p.id) : [];
        const hasPerm = currentPerms.includes(permId);

        let newPerms;
        if (hasPerm) {
            newPerms = currentPerms.filter(id => id !== permId);
        } else {
            newPerms = [...currentPerms, permId];
        }

        // Optimistic UI Update
        const updatedRoles = roles.map(r => {
            if (r.id === roleId) {
                return {
                    ...r,
                    permissions: newPerms.map(pid => permissions.find(p => p.id === pid))
                };
            }
            return r;
        });
        setRoles(updatedRoles);

        saveRolePermissions(roleId, role.name, role.description, newPerms);
    };

    const saveRolePermissions = async (roleId, name, description, permIds) => {
        try {
            await axios.put(`/api/roles/${roleId}`, {
                name,
                description,
                permissions: permIds
            });
        } catch (err) {
            toast.error('Failed to update permission');
            fetchData(); // Revert
        }
    };

    const createRole = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/roles', {
                name: newRoleName,
                description: newRoleDesc,
                permissions: []
            });
            toast.success('Role created');
            setNewRoleName('');
            setNewRoleDesc('');
            setShowModal(false);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create role');
        }
    };

    const deleteRole = async (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Role',
            message: 'Are you sure you want to delete this role? This might affect employees assigned to it.',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/roles/${id}`);
                    toast.success('Role deleted');
                    fetchData();
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to delete role');
                }
            }
        });
    };

    // Group permissions by category
    const groupedPermissions = permissions.reduce((acc, perm) => {
        if (!acc[perm.category]) acc[perm.category] = [];
        acc[perm.category].push(perm);
        return acc;
    }, {});

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="role-page-container">
            <div className="role-header">
                <div className="role-title-section">
                    <button onClick={() => navigate('/employees')} className="btn-back">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="role-page-title">Role Management</h1>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="btn-create-role"
                >
                    <Plus size={20} /> Create New Role
                </button>
            </div>

            <div className="matrix-container">
                <div className="table-scroll-area">
                    <table className="permission-table">
                        <thead>
                            <tr>
                                <th className="sticky-header-perm">
                                    Permission
                                </th>
                                {roles.map(role => (
                                    <th key={role.id} className="sticky-header-role">
                                        <div className="role-header-content">
                                            <div className="role-name-row">
                                                <span className="role-name">{role.name}</span>
                                                {!role.is_system && (
                                                    <button
                                                        onClick={() => deleteRole(role.id)}
                                                        className="btn-delete-role"
                                                        title="Delete Role"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <span className="role-desc" title={role.description}>
                                                {role.description}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(groupedPermissions).map(([category, perms]) => (
                                <React.Fragment key={category}>
                                    <tr className="bg-gray-100-50">
                                        <td colSpan={roles.length + 1} className="category-row-cell">
                                            {category}
                                        </td>
                                    </tr>
                                    {perms.map(perm => (
                                        <tr key={perm.id} className="permission-row">
                                            <td className="permission-cell-sticky">
                                                <div className="perm-name">{perm.name}</div>
                                                <div className="perm-desc">{perm.description}</div>
                                            </td>
                                            {roles.map(role => {
                                                const isChecked = role.permissions?.some(p => p.id === perm.id);
                                                const isSuperAdmin = role.name === 'Super Admin';
                                                return (
                                                    <td key={role.id} className="checkbox-cell">
                                                        <div className="checkbox-center">
                                                            <input
                                                                type="checkbox"
                                                                className={`w-5 h-5 rounded cursor-pointer transition-colors ${isSuperAdmin
                                                                    ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                                                                    : 'text-indigo-600 focus:ring-indigo-500 border-gray-300'
                                                                    }`}
                                                                checked={isChecked || isSuperAdmin}
                                                                disabled={isSuperAdmin}
                                                                onChange={() => handlePermissionToggle(role.id, perm.id)}
                                                            />
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Create Role Modal */}
                {showModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h2 className="modal-title">Create New Role</h2>
                            <form onSubmit={createRole}>
                                <div className="form-group">
                                    <label className="form-label">Role Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={newRoleName}
                                        onChange={(e) => setNewRoleName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea
                                        className="form-textarea"
                                        value={newRoleDesc}
                                        onChange={(e) => setNewRoleDesc(e.target.value)}
                                    />
                                </div>
                                <div className="modal-actions">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="btn-ghost-custom"
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-create-role">
                                        Create Role
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type="danger"
            />
        </div>
    );
};

export default RoleManager;

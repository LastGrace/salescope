import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Save, ArrowLeft, Check, X, Shield, User } from 'lucide-react';
import './EmployeePermissions.css';

const EmployeePermissions = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [employee, setEmployee] = useState(null);
    const [allPermissions, setAllPermissions] = useState([]);
    const [assignedPermissions, setAssignedPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const [empRes, allPermsRes, empPermsRes] = await Promise.all([
                axios.get(`/api/employees/${id}`),
                axios.get('/api/employees/permissions/all'),
                axios.get(`/api/employees/${id}/permissions`)
            ]);

            setEmployee(empRes.data);
            setAllPermissions(allPermsRes.data);
            setAssignedPermissions(empPermsRes.data.map(p => p.id));
            setLoading(false);
        } catch (err) {
            toast.error('Failed to load data');
            setLoading(false);
        }
    };

    // Group permissions by category/module
    const groupedPermissions = allPermissions.reduce((acc, perm) => {
        const key = perm.category || perm.module || 'Other';
        if (!acc[key]) acc[key] = [];
        acc[key].push(perm);
        return acc;
    }, {});

    const togglePermission = (permId) => {
        if (employee?.is_system) return; // Cannot modify Super Admin

        setAssignedPermissions(prev => {
            if (prev.includes(permId)) {
                return prev.filter(id => id !== permId);
            } else {
                return [...prev, permId];
            }
        });
    };

    const toggleModule = (modulePerms) => {
        if (employee?.is_system) return;

        const permIds = modulePerms.map(p => p.id);
        const allChecked = permIds.every(id => assignedPermissions.includes(id));

        setAssignedPermissions(prev => {
            if (allChecked) {
                // Uncheck all in module
                return prev.filter(id => !permIds.includes(id));
            } else {
                // Check all in module
                const newSet = new Set([...prev, ...permIds]);
                return Array.from(newSet);
            }
        });
    };

    const selectAll = () => {
        if (employee?.is_system) return;
        setAssignedPermissions(allPermissions.map(p => p.id));
    };

    const clearAll = () => {
        if (employee?.is_system) return;
        setAssignedPermissions([]);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put(`/api/employees/${id}/permissions`, {
                permission_ids: assignedPermissions
            });
            toast.success('Permissions saved successfully');
            navigate('/employees');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save permissions');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Loading...</div>;
    }

    if (!employee) {
        return <div className="p-8 text-center">Employee not found</div>;
    }

    const isSystemUser = employee.is_system || employee.is_admin;

    return (
        <div className="permissions-page">
            <div className="permissions-header">
                <div className="header-left">
                    <button onClick={() => navigate('/employees')} className="btn-back">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="employee-info">
                        <div className="employee-avatar">
                            {employee.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="page-title">{employee.name}'s Permissions</h1>
                            <p className="employee-username">@{employee.username}</p>
                        </div>
                    </div>
                </div>
                <div className="header-actions">
                    {employee.is_admin && (
                        <span className="admin-badge">
                            <Shield size={16} /> Admin
                        </span>
                    )}
                    {!isSystemUser && (
                        <>
                            <button onClick={selectAll} className="btn btn-secondary">
                                Select All
                            </button>
                            <button onClick={clearAll} className="btn btn-ghost">
                                Clear All
                            </button>
                        </>
                    )}
                    <button
                        onClick={handleSave}
                        className="btn btn-primary"
                        disabled={saving || employee.is_system}
                    >
                        <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {employee.is_system && (
                <div className="system-user-notice">
                    <Shield size={20} />
                    <span>Super Admin has all permissions by default. Permissions cannot be modified.</span>
                </div>
            )}

            <div className="permissions-grid">
                {Object.entries(groupedPermissions).map(([category, perms]) => {
                    const allChecked = perms.every(p => assignedPermissions.includes(p.id) || employee.is_system);
                    const someChecked = perms.some(p => assignedPermissions.includes(p.id));

                    return (
                        <div key={category} className="permission-module">
                            <div className="module-header" onClick={() => toggleModule(perms)}>
                                <input
                                    type="checkbox"
                                    checked={allChecked}
                                    onChange={() => toggleModule(perms)}
                                    disabled={employee.is_system}
                                    className={`module-checkbox ${someChecked && !allChecked ? 'indeterminate' : ''}`}
                                />
                                <h3 className="module-title">{category}</h3>
                                <span className="perm-count">
                                    {employee.is_system ? perms.length : perms.filter(p => assignedPermissions.includes(p.id)).length}/{perms.length}
                                </span>
                            </div>
                            <div className="permission-list">
                                {perms.map(perm => (
                                    <label key={perm.id} className="permission-item">
                                        <input
                                            type="checkbox"
                                            checked={assignedPermissions.includes(perm.id) || employee.is_system}
                                            onChange={() => togglePermission(perm.id)}
                                            disabled={employee.is_system}
                                        />
                                        <div className="perm-info">
                                            <span className="perm-code">{perm.code}</span>
                                            <span className="perm-desc">{perm.description}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default EmployeePermissions;

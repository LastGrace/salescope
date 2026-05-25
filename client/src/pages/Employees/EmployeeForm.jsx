import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Save, ArrowLeft, Key } from 'lucide-react';
import '../../styles/EmployeeForm.css';

const EmployeeForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        phone: '',
        password: '',
        status: 'active',
        is_admin: false
    });
    const [permissionCount, setPermissionCount] = useState(0);

    useEffect(() => {
        if (id) {
            fetchEmployee();
        }
    }, [id]);

    const fetchEmployee = async () => {
        try {
            const [empRes, permsRes] = await Promise.all([
                axios.get(`/api/employees/${id}`),
                axios.get(`/api/employees/${id}/permissions`)
            ]);
            const emp = empRes.data;
            setFormData({
                name: emp.name,
                username: emp.username,
                phone: emp.phone || '',
                password: '',
                status: emp.status || 'active',
                is_admin: emp.is_admin || false,
                is_system: emp.is_system
            });
            setPermissionCount(permsRes.data.length);
        } catch (err) {
            toast.error('Failed to load employee details');
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (id) {
                await axios.put(`/api/employees/${id}`, formData);
                toast.success('Employee updated');
            } else {
                const res = await axios.post('/api/employees', formData);
                toast.success('Employee created');
                // Redirect to permissions page for new employee
                navigate(`/employees/${res.data.id}/permissions`);
                return;
            }
            navigate('/employees');
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to save employee';
            toast.error(msg);
        }
    };

    return (
        <div className="employee-form-container">
            <div className="employee-form-header">
                <button onClick={() => navigate('/employees')} className="back-btn">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="header-title">{id ? 'Edit Employee' : 'New Employee'}</h1>
            </div>

            <div className="employee-form-card">
                <form onSubmit={handleSubmit} className="form-stack">
                    <div className="form-grid-2">
                        <div>
                            <label className="form-label">Full Name *</label>
                            <input
                                type="text" name="name"
                                className="input"
                                value={formData.name} onChange={handleChange} required
                            />
                        </div>
                        <div>
                            <label className="form-label">Username *</label>
                            <input
                                type="text" name="username"
                                className="input"
                                value={formData.username} onChange={handleChange} required
                                disabled={!!id}
                            />
                        </div>
                    </div>

                    <div className="form-grid-1">
                        <div>
                            <label className="form-label">Phone</label>
                            <input
                                type="text" name="phone"
                                className="input"
                                value={formData.phone} onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label">{id ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                        <input
                            type="password" name="password"
                            className="input"
                            value={formData.password} onChange={handleChange}
                            required={!id}
                        />
                    </div>

                    <div className="form-grid-2">
                        <div>
                            <label className="form-label">Status</label>
                            <select
                                name="status"
                                className="input w-full"
                                value={formData.status} onChange={handleChange}
                                disabled={formData.is_system}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="is_admin"
                                    checked={formData.is_admin}
                                    onChange={handleChange}
                                    disabled={formData.is_system}
                                    className="checkbox-input"
                                />
                                <span>Admin (all permissions)</span>
                            </label>
                            {formData.is_system && (
                                <p className="error-text">Super Admin settings cannot be changed</p>
                            )}
                        </div>
                    </div>

                    {id && !formData.is_admin && (
                        <div className="permissions-box">
                            <div className="permissions-info">
                                <h3>Permissions</h3>
                                <p>
                                    {permissionCount} permissions assigned
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate(`/employees/${id}/permissions`)}
                                className="btn-secondary-flex"
                            >
                                <Key size={18} /> Manage Permissions
                            </button>
                        </div>
                    )}

                    <div className="submit-section">
                        <button type="submit" className="btn btn-primary submit-btn-full">
                            <Save size={20} /> {id ? 'Save Changes' : 'Create & Set Permissions'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EmployeeForm;

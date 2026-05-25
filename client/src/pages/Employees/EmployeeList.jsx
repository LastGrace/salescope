import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Edit, Trash2, Key, Search, Shield, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';
import '../../styles/EmployeeList.css';

const EmployeeList = () => {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await axios.get('/api/employees');
            setEmployees(res.data);
            setLoading(false);
        } catch (err) {
            toast.error('Failed to load employees');
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Employee',
            message: 'Are you sure you want to delete this employee record? This action cannot be undone.',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/employees/${id}`);
                    toast.success('Employee deleted');
                    fetchEmployees();
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to delete employee');
                }
            }
        });
    };

    const toggleStatus = async (emp) => {
        if (emp.is_system) {
            toast.error('Cannot modify Super Admin');
            return;
        }

        try {
            if (emp.status === 'active') {
                await axios.post(`/api/employees/${emp.id}/disable`);
                toast.success('Employee disabled');
            } else {
                await axios.post(`/api/employees/${emp.id}/enable`);
                toast.success('Employee enabled');
            }
            fetchEmployees();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Employees</h1>
                <div className="header-actions">
                    <div className="search-container">
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search employees..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => navigate('/employees/new')}
                        className="btn btn-primary p-2 rounded-md btn-primary-custom"
                    >
                        <Plus size={18} /> Add Employee
                    </button>
                </div>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead className="table-head">
                        <tr>
                            <th className="table-header-cell">Name</th>
                            <th className="table-header-cell">Username</th>
                            <th className="table-header-cell">Permissions</th>
                            <th className="table-header-cell">Status</th>
                            <th className="table-header-cell">Last Login</th>
                            <th className="table-header-cell text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="table-body">
                        {loading ? (
                            <tr><td colSpan="6" className="table-cell text-center text-gray-500">Loading employees...</td></tr>
                        ) : filteredEmployees.length === 0 ? (
                            <tr><td colSpan="6" className="table-cell text-center text-gray-500">No employees found</td></tr>
                        ) : (
                            filteredEmployees.map((emp) => (
                                <tr key={emp.id} className="table-row">
                                    <td className="table-cell">
                                        <div className="user-info">
                                            <div className="user-avatar-initial">
                                                {emp.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="user-name">
                                                    {emp.name}
                                                    {emp.is_admin ? (
                                                        <span className="admin-tag" title="Admin">
                                                            <Shield size={12} />
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell cell-text-main">{emp.username}</td>
                                    <td className="table-cell">
                                        <span className="permission-badge">
                                            <Key size={14} />
                                            {emp.is_system || emp.is_admin ? 'All' : emp.permission_count || 0}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        <button
                                            className={`status-toggle ${emp.status === 'active' ? 'active' : 'inactive'}`}
                                            onClick={() => toggleStatus(emp)}
                                            disabled={emp.is_system}
                                            title={emp.is_system ? 'Cannot modify Super Admin' : 'Toggle status'}
                                        >
                                            {emp.status === 'active' ? (
                                                <><ToggleRight size={18} /> Active</>
                                            ) : (
                                                <><ToggleLeft size={18} /> Inactive</>
                                            )}
                                        </button>
                                    </td>
                                    <td className="table-cell cell-text-date">
                                        {emp.last_login_at
                                            ? new Date(emp.last_login_at).toLocaleString()
                                            : 'Never'
                                        }
                                    </td>
                                    <td className="table-cell text-right">
                                        <div className="action-buttons">
                                            <button
                                                onClick={() => navigate(`/employees/${emp.id}/permissions`)}
                                                className="btn-action btn-permissions"
                                                title="Manage Permissions"
                                            >
                                                <Key size={18} />
                                            </button>
                                            <button
                                                onClick={() => navigate(`/employees/edit/${emp.id}`)}
                                                className="btn-action btn-edit"
                                                title="Edit"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            {!emp.is_system && (
                                                <button
                                                    onClick={() => handleDelete(emp.id)}
                                                    className="btn-action btn-delete"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
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

export default EmployeeList;


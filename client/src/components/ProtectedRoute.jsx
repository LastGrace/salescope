import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredPermission }) => {
    const { user, hasPermission, loading } = useAuth();

    if (loading) return <div>Loading...</div>;

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
        return <div className="p-4 text-center">
            <h2 className="text-xl font-bold text-red-500">Access Denied</h2>
            <p>You do not have permission to view this page.</p>
        </div>;
    }

    return children;
};

export default ProtectedRoute;

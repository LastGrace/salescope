import React from 'react';

const DashboardSkeleton = () => (
    <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
        </div>
    </div>
);

export default DashboardSkeleton;

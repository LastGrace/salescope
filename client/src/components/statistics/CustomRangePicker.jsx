import React from 'react';

const CustomRangePicker = ({ customRange, setCustomRange, onApply }) => {
    return (
        <div className="custom-range-card">
            <div className="custom-range-header">
                <span className="custom-range-label">Filter Analytics</span>
                <h3 className="card-title-lg m-0">Custom Date Range</h3>
            </div>

            <div className="custom-range-controls">
                <div className="date-input-group">
                    <label>Start Date</label>
                    <input
                        type="date"
                        className="input"
                        value={customRange.start || ''}
                        onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                    />
                </div>
                <span className="text-muted font-bold">→</span>
                <div className="date-input-group">
                    <label>End Date</label>
                    <input
                        type="date"
                        className="input"
                        value={customRange.end || ''}
                        onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                    />
                </div>
                <button
                    className="btn btn-primary"
                    style={{ padding: '0.7rem 1.5rem', borderRadius: '8px', fontWeight: '600' }}
                    onClick={onApply}
                    disabled={!customRange.start || !customRange.end}
                >
                    Apply Filter
                </button>
            </div>
        </div>
    );
};

export default CustomRangePicker;

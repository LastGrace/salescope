import React, { useState, useEffect } from 'react';

const QuantityInput = ({ value, onChange }) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (e) => {
        const newVal = e.target.value;
        setLocalValue(newVal);

        const parsed = parseInt(newVal);
        if (!isNaN(parsed) && parsed > 0) {
            onChange(parsed);
        }
    };

    const handleBlur = () => {
        if (localValue === '' || parseInt(localValue) < 1) {
            setLocalValue(1);
            onChange(1);
        } else {
            // Ensure format is clean (e.g. remove leading zeros)
            setLocalValue(parseInt(localValue));
        }
    };

    return (
        <input
            type="number"
            className="qty-input"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={(e) => e.target.select()}
        />
    );
};

export default QuantityInput;

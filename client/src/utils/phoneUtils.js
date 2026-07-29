export const normalizePhone = (rawPhone) => {
    if (!rawPhone) return { error: 'Phone number is required' };
    
    // Convert to string and remove all non-digit and non-plus characters (just to be safe)
    let clean = String(rawPhone).replace(/[^\d+]/g, '');

    // 1. If it already starts with +91 and has 10 digits after
    if (clean.startsWith('+91') && clean.length === 13) {
        return { phone: clean };
    }

    // 2. If it's a 12-digit number starting with 91
    if (clean.length === 12 && clean.startsWith('91')) {
        return { phone: '+' + clean };
    }

    // 3. If it's a 10-digit number
    // We strip any '+' first just in case they put '+1234567890'
    let digitsOnly = clean.replace(/\+/g, '');
    
    if (digitsOnly.length === 10) {
        return { phone: '+91' + digitsOnly };
    }

    if (digitsOnly.length < 10) {
        return { error: 'Phone number too short — must be 10 digits' };
    }

    if (digitsOnly.length === 11) {
        return { error: 'Invalid phone — 11-digit numbers are not accepted' };
    }

    if (digitsOnly.length === 12 && !digitsOnly.startsWith('91')) {
        return { error: '12-digit number must start with 91 (India code)' };
    }

    return { error: 'Phone number too long — enter 10-digit number only' };
};

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const buildQueryParams = (filters) => {
    const params = new URLSearchParams();

    Object.keys(filters).forEach(key => {
        const value = filters[key];
        if (value && value.length > 0) {
            if (Array.isArray(value)) {
                // If it's our special "Select All" marker, don't append anything
                // The backend will treat absence of parameter as "All"
                if (value.length === 1 && value[0] === "__ALL__") return;

                value.forEach(v => params.append(key, v));
            } else {
                if (value !== 'All') {
                    params.append(key, value);
                }
            }
        }
    });

    return params;
};

/**
 * Format a date string or object
 * @param {string|Date} dateStr 
 * @param {string} format 'dd/mm/yyyy' or 'dd-mmm-yy'
 * @returns {string} Formatted date
 */
export const formatDate = (dateStr, format = 'dd/mm/yyyy') => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const day = String(date.getDate()).padStart(2, '0');
    const monthIndex = date.getMonth();
    const year = date.getFullYear();

    if (format === 'dd-mmm-yy') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const shortYear = String(year).slice(-2);
        return `${day}-${months[monthIndex]}-${shortYear}`;
    }

    const month = String(monthIndex + 1).padStart(2, '0');
    return `${day}/${month}/${year}`;
};

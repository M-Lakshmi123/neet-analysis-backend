const BACKEND_SERVICES = [
    'https://neet-backend-3oxu.onrender.com',
    'https://neet-backend-v2.onrender.com'
];

const getActiveBackend = () => {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || 
                   hostname === '127.0.0.1' || 
                   hostname.startsWith('192.168.') || 
                   hostname.startsWith('10.') || 
                   hostname === '0.0.0.0';

    if (isLocal) return `http://${hostname}:5000`;

    // Priority: 1. Env Var, 2. LocalSession (cached working one), 3. First Default
    const envUrl = import.meta.env?.VITE_API_URL;
    if (envUrl && !envUrl.includes('localhost')) return envUrl;

    const cached = sessionStorage.getItem('WORKING_BACKEND_URL');
    return cached || BACKEND_SERVICES[0];
};

export let API_URL = getActiveBackend();

/**
 * Validates the current API_URL and switches to backup if it fails.
 * This is called automatically by the app.
 */
export const performFailoverCheck = async () => {
    if (API_URL.includes('localhost')) return;

    try {
        const response = await fetch(`${API_URL}/api/health`);
        // If status is 503 (Render Limit) or similar failure
        if (!response.ok && response.status !== 401) throw new Error('Service Unavailable');
    } catch (error) {
        console.warn(`[Failover] Primary backend (${API_URL}) unavailable. Trying backup...`);
        const nextBackend = BACKEND_SERVICES.find(url => url !== API_URL);
        if (nextBackend) {
            API_URL = nextBackend;
            sessionStorage.setItem('WORKING_BACKEND_URL', nextBackend);
            console.info(`[Failover] Switched to backup: ${API_URL}`);
            // Force reload to ensure all components use the new API_URL
            window.location.reload();
        }
    }
};


export const ADMIN_WHATSAPP = '9281425210';

export const buildQueryParams = (filters) => {
    const params = new URLSearchParams();

    Object.keys(filters).forEach(key => {
        const value = filters[key];
        if (value !== undefined && value !== null && (typeof value === 'boolean' || typeof value === 'number' || (typeof value === 'string' && value.length > 0) || (Array.isArray(value) && value.length > 0))) {
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

    // Handle DD-MM-YYYY or DD/MM/YYYY or DD-MM-YY manually
    // Regex matches starts with 1 or 2 digits, separator, 1 or 2 digits, separator, 2 to 4 digits
    const dmyPattern = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/;
    const match = String(dateStr).match(dmyPattern);

    let date;
    if (match) {
        let yearStr = match[3];
        if (yearStr.length === 2) {
            // Assume 20xx for 2-digit years
            yearStr = '20' + yearStr;
        }
        // match[1] = day, match[2] = month, match[3] = year
        // Month is 0-indexed in JS Date
        date = new Date(parseInt(yearStr, 10), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
    } else {
        date = new Date(dateStr);
    }

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

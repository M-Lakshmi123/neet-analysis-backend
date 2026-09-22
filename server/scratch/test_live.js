(async () => {
    try {
        console.log('Fetching live backend text...');
        const res = await fetch('https://neet-backend-3oxu.onrender.com/api/erp/students?academicYear=2026&stream=SR+ELITE%28P+-+II%29&testType=MT&test=MT-05');
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Live backend response text:', text);
    } catch (e) {
        console.error('Fetch error:', e.message);
    }
})();

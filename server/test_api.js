const { buildQueryParams } = require('./utils/apiHelper'); // Oops no, we can't do this easily outside express context. 
// Just HTTP request instead
const fetch = require('node-fetch');

async function test() {
    const res = await fetch("http://localhost:5000/api/students?academicYear=2025&topAll=SUPER%20JR%20ELITE%20TOP&test=WT-01");
    const json = await res.json();
    console.log("Students for SUPER JR ELITE TOP WT-01:", json.length);

    console.log(json.map(x => x.name));

    process.exit(0);
}
test();

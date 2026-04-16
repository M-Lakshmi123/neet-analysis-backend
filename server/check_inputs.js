const puppeteer = require('puppeteer');

async function checkInputs() {
    const browser = await puppeteer.launch({
        headless: "new"
    });
    const page = await browser.newPage();
    try {
        await page.goto('https://imgbb.com/');
        const fileInputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input[type="file"]')).map(el => el.id || el.className || el.name || 'unnamed');
        });
        console.log("File Inputs: ", fileInputs);
    } catch (e) {
        console.error("Error", e);
    } finally {
        await browser.close();
    }
}

checkInputs();

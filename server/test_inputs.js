const puppeteer = require('puppeteer');

async function testUpload() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    try {
        await page.goto('https://imgbb.com/');
        const files = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input[type="file"]')).map(el => el.outerHTML);
        });
        console.log(files);
    } catch(e) {}
    await browser.close();
}
testUpload();

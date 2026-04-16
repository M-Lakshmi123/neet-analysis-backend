const puppeteer = require('puppeteer');

async function testImgBBUpload() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    try {
        await page.goto('https://imgbb.com/login', { waitUntil: 'networkidle2' });
        await page.type('#login-subject', 'siri121');
        await page.type('#login-password', '321@Siri#');
        await page.evaluate(() => document.querySelector('button[type="submit"]')?.click());
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log("Login successful.");

        await page.goto('https://siri121.imgbb.com/albums', { waitUntil: 'networkidle2' });
        const html = await page.content();
        console.log("Albums page fetched. length: " + html.length);
    } catch (e) {
        console.error("Error", e);
    } finally {
        await browser.close();
    }
}

testImgBBUpload();

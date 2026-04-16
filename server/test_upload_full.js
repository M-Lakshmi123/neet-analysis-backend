const puppeteer = require('puppeteer');
const path = require('path');

async function testUploadFull() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--window-size=1280,800']
    });
    const page = await browser.newPage();
    try {
        await page.goto('https://imgbb.com/login', { waitUntil: 'networkidle2' });
        await page.type('#login-subject', 'siri121');
        await page.type('#login-password', '321@Siri#');
        await page.evaluate(() => document.querySelector('button[type="submit"]')?.click());
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        await page.goto('https://siri121.imgbb.com/albums', { waitUntil: 'networkidle2' });
        console.log("Creating new album...");
        // just jump directly to upload inside an album, maybe we don't even need an album for this test, but let's go to /
        await page.goto('https://siri121.imgbb.com/', { waitUntil: 'networkidle2' });

        console.log("Triggering upload...");
        await page.evaluate(() => {
            const target = Array.from(document.querySelectorAll('span.btn-text, a, button'))
                .find(s => s.innerText && s.innerText.toLowerCase().includes('upload'));
            if (target) (target.closest('a, button') || target).click();
        });

        await page.waitForSelector('input[type="file"]');
        const inputUpload = await page.$('input[type="file"]');
        
        console.log("Uploading file...");
        await inputUpload.uploadFile('F:\\Projects\\dummy_test\\real.jpg');

        console.log("  Waiting for UPLOAD button...");
        await page.waitForSelector('button.btn.btn-big.green[data-action="upload"]', { visible: true, timeout: 10000 });
        await new Promise(r => setTimeout(r, 1500));
        await page.evaluate(() => document.querySelector('button.btn.btn-big.green[data-action="upload"]')?.click());

        console.log("  Uploading batch...");
        await page.waitForSelector('#uploaded-embed-toggle', { timeout: 15000 });

        console.log("  Upload complete. Extracting links...");
        await new Promise(r => setTimeout(r, 2000));
        
        await page.select('#uploaded-embed-toggle', 'direct-links');
        await page.waitForSelector('#uploaded-embed-code-1', { visible: true });
        const linksText = await page.$eval('#uploaded-embed-code-1', el => el.value);
        console.log("Links: " + linksText);
    } catch (e) {
        console.error("Error", e);
        await page.screenshot({ path: 'F:\\Projects\\error_screenshot.png' });
    } finally {
        await browser.close();
    }
}

testUploadFull();

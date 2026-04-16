const puppeteer = require('puppeteer');

async function testUploadFull() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--window-size=1280,800']
    });
    const page = await browser.newPage();
    try {
        await page.goto('https://imgbb.com/');

        await page.evaluate(() => {
            const target = Array.from(document.querySelectorAll('span.btn-text, a, button'))
                .find(s => s.innerText && s.innerText.toLowerCase().includes('upload'));
            if (target) (target.closest('a, button') || target).click();
        });

        await page.waitForSelector('#anywhere-upload-input');
        const inputUpload = await page.$('#anywhere-upload-input');
        
        console.log("Uploading file...");
        await inputUpload.uploadFile('F:\\Projects\\dummy_test\\real.jpg');
        
        await page.evaluate(() => {
            const el = document.getElementById('anywhere-upload-input');
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });

        console.log("  Waiting for UPLOAD button...");
        await page.waitForSelector('button.btn.btn-big.green[data-action="upload"]', { visible: true, timeout: 5000 });
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
        console.error("Error", e.message);
    } finally {
        await browser.close();
    }
}

testUploadFull();

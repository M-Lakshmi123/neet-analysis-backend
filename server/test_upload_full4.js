const puppeteer = require('puppeteer');
const fs = require('fs');

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
        
        await inputUpload.uploadFile('F:\\Projects\\dummy_test\\real.jpg');
        
        await page.evaluate(() => {
            const el = document.getElementById('anywhere-upload-input');
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });

        await page.waitForSelector('button.btn.btn-big.green[data-action="upload"]', { visible: true, timeout: 5000 });
        await new Promise(r => setTimeout(r, 1500));
        await page.evaluate(() => document.querySelector('button.btn.btn-big.green[data-action="upload"]')?.click());

        await page.waitForSelector('#uploaded-embed-toggle', { timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));
        
        const html = await page.content();
        fs.writeFileSync('F:\\Projects\\dummy_test\\after_upload.html', html);
        console.log("Saved after_upload.html");
    } catch (e) {
        console.error("Error", e.message);
    } finally {
        await browser.close();
    }
}

testUploadFull();

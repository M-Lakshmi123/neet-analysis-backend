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
        console.log("Success!");
    } catch (e) {
        console.error("Error", e.message);
        await page.screenshot({ path: 'F:\\Projects\\error_screenshot2.png' });
    } finally {
        await browser.close();
    }
}

testUploadFull();

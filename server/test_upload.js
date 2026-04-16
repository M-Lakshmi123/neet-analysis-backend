const puppeteer = require('puppeteer');

async function testUpload() {
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

        await page.goto('https://siri121.imgbb.com/albums', { waitUntil: 'networkidle2' });
        
        let uploadTargets = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('span.btn-text, a, button'))
                        .map(n => n.innerText)
                        .filter(text => text && text.toLowerCase().includes('upload'));
        });
        console.log("Upload elements: ", uploadTargets);
        
        // Wait for anything that looks like start uploading
        const anyUpload = await page.evaluate(() => {
                        const target = Array.from(document.querySelectorAll('span.btn-text, a, button'))
                            .find(s => s.innerText && (s.innerText.includes('Upload images') || s.innerText.includes('UPLOAD')));
                        if (target) {
                            (target.closest('a, button') || target).click();
                            return true;
                        }
                        return false;
        });
        console.log("Clicked upload button: ", anyUpload);
        
        await page.waitForSelector('input[type="file"]', { timeout: 5000 });
        console.log("Input file found.");
    } catch (e) {
        console.error("Error", e);
    } finally {
        await browser.close();
    }
}

testUpload();

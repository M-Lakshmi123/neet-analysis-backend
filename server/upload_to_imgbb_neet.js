const XLSX = require('xlsx');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function uploadToImgBB() {
    const ERP_BASE = "F:\\Projects\\NEET Analysis\\ERP Report";
    const picsBaseDir = path.join(ERP_BASE, 'PICS');

    if (!fs.existsSync(picsBaseDir)) {
        console.error("PICS directory not found: " + picsBaseDir);
        process.exit(1);
    }

    const args = process.argv.slice(2);
    const targetTest = args[0];
    const targetType = args[1]; // Ignored for folder path since it's the DB Type (e.g. NSGT)

    if (targetTest) {
        console.log(`[FILTER] Searching for Test: ${targetTest} across all streams.`);
    }

    // Iterate through Stream folders
    const streams = fs.readdirSync(picsBaseDir).filter(f => {
        return fs.statSync(path.join(picsBaseDir, f)).isDirectory();
    });

    const mappingPath = path.join(__dirname, 'url_mapping_neet.json');
    let session = {
        mappings: {} // { "StreamName": { "TestName": { Q: {}, S: {} } } }
    };

    if (fs.existsSync(mappingPath)) {
        try {
            session = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        } catch (e) {
            console.warn("Could not parse mapping cache, starting fresh.");
        }
    }

    // Check if there are existing mappings for the target test
    let hasExistingMappings = false;
    if (targetTest) {
        for (const stream in session.mappings) {
            if (session.mappings[stream][targetTest]) {
                const testMap = session.mappings[stream][targetTest];
                const qCount = Object.keys(testMap.Q || {}).length;
                const sCount = Object.keys(testMap.S || {}).length;
                if (qCount > 0 || sCount > 0) {
                    hasExistingMappings = true;
                    break;
                }
            }
        }
    }

    if (hasExistingMappings) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => {
            rl.question(`\n[WARNING] Existing URL mappings found for Test "${targetTest}". \nDo you want to delete these mappings and re-upload new images? (y/N) [Default: N]: `, (ans) => {
                resolve(ans.trim().toLowerCase());
            });
        });
        rl.close();

        if (answer === 'y' || answer === 'yes') {
            console.log(`[RESET] Deleting existing mappings for Test "${targetTest}"...`);
            for (const stream in session.mappings) {
                if (session.mappings[stream][targetTest]) {
                    delete session.mappings[stream][targetTest];
                }
            }
            fs.writeFileSync(mappingPath, JSON.stringify(session, null, 2), 'utf8');
            console.log(`[RESET] Mapping cache updated. Will re-upload all images for "${targetTest}".`);
        } else {
            console.log(`[CONTINUE] Keeping existing mappings. Only missing images will be uploaded.`);
        }
    }

    // Early exit check: see if there are actually any missing images to upload
    let hasAnyMissing = false;
    for (const stream of streams) {
        const streamPath = path.join(picsBaseDir, stream);
        const tests = fs.readdirSync(streamPath).filter(f => {
            const isDir = fs.statSync(path.join(streamPath, f)).isDirectory();
            if (targetTest) return isDir && f === targetTest;
            return isDir;
        });

        for (const test of tests) {
            const testPath = path.join(streamPath, test);
            const qDir = path.join(testPath, 'Q');
            const sDir = path.join(testPath, 'S');

            if (!fs.existsSync(qDir)) continue;

            const streamMap = session.mappings[stream] || {};
            const testMap = streamMap[test] || { Q: {}, S: {} };

            const qFiles = fs.readdirSync(qDir).filter(f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg'));
            const sFiles = fs.existsSync(sDir) ? fs.readdirSync(sDir).filter(f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg')) : [];

            const missingQ = qFiles.filter(f => {
                const qNo = f.replace(/[QS]/i, '').replace(/\.(png|jpg)/i, '');
                return !testMap.Q[qNo];
            });

            const missingS = sFiles.filter(f => {
                const qNo = f.replace(/[QS]/i, '').replace(/\.(png|jpg)/i, '');
                return !testMap.S[qNo];
            });

            if (missingQ.length > 0 || missingS.length > 0) {
                hasAnyMissing = true;
                break;
            }
        }
        if (hasAnyMissing) break;
    }

    if (!hasAnyMissing) {
        console.log(`\n✅ [INSTANT] All images for "${targetTest || 'all tests'}" already mapped. No upload needed.`);
        process.exit(0);
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized']
        });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(0);
        await page.setDefaultTimeout(0);
        await page.goto('https://imgbb.com/login', { waitUntil: 'networkidle2' });

        await page.type('#login-subject', 'siri121');
        await page.type('#login-password', '321@Siri#');
        await page.evaluate(() => document.querySelector('button[type="submit"]')?.click());
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log("Login successful.");

        for (const stream of streams) {
            const streamPath = path.join(picsBaseDir, stream);
            const tests = fs.readdirSync(streamPath).filter(f => {
                const isDir = fs.statSync(path.join(streamPath, f)).isDirectory();
                if (targetTest) return isDir && f === targetTest;
                return isDir;
            });

            for (const test of tests) {
                const testPath = path.join(streamPath, test);
                const qDir = path.join(testPath, 'Q');
                const sDir = path.join(testPath, 'S');

                if (!fs.existsSync(qDir)) {
                    console.log(`[SKIP] No Q folder for ${stream}/${test}`);
                    continue;
                }

                const ALBUM_NAME = `NEET - ${stream} - ${test}`;
                console.log(`\nProcessing Album: ${ALBUM_NAME}`);

                if (!session.mappings[stream]) session.mappings[stream] = {};
                if (!session.mappings[stream][test]) session.mappings[stream][test] = { Q: {}, S: {} };

                const qFiles = fs.readdirSync(qDir).filter(f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg'));
                const sFiles = fs.existsSync(sDir) ? fs.readdirSync(sDir).filter(f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg')) : [];

                const missingQ = qFiles.filter(f => {
                    const qNo = f.replace(/[QS]/i, '').replace(/\.(png|jpg)/i, '');
                    return !session.mappings[stream][test].Q[qNo];
                });

                const missingS = sFiles.filter(f => {
                    const qNo = f.replace(/[QS]/i, '').replace(/\.(png|jpg)/i, '');
                    return !session.mappings[stream][test].S[qNo];
                });

                if (missingQ.length === 0 && missingS.length === 0) {
                    console.log(`[INSTANT] All images for ${stream}/${test} already mapped.`);
                    continue;
                }

                // --- CREATE / FIND ALBUM ---
                await page.goto('https://siri121.imgbb.com/albums', { waitUntil: 'networkidle2' });
                let albumUrl = await page.evaluate((name) => {
                    const elements = Array.from(document.querySelectorAll('.list-item-desc-title-link, .album-name, .name, a.name'));
                    const target = elements.find(el => el.innerText && el.innerText.trim() === name);
                    return target ? (target.tagName === 'A' ? target.href : target.closest('a')?.href) : null;
                }, ALBUM_NAME);

                if (!albumUrl) {
                    console.log(`  Creating album: ${ALBUM_NAME}`);
                    await page.evaluate(() => {
                        const target = Array.from(document.querySelectorAll('span.btn-text, a, button'))
                            .find(s => s.innerText && s.innerText.includes('Create new album'));
                        if (target) (target.closest('a, button') || target).click();
                    });
                    await new Promise(r => setTimeout(r, 2000));
                    const nameInputSelector = 'input[placeholder="Album name"], input[name="form-album-name"], input[name="album_name"]';
                    await page.waitForSelector(nameInputSelector, { visible: true });
                    await page.type(nameInputSelector, ALBUM_NAME);
                    await page.evaluate(() => document.querySelector('button[data-action="submit"].btn-input.default')?.click());
                    await new Promise(r => setTimeout(r, 5000));
                    await page.goto('https://siri121.imgbb.com/albums', { waitUntil: 'networkidle2' });
                    albumUrl = await page.evaluate((name) => {
                        const elements = Array.from(document.querySelectorAll('.list-item-desc-title-link, .album-name, .name, a.name'));
                        const target = elements.find(el => el.innerText && el.innerText.trim() === name);
                        return target ? (target.tagName === 'A' ? target.href : target.closest('a')?.href) : null;
                    }, ALBUM_NAME);
                }

                if (!albumUrl) {
                    console.error(`Could not find or create album: ${ALBUM_NAME}`);
                    continue;
                }

                // Process Q and S
                for (const type of ['Q', 'S']) {
                    const dir = type === 'Q' ? qDir : sDir;
                    const missing = type === 'Q' ? missingQ : missingS;

                    if (missing.length === 0) continue;

                    console.log(`  Uploading ${missing.length} ${type} images...`);
                    await page.goto(albumUrl, { waitUntil: 'networkidle2' });

                    await page.evaluate(() => {
                        const target = Array.from(document.querySelectorAll('span.btn-text, a, button'))
                            .find(s => s.innerText && (s.innerText.includes('Upload images') || s.innerText.includes('UPLOAD')));
                        if (target) (target.closest('a, button') || target).click();
                    });

                    await page.waitForSelector('input[type="file"]');
                    const inputUpload = await page.$('input[type="file"]');
                    const filePaths = missing.map(f => path.join(dir, f));

                    await inputUpload.uploadFile(...filePaths);

                    // Dispatch change event to force ImgBB to recognize the uploaded files (recently added requirement)
                    await page.evaluate(() => {
                        const el = document.querySelector('input[type="file"]');
                        if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
                    });

                    console.log("  Waiting for UPLOAD button...");
                    await page.waitForSelector('button.btn.btn-big.green[data-action="upload"]', { visible: true });
                    await new Promise(r => setTimeout(r, 1500));
                    await page.evaluate(() => document.querySelector('button.btn.btn-big.green[data-action="upload"]')?.click());

                    console.log("  Uploading batch... Please wait. (This may take several minutes for large batches)");
                    await page.waitForSelector('#uploaded-embed-toggle', { timeout: 0 });

                    console.log("  Upload complete. Extracting links...");
                    await new Promise(r => setTimeout(r, 2000));

                    let linksText = '';
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            await page.select('#uploaded-embed-toggle', 'direct-links');
                            await page.waitForSelector('#uploaded-embed-code-1', { visible: true });
                            linksText = await page.$eval('#uploaded-embed-code-1', el => el.value);
                            break;
                        } catch (e) {
                            console.log(`  [Retry] Link box not visible yet (Attempt ${attempt}/3)...`);
                            await new Promise(r => setTimeout(r, 2000));
                        }
                    }

                    if (!linksText) {
                        throw new Error("Could not find the link box (#uploaded-embed-code-1) after selection.");
                    }

                    const links = linksText.split('\n').map(l => l.trim()).filter(l => l);

                    missing.forEach((file, idx) => {
                        const qNo = file.replace(/[QS]/i, '').replace(/\.(png|jpg)/i, '');
                        if (links[idx]) session.mappings[stream][test][type][qNo] = links[idx];
                    });

                    console.log(`  [+] Successfully mapped ${links.length} links for ${type}.`);

                    fs.writeFileSync(mappingPath, JSON.stringify(session, null, 2));
                }
            }
        }

        console.log(`\n✅ Upload complete. final mapping saved to ${mappingPath}`);

    } catch (err) {
        console.error("Upload Error:", err);
    } finally {
        if (browser) await browser.close();
        process.exit(0);
    }
}

uploadToImgBB();

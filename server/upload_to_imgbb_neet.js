const XLSX = require('xlsx');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(query, (ans) => {
            rl.close();
            resolve(ans.trim());
        });
    });
}

function parseImageInfo(title, alt, src) {
    const candidates = [title, alt, src ? path.basename(src) : ''].filter(Boolean);
    
    for (const cand of candidates) {
        const str = cand.trim();

        // Solution pattern (S) e.g., S1, S 1, S-1, S_1, S01
        const sMatch = str.match(/S\s*[-_]?\s*(\d+)/i);
        if (sMatch) {
            return { type: 'S', qNo: parseInt(sMatch[1], 10).toString() };
        }

        // Question pattern (Q) e.g., Q1, Q 1, Q-1, Q_1, Q01
        const qMatch = str.match(/Q\s*[-_]?\s*(\d+)/i);
        if (qMatch) {
            return { type: 'Q', qNo: parseInt(qMatch[1], 10).toString() };
        }
    }

    // Fallback: pure number e.g. "1.png" or "1"
    for (const cand of candidates) {
        const numMatch = cand.trim().match(/^(\d+)(\.(png|jpg|jpeg|webp))?$/i);
        if (numMatch) {
            return { type: 'Q', qNo: parseInt(numMatch[1], 10).toString() };
        }
    }

    return null;
}

async function extractAlbumImagesFromImgBB(page, albumUrl) {
    const extracted = { Q: {}, S: {}, total: 0 };
    let currentPageUrl = albumUrl;
    let pageNum = 1;
    const visited = new Set();

    while (currentPageUrl && !visited.has(currentPageUrl) && pageNum <= 20) {
        visited.add(currentPageUrl);
        try {
            await page.goto(currentPageUrl, { waitUntil: 'networkidle2' });
        } catch (e) {
            console.warn(`  [Warning] Could not navigate to album page ${currentPageUrl}: ${e.message}`);
            break;
        }

        const pageData = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.list-item, [data-type="image"]'));
            const imageList = items.map(item => {
                const dataTitle = item.getAttribute('data-title');
                const imgEl = item.querySelector('img');
                const linkEl = item.querySelector('a[href*="ibb.co"]');
                return {
                    title: dataTitle || (imgEl ? imgEl.alt : ''),
                    alt: imgEl ? imgEl.alt : '',
                    src: imgEl ? imgEl.src : '',
                    viewer: linkEl ? linkEl.href : ''
                };
            });

            let nextUrl = null;
            const nextBtn = document.querySelector('a.pagination-next, a[rel="next"]');
            if (nextBtn && nextBtn.href) {
                nextUrl = nextBtn.href;
            } else {
                const pageLinks = Array.from(document.querySelectorAll('a[href*="page="]'));
                const curMatch = window.location.href.match(/page=(\d+)/);
                const curPage = curMatch ? parseInt(curMatch[1], 10) : 1;
                const targetLink = pageLinks.find(a => {
                    const m = a.href.match(/page=(\d+)/);
                    return m && parseInt(m[1], 10) === curPage + 1;
                });
                if (targetLink) nextUrl = targetLink.href;
            }

            return { imageList, nextUrl };
        });

        if (!pageData.imageList || pageData.imageList.length === 0) {
            break;
        }

        for (const img of pageData.imageList) {
            if (!img.src) continue;
            const parsed = parseImageInfo(img.title, img.alt, img.src);
            if (parsed) {
                if (parsed.type === 'Q') {
                    if (!extracted.Q[parsed.qNo]) {
                        extracted.Q[parsed.qNo] = img.src;
                        extracted.total++;
                    }
                } else if (parsed.type === 'S') {
                    if (!extracted.S[parsed.qNo]) {
                        extracted.S[parsed.qNo] = img.src;
                        extracted.total++;
                    }
                }
            }
        }

        if (pageData.nextUrl && pageData.nextUrl !== currentPageUrl) {
            currentPageUrl = pageData.nextUrl;
            pageNum++;
        } else {
            break;
        }
    }

    return extracted;
}

function getOtherTestsUrls(session, currentStream, currentTest) {
    const used = new Map(); // url -> "stream / test (type qNo)"
    for (const stream in session.mappings || {}) {
        for (const test in session.mappings[stream] || {}) {
            if (currentStream && currentTest && stream === currentStream && test === currentTest) continue;
            for (const type of ['Q', 'S']) {
                const qMap = session.mappings[stream][test][type] || {};
                for (const qNo in qMap) {
                    const u = qMap[qNo];
                    if (u && typeof u === 'string' && u.startsWith('http')) {
                        used.set(u, `${stream} / ${test} (${type}${qNo})`);
                    }
                }
            }
        }
    }
    return used;
}

function sanitizeMappingsUniqueness(session) {
    const seen = new Map();
    let removedCount = 0;
    for (const stream in session.mappings || {}) {
        for (const test in session.mappings[stream] || {}) {
            for (const type of ['Q', 'S']) {
                const qMap = session.mappings[stream][test][type] || {};
                for (const qNo in qMap) {
                    const u = qMap[qNo];
                    if (!u || typeof u !== 'string' || !u.startsWith('http')) continue;
                    if (seen.has(u)) {
                        console.warn(`[INTEGRITY] Found duplicate URL ${u} in ${stream}/${test} (${type}${qNo}), originally assigned to ${seen.get(u)}. Purging duplicate.`);
                        delete qMap[qNo];
                        removedCount++;
                    } else {
                        seen.set(u, `${stream}/${test} (${type}${qNo})`);
                    }
                }
            }
        }
    }
    return removedCount;
}

async function uploadToImgBB() {
    const ERP_BASE = path.resolve(__dirname, '..', 'ERP Report');
    const picsBaseDir = path.join(ERP_BASE, 'PICS');

    if (!fs.existsSync(picsBaseDir)) {
        console.error("❌ PICS directory not found: " + picsBaseDir);
        process.exit(1);
    }

    const args = process.argv.slice(2);
    const targetTest = args[0] ? args[0].trim() : null;
    const targetType = args[1] ? args[1].trim() : null;

    if (targetTest) {
        console.log(`[FILTER] Searching for Test: ${targetTest} across all streams.`);
    }

    const streams = fs.readdirSync(picsBaseDir).filter(f => {
        return fs.statSync(path.join(picsBaseDir, f)).isDirectory();
    });

    const norm = (s) => String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Validate if target test folder exists locally in PICS
    if (targetTest) {
        let foundTestCount = 0;
        for (const stream of streams) {
            const streamPath = path.join(picsBaseDir, stream);
            const tests = fs.readdirSync(streamPath).filter(f => {
                return fs.statSync(path.join(streamPath, f)).isDirectory() && norm(f) === norm(targetTest);
            });
            foundTestCount += tests.length;
        }

        if (foundTestCount === 0) {
            console.error(`\n❌ [ERROR] Test folder "${targetTest}" was NOT found in any stream under "${picsBaseDir}".`);
            console.error(`Available streams and tests in PICS:`);
            for (const stream of streams) {
                const streamPath = path.join(picsBaseDir, stream);
                const tests = fs.readdirSync(streamPath).filter(f => fs.statSync(path.join(streamPath, f)).isDirectory());
                console.error(`  - ${stream}: ${tests.length > 0 ? tests.join(', ') : '(no folders)'}`);
            }
            console.error(`\nPlease create the folder "ERP Report/PICS/<STREAM>/${targetTest}" with question images in a "Q" subfolder and try again.`);
            process.exit(1);
        }
    }

    const mappingPath = path.join(__dirname, 'url_mapping_neet.json');
    let session = {
        mappings: {}
    };

    if (fs.existsSync(mappingPath)) {
        try {
            session = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
            const cleaned = sanitizeMappingsUniqueness(session);
            if (cleaned > 0) {
                fs.writeFileSync(mappingPath, JSON.stringify(session, null, 2), 'utf8');
                console.log(`[CLEANUP] Purged ${cleaned} non-unique URL mappings from url_mapping_neet.json.`);
            }
        } catch (e) {
            console.warn("Could not parse mapping cache, starting fresh.");
        }
    }

    // Check if there are existing local mappings for target test
    let hasExistingMappings = false;
    if (targetTest) {
        for (const stream in session.mappings) {
            for (const test in session.mappings[stream]) {
                if (norm(test) === norm(targetTest)) {
                    const testMap = session.mappings[stream][test];
                    const qCount = Object.keys(testMap.Q || {}).length;
                    const sCount = Object.keys(testMap.S || {}).length;
                    if (qCount > 0 || sCount > 0) {
                        hasExistingMappings = true;
                        break;
                    }
                }
            }
        }
    }

    if (hasExistingMappings) {
        const answer = (await askQuestion(`\n[WARNING] Existing URL mappings found locally for Test "${targetTest}". \nDo you want to delete these mappings and re-upload new images? (y/N) [Default: N]: `)).toLowerCase();

        if (answer === 'y' || answer === 'yes') {
            console.log(`[RESET] Deleting existing local mappings for Test "${targetTest}"...`);
            for (const stream in session.mappings) {
                for (const test in session.mappings[stream]) {
                    if (norm(test) === norm(targetTest)) {
                        delete session.mappings[stream][test];
                    }
                }
            }
            fs.writeFileSync(mappingPath, JSON.stringify(session, null, 2), 'utf8');
            console.log(`[RESET] Mapping cache updated. Will re-upload all images for "${targetTest}".`);
        } else {
            console.log(`[CONTINUE] Keeping existing mappings. Missing images will be checked/uploaded.`);
        }
    }

    let browser;
    try {
        const launchOptions = {
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized']
        };

        const chromeCandidates = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
        ];
        for (const candidate of chromeCandidates) {
            if (fs.existsSync(candidate)) {
                launchOptions.executablePath = candidate;
                break;
            }
        }

        browser = await puppeteer.launch(launchOptions);

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(0);
        await page.setDefaultTimeout(0);
        await page.goto('https://imgbb.com/login', { waitUntil: 'networkidle2' });

        await page.type('#login-subject', 'siri121');
        await page.type('#login-password', '321@Siri#');
        await page.evaluate(() => document.querySelector('button[type="submit"]')?.click());
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log("Login successful.");

        let processedTestsCount = 0;

        for (const stream of streams) {
            const streamPath = path.join(picsBaseDir, stream);
            const tests = fs.readdirSync(streamPath).filter(f => {
                const isDir = fs.statSync(path.join(streamPath, f)).isDirectory();
                if (targetTest) return isDir && norm(f) === norm(targetTest);
                return isDir;
            });

            for (const test of tests) {
                processedTestsCount++;
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

                // Clean any URLs in this test's mappings that were assigned to other tests
                const otherUrls = getOtherTestsUrls(session, stream, test);
                for (const type of ['Q', 'S']) {
                    const qMap = session.mappings[stream][test][type] || {};
                    for (const qNo in qMap) {
                        if (otherUrls.has(qMap[qNo])) {
                            console.warn(`[PURGE] Removing duplicate URL for ${stream}/${test} ${type}${qNo} (belongs to ${otherUrls.get(qMap[qNo])})`);
                            delete qMap[qNo];
                        }
                    }
                }

                const qFiles = fs.readdirSync(qDir).filter(f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg'));
                const sFiles = fs.existsSync(sDir) ? fs.readdirSync(sDir).filter(f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg')) : [];

                // --- SEARCH / CREATE ALBUM ---
                // Strict exact match for album name
                const findAlbumOnPage = async (name) => {
                    return await page.evaluate((targetName) => {
                        const clean = (s) => String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
                        const targetClean = clean(targetName);
                        const elements = Array.from(document.querySelectorAll('.list-item-desc-title-link, .album-name, .name, a.name'));
                        const target = elements.find(el => {
                            const txt = (el.innerText || el.getAttribute('title') || '').trim();
                            return clean(txt) === targetClean;
                        });
                        if (!target) return null;
                        return target.tagName === 'A' ? target.href : target.closest('a')?.href;
                    }, name);
                };

                await page.goto('https://siri121.imgbb.com/albums', { waitUntil: 'networkidle2' });
                let albumUrl = await findAlbumOnPage(ALBUM_NAME);

                if (!albumUrl) {
                    for (let p = 2; p <= 5; p++) {
                        try {
                            await page.goto(`https://siri121.imgbb.com/albums?page=${p}`, { waitUntil: 'networkidle2' });
                            albumUrl = await findAlbumOnPage(ALBUM_NAME);
                            if (albumUrl) break;
                        } catch (e) {
                            break;
                        }
                    }
                }

                let albumExistedOnImgBB = false;
                if (albumUrl) {
                    albumExistedOnImgBB = true;
                } else {
                    console.log(`  Creating album: ${ALBUM_NAME}`);
                    await page.goto('https://siri121.imgbb.com/albums', { waitUntil: 'networkidle2' });
                    await page.evaluate(() => {
                        const target = Array.from(document.querySelectorAll('span.btn-text, span, a, button'))
                            .find(s => s.innerText && s.innerText.toLowerCase().includes('create new album'));
                        if (target) (target.closest('a, button') || target).click();
                    });
                    await new Promise(r => setTimeout(r, 1500));
                    const nameInputSelector = 'input[placeholder="Album name"], input[name="form-album-name"], input[name="album_name"], input[name="name"]';
                    await page.waitForSelector(nameInputSelector, { visible: true, timeout: 5000 }).catch(() => {});

                    const inputEl = await page.$(nameInputSelector);
                    if (inputEl) {
                        await page.type(nameInputSelector, ALBUM_NAME);
                        await page.keyboard.press('Enter');
                        
                        await page.evaluate(() => {
                            const btn = document.querySelector('button[type="submit"], button[data-action="submit"], .modal-box button[type="submit"], button.btn-input, button.default');
                            if (btn) btn.click();
                        });
                        
                        await new Promise(r => setTimeout(r, 4000));

                        const currentUrl = page.url();
                        if (currentUrl.includes('/album/')) {
                            albumUrl = currentUrl;
                        } else {
                            await page.goto('https://siri121.imgbb.com/albums', { waitUntil: 'networkidle2' });
                            albumUrl = await findAlbumOnPage(ALBUM_NAME);
                        }
                    }
                }

                if (!albumUrl) {
                    console.error(`❌ Could not find or create album: ${ALBUM_NAME}`);
                    continue;
                }

                // If album already existed on ImgBB, check its contents!
                if (albumExistedOnImgBB) {
                    console.log(`  Album "${ALBUM_NAME}" already exists on ImgBB. Checking images in album...`);
                    const extractedData = await extractAlbumImagesFromImgBB(page, albumUrl);

                    // Validate that extracted URLs are NOT used by other tests
                    const currentOtherUrls = getOtherTestsUrls(session, stream, test);
                    let nonUniqueFound = 0;
                    for (const qNo in extractedData.Q) {
                        const u = extractedData.Q[qNo];
                        if (currentOtherUrls.has(u)) {
                            console.warn(`  ⚠️ [NON-UNIQUE URL] Q${qNo} in album "${ALBUM_NAME}" is already used by ${currentOtherUrls.get(u)}. Discarding.`);
                            delete extractedData.Q[qNo];
                            extractedData.total--;
                            nonUniqueFound++;
                        }
                    }
                    for (const qNo in extractedData.S) {
                        const u = extractedData.S[qNo];
                        if (currentOtherUrls.has(u)) {
                            console.warn(`  ⚠️ [NON-UNIQUE URL] S${qNo} in album "${ALBUM_NAME}" is already used by ${currentOtherUrls.get(u)}. Discarding.`);
                            delete extractedData.S[qNo];
                            extractedData.total--;
                            nonUniqueFound++;
                        }
                    }

                    if (nonUniqueFound > 0) {
                        console.warn(`  ⚠️ Discarded ${nonUniqueFound} shared/duplicate URLs to ensure unique images for ${stream}/${test}.`);
                    }

                    if (extractedData.total > 0) {
                        console.log(`\n======================================================================`);
                        console.log(`[ALBUM FOUND] Album "${ALBUM_NAME}" has ${extractedData.total} verified unique images on ImgBB!`);
                        console.log(`======================================================================`);
                        console.log(`Options:`);
                        console.log(`  1) Take/use existing album images only (Extract URLs & skip re-uploading) [DEFAULT]`);
                        console.log(`  2) Upload missing/new images to this album (Keep existing + upload missing)`);
                        console.log(`  3) Delete existing mappings & re-upload all images to this album`);
                        console.log(`----------------------------------------------------------------------`);

                        const choice = await askQuestion(`Select option for "${ALBUM_NAME}" (1/2/3) [Default: 1]: `);
                        const selectedOption = (choice === '2') ? '2' : ((choice === '3') ? '3' : '1');

                        if (selectedOption === '1') {
                            console.log(`\n[TAKE ALBUM] Using existing ${extractedData.total} unique images from ImgBB album for "${ALBUM_NAME}"...`);
                            Object.assign(session.mappings[stream][test].Q, extractedData.Q);
                            Object.assign(session.mappings[stream][test].S, extractedData.S);
                            fs.writeFileSync(mappingPath, JSON.stringify(session, null, 2), 'utf8');
                            console.log(`✅ [INSTANT] Successfully mapped ${extractedData.total} unique images from album "${ALBUM_NAME}". Skipping upload.`);
                            continue; // Skip uploading for this album!
                        } else if (selectedOption === '2') {
                            console.log(`\n[MERGE ALBUM] Merging ${extractedData.total} unique images from ImgBB for "${ALBUM_NAME}"...`);
                            Object.assign(session.mappings[stream][test].Q, extractedData.Q);
                            Object.assign(session.mappings[stream][test].S, extractedData.S);
                            fs.writeFileSync(mappingPath, JSON.stringify(session, null, 2), 'utf8');
                        } else if (selectedOption === '3') {
                            console.log(`\n[RESET ALBUM] Re-uploading all images for "${ALBUM_NAME}"...`);
                            session.mappings[stream][test] = { Q: {}, S: {} };
                            fs.writeFileSync(mappingPath, JSON.stringify(session, null, 2), 'utf8');
                        }
                    } else {
                        console.log(`  [INFO] Album "${ALBUM_NAME}" has no existing unique images to reuse. Proceeding to upload.`);
                    }
                }

                // Check missing Q and S images after album check / merge
                const missingQ = qFiles.filter(f => {
                    const qNo = f.replace(/[QS]/i, '').replace(/\.(png|jpg)/i, '');
                    return !session.mappings[stream][test].Q[qNo];
                });

                const missingS = sFiles.filter(f => {
                    const qNo = f.replace(/[QS]/i, '').replace(/\.(png|jpg)/i, '');
                    return !session.mappings[stream][test].S[qNo];
                });

                if (missingQ.length === 0 && missingS.length === 0) {
                    console.log(`[INSTANT] All images for ${stream}/${test} are already mapped with unique URLs.`);
                    continue;
                }

                // Process Q and S upload if missing files remain
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

                    const currentOtherUrls = getOtherTestsUrls(session, stream, test);
                    missing.forEach((file, idx) => {
                        const qNo = file.replace(/[QS]/i, '').replace(/\.(png|jpg)/i, '');
                        const newUrl = links[idx];
                        if (newUrl) {
                            if (currentOtherUrls.has(newUrl)) {
                                console.warn(`  ⚠️ [COLLISION] Uploaded link ${newUrl} is already used by ${currentOtherUrls.get(newUrl)}! Rejecting duplicate.`);
                            } else {
                                session.mappings[stream][test][type][qNo] = newUrl;
                            }
                        }
                    });

                    console.log(`  [+] Successfully mapped ${links.length} unique links for ${type}.`);

                    fs.writeFileSync(mappingPath, JSON.stringify(session, null, 2));
                }
            }
        }

        if (processedTestsCount === 0) {
            console.error(`\n❌ No tests were processed. Check your test name and folder structure.`);
            process.exit(1);
        }

        console.log(`\n✅ Upload complete. Final mapping saved to ${mappingPath}`);

    } catch (err) {
        console.error("❌ Upload Error:", err);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

uploadToImgBB();

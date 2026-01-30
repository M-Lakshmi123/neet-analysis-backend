
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function test() {
    console.log("Starting email test...");
    console.log("EMAIL_USER:", process.env.EMAIL_USER);
    // Don't log full password for safety, but check length
    console.log("EMAIL_PASS length:", process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);

    const hosts = ['smtp-mail.outlook.com', 'smtp.office365.com'];

    for (const host of hosts) {
        console.log(`\nTesting with host: ${host}`);
        const transporter = nodemailer.createTransport({
            host: host,
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                ciphers: 'SSLv3',
                rejectUnauthorized: false
            }
        });

        try {
            console.log(`Verifying ${host}...`);
            await transporter.verify();
            console.log(`✅ ${host} is READY!`);

            console.log(`Attempting to send test email via ${host}...`);
            const info = await transporter.sendMail({
                from: `"Sri Chaitanya Test" <${process.env.EMAIL_USER}>`,
                to: process.env.EMAIL_USER,
                subject: `Test from ${host}`,
                text: 'Email works!'
            });
            console.log(`✅ Email sent via ${host}! MessageId: ${info.messageId}`);
            return; // Stop if one works
        } catch (err) {
            console.error(`❌ Failed with ${host}:`, err.message);
        }
    }
}

test();

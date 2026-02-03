const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testEmail() {
    console.log('--- Email Configuration Test ---');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);
    console.log('EMAIL_PASS first char:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS[0] : 'N/A');
    console.log('EMAIL_PASS last char:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS[process.env.EMAIL_PASS.length - 1] : 'N/A');

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        console.log('Verifying transporter...');
        await transporter.verify();
        console.log('Server is ready to take our messages');

        const info = await transporter.sendMail({
            from: `"Sri Chaitanya Test" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Send to self
            subject: 'Test Email from NEET Analysis Dashboard',
            text: 'This is a test email to verify your configuration.',
            html: '<b>This is a test email to verify your configuration.</b>'
        });

        console.log('Message sent: %s', info.messageId);
    } catch (error) {
        console.error('Error occurred:', error);
    }
}

testEmail();

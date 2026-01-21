require('dotenv').config();
const nodeMailer = require('nodemailer');


const sendEmail = async ({ to, subject, text }) => {
    const transporter = nodeMailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    await transporter.sendMail({
        from:   `Bosplan.ai ${process.env.EMAIL_FROM}`,
        to,
        subject,
        text
    });
}; 

module.exports = sendEmail;
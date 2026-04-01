require('dotenv').config();
const nodeMailer = require('nodemailer');

const sendEmail = async ({ to, subject, text }) => {
    const transporter = nodeMailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        // secure: process.env.SECURE,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    });
    // await transporter.sendMail({
    //     from:   `Bosplan.ai ${process.env.EMAIL_FROM}`,
    //     to,
    //     subject,
    //     text
    // });

    const mailOptions = {
        from: `Bosplan.ai ${process.env.EMAIL_FROM}`,
        to,
        subject,
        text,
        // html: '<b>Hello!</b> this is an HTML body.' // Optional
    };

    console.log('mailoptions----',mailOptions);
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('Error:', error);
        }
        console.log('Email sent: ' + info.response);
    });
    console.log('transporter----',transporter)
}; 

module.exports = sendEmail;
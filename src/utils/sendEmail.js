const nodeMailer = require('nodemailer');

const sendEmail = async ({ to, subject, text }) => {
    console.log("sendEmail function called");

    const transporter = nodeMailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    const mailOptions = {
        from: `Bosplan.ai ${process.env.EMAIL_FROM}`,
        to,
        subject,
        text,
    };

    console.log('mailoptions----', mailOptions);

    try {
        await transporter.verify();
        console.log("SMTP ready");

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:", info.response);
    } catch (error) {
        console.log("Error:", error);
    }
};
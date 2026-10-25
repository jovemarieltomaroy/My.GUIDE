const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },

  pool: true,
  maxConnections: 3,
  maxMessages: 100,

  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

module.exports = transporter;

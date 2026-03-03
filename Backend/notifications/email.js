import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const sendBookingConfirmationEmail = async (to, bookingId, eventTitle) => {
    await transporter.sendMail({
        from: `"Ticketly" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Booking Confirmation for ${eventTitle}`,
        html: `
        <h2> Your booking is confirmed!</h2>
        <p>Thank you for booking <strong>${eventTitle}</strong>.</p>
        <p>Booking ID: <strong>${bookingId}</strong></p>
        <p>We look forward to seeing you at the event!</p>
        <p>Please keep this email for your records.</p>
        <p>Best regards,<br/>Ticketly Team</p>
        `
    })
}

export const sendBookingCancellationEmail = async (to, bookingId, eventTitle) => {
    await transporter.sendMail({
        from: `"Ticketly" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Booking Cancelled for ${eventTitle}`,
        html: `
        <h2> Your booking has been cancelled!</h2>
        <p>Booking ID: <strong>${bookingId}</strong></p>
        <p>Your refund will be processed within 5-7 business days.</p>
        <p>We're sorry to see you go. If you have any questions, feel free to contact us.</p>
        <p>Best regards,<br/>Ticketly Team</p>
        `
    });
};

export const sendEventCancelledEmail = async (to, eventTitle) => {
    await transporter.sendMail({
        from: `"Ticketly" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Event Cancelled: ${eventTitle}`,
        html: `
        <h2> The event "${eventTitle}" has been cancelled!</h2>
        <p>We're sorry to inform you that the event has been cancelled.</p>
        <p>Your refund will be processed within 5-7 business days if you had a confirmed booking.</p>
        <p>If you have any questions, please contact our support team.</p>
        <p>Please keep this email for your records.</p>
        <p>Best regards,<br/>Ticketly Team</p>
        `
    });
};
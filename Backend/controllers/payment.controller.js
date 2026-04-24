import {createOrder, verifyPayment} from "../services/payment.service.js";
import prisma from "../config/prisma.js";
import e from "cors";

export const initiatePayment = async (req, res) => {
    const { amount, currency, receipt } = req.body;
    try {
        const order = await createOrder(amount, currency, receipt);
        res.json(order);
    }
    catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: error.message });
    }
};

export const confirmPayment = async (req, res) => {
    const { paymentId, orderId, signature, bookingId } = req.body;
    try {
        const isValid = await verifyPayment(paymentId, orderId, signature);
        if (!isValid) {
            return res.status(400).json({ error: "Invalid payment signature" });
        }   
        await prisma.booking.update({
            where: { id: bookingId },
            data: { status: 'confirmed' }
        });
        res.json({ message: "Payment verified and booking confirmed" });
    }   
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default {initiatePayment, confirmPayment};
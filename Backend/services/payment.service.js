import razorpay from "../config/razorpay.js";

export const createOrder = async (amount, currency, receipt) => {
    const options = {
        amount: amount * 100, 
        currency,
        receipt
    };

    try {   
        const order = await razorpay.orders.create(options);
        return order;
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        throw { message: "Failed to create order", status: 500 };
    }
};

export const verifyPayment = async (paymentId, orderId, signature) => {
    const crypto = await import("crypto");
    const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(orderId + "|" + paymentId)
        .digest('hex'); 

    if (generatedSignature === signature) {
        return true;
    }
    return false;
};



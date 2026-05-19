import ai from '../config/gemini.js';
import prisma from '../config/prisma.js';
import client from '../config/redis.js';
import { buildRecommendationPrompt } from '../utils/promptBuilder.js';
import { generateDesc } from '../utils/generateDesc.js';

export const getRecommendations = async (userId) => {
    const cacheKey = `recommendations:${userId}`;
    const cache = await client.get(cacheKey);
    if (cache) return JSON.parse(cache);

    const [bookings, upcomingEvents] = await Promise.all([   
        prisma.booking.findMany({
            where: { userId, status: 'confirmed' },
            include: { event: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
        }),
        prisma.event.findMany({
            where: { status: 'published', eventDate: { gt: new Date() } },
            take: 20,
        }),
    ]);

    if (bookings.length === 0) return upcomingEvents;

    const prompt = buildRecommendationPrompt(bookings, upcomingEvents);

    try {
        const res = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            systemInstruction: `
                You are an event recommendation engine.
                Analyze the user's booking history and recommend the most relevant events.
                Only recommend events from the provided list using their exact id.`,  
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: "object",
                    properties: {
                        recommendations: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    eventId: { type: "string" },
                                    reason: { type: "string" },
                                },
                                required: ["eventId", "reason"],
                            },
                        },
                    },
                    required: ["recommendations"],
                },
            },
        });

        const parsed = JSON.parse(res.text);
        const recommendedIds = parsed.recommendations.map(r => r.eventId);

        const events = await prisma.event.findMany({
            where: { id: { in: recommendedIds } },
        });

        const result = events.map(event => ({
            ...event,
            reason: parsed.recommendations.find(r => r.eventId === event.id)?.reason,
        }));


        await client.set(cacheKey, JSON.stringify(result), 'EX', 1800);
        return result;
    } catch (err) {
        console.error("AI recommendation failed:", err.message);
        return upcomingEvents;
    }
};

export const generateDescription = async (event) => {
    const prompt = generateDesc(event);

    try {
        const res = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            systemInstruction: `You are a professional event copywriter. 
                Write descriptions that are exciting, clear, and concise. 
                Never use placeholder text. Always write complete sentences.`,
            contents: [{ role: "user", parts: [{ text: prompt }] }], 
        });

        return { description: res.text.trim() };
    } catch (error) {
        console.error("Description generation failed:", error.message);
        return { description: null, error: "AI response cannot be generated. Please try again later." };  
    }
};
import {
    getRecommendations as getRecommendationsService,
    generateDescription as generateDescriptionService
}
from "../services/ai.service.js";

const getRecommendations = async (req, res) => { 
    const userId = req.user.userId;
    try {
        const recommendations = await getRecommendationsService(userId);
        res.json({ recommendations });
    } catch (error) {
        console.error("Error in getRecommendations controller:", error);
        res.status(500).json({ error: "An error occurred while fetching recommendations." });
    }
};

const generateDescription = async (req, res) => {
    const { title, venue, category, artist, date } = req.body;
    try {
        const description = await generateDescriptionService({ title, venue, category, artist, date });
        res.json({ description });
    } catch (error) {
        console.error("Error in generateDescription controller:", error);
        res.status(500).json({ error: "An error occurred while generating description." });
    }
};

export {
    getRecommendations,
    generateDescription
};
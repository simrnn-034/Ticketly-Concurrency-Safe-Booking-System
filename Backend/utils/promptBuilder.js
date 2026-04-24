export const buildRecommendationPrompt = (bookings, upcomingEvents) => {
    const history = bookings
        .map(b => `- ${b.event.title} (${b.event.category}) at ${b.event.venue}`)
        .join("\n");

    const upcoming = upcomingEvents
        .map(e => `- id:${e.id} | ${e.title} | ${e.category} | ${e.venue} | ${e.eventDate}`)
        .join("\n");

    return `
User's past bookings:
${history}

Upcoming events to choose from:
${upcoming}

Recommend the top 5 most relevant events for this user.
Base your recommendations on patterns in their booking history.
Only recommend events from the list above using their exact id.
`.trim();
};
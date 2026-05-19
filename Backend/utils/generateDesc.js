export const generateDesc = async (event) => {
    const prompt = `Create a compelling description for an event with the following details:

Event Title: ${event.title}
Venue: ${event.venue}
Date: ${new Date(event.eventDate).toLocaleDateString()}
Category: ${event.category}
Artist: ${event.artist}
Additional Info: ${event.additionalInfo || 'N/A'}

Write an engaging 3-4 sentence description that:
- Highlights the unique aspects of the event
- Appeals to potential attendees
- Avoids generic phrases and focuses on what makes this event special
- Sounds professional and energetic`.trim();
};
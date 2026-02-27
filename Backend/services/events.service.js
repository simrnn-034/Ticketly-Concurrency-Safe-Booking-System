import prisma from '../config/prisma.js';

const InsertEvent = async (req,res)=>{
    const organizerId = req.user.id;
    const {title, description, date_time, venue, categories} = req.body;
    let totalSeats = 0;
    for(let category of categories){
        totalSeats += category.rows.length * category.seats_per_row;
    };
    try{
        const event = await prisma.$transaction(async (trx)=>{
            const event = await trx.event.create({
                data: {
                    title
                    , description
                    , date_time: new Date(date_time)
                , venue
                , total_seats: totalSeats
                , organizer_id: organizerId
                ,status: 'draft'
            }
        });
        const eventId = event.id;
        for(let category of categories){
            const categoryCreated = await trx.seatCategory.create({
                data: {
                    categoryName : category.name,
                    price : category.price,
                    eventId : eventId,
                    totalSeats : category.rows.length * category.seats_per_row
                }
            });
            const categoryId = categoryCreated.id;
            const seatValues = [];
            for(let row of category.rows){
                for(let seatNum = 1; seatNum <= category.seats_per_row;seatNum++){
                    seatValues.push({
                        eventId, categoryId, rowLabel: row, seatNumber: seatNum
                    });
                }
            }
            await trx.seat.createMany({data: seatValues}); 
        }
        return event;
    });
    return res.status(201).json({message: 'Event created successfully'});
}
catch(err){
    return res.status(500).json({message: 'Error creating event', error: err.message});
}
};

export default {InsertEvent};
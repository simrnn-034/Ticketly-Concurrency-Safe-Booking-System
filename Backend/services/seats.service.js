import client from "../config/redis.js";

const HoldSeat = async (req,res)=>{
  const userId = req.user.id;
  const eventId = req.params.eventId;
  const {seatIds} = req.body;
  const heldSoFar = [];
  for(let seatId of seatIds){
    const holdKey = `hold:${eventId}:${seatId}`;
    const existing = await client.get(holdKey);
    if(existing){
      for(let heldId of heldSoFar){
        await client.del(`hold:${eventId}:${heldId}`);
      }
        return res.status(409).json({error : "Seat already held."});
    }
    const held = await client.set(holdKey,userId,'EX',600,'NX');
    if(!held){
      for(let heldId of heldSoFar){
        await client.del(`hold:${eventId}:${heldId}`);
      }
      return res.status(409).json({error: "Seat Taken"})
    }
    heldSoFar.push(seatId);
  }
  return res.status(200).json({success : true});
}

const ReleaseSeat = async (req,res) =>{
  const userId = req.user.id;
  const eventId = req.params.eventId;
  const {seatIds} = req.body;
  for(let seatId of seatIds){
    const holdKey = `hold:${eventId}:${seatId}`;
    const existing = await client.get(holdKey);

    if(existing === userId){
      await client.del(holdKey);
    }
  }
  return res.status(200).json({success : true});


}
export default HoldSeat;

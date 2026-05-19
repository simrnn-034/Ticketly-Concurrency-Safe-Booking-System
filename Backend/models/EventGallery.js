import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },

  publicId: {
    type: String,
    required: true
  }
},
{
  _id: false
});

const eventGallerySchema = new mongoose.Schema({

  eventId: {
    type: String,
    required: true,
    unique: true
  },

  images: [imageSchema]

},
{
  timestamps: true
});

const EventGallery = mongoose.model(
  "EventGallery",
  eventGallerySchema
);

export default EventGallery;
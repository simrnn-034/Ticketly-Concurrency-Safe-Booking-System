import mongoose from "mongoose";
import { url } from "node:inspector";

const userProfileSchema = new mongoose.Schema({
    userId:{
        type: String,
        required: true,
        unique: true
    },

    birthday: Date,
    profileImage: {
        url: String,
        publicId: String
    }
},
{
    timestamps: true
});

export default mongoose.model("UserProfile", userProfileSchema);
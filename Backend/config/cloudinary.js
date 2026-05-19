import {v2 as cloudinary} from 'cloudinary';
import multer from 'multer';
import {CloudinaryStorage} from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const userStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => ({
            folder: `ticketly/profile_pictures/${req.user.id}`,
            allowed_formats: ['jpg', 'png', 'jpeg'],
            public_id: `${Date.now()}-${file.originalname.split('.')[0]}`
    })
});

const eventStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => ({
            folder: `ticketly/event_images/${req.params.eventId}`,
            allowed_formats: ['jpg', 'png', 'jpeg'],
            public_id: `${Date.now()}-${file.originalname.split('.')[0]}`
    })
}); 

const userUpload = multer({ 
    storage: userStorage,
    limits: { fileSize: 5 * 1024 * 1024 } 
});
const eventUpload = multer({ 
    storage: eventStorage ,
    limits: { fileSize: 5 * 1024 * 1024 }
});

export {cloudinary, userUpload, eventUpload};
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import client from '../config/redis.js';
import UserProfile from '../models/UserProfile.js';

export const registerUser = async ({ name, email, password, phone, role }) => {
    if (!email || !password || !name) {
        throw { status: 400, message: 'name, email and password are required' };
    }

    const existing = await prisma.user.findUnique({
        where: { email }
    });

    if (existing) {
        throw { status: 409, message: 'Email already registered' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                phone,
                role: role || 'user'
            }
        });

        await UserProfile.create({
            userId: user.id
        });

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '1d'
            }
        );

        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        };
    }
    catch (err) {
        console.error('Error creating user:', err);
        throw { status: 500, message: 'Internal server error' };
    }
};

export const loginUser = async ({ email, password }) => {
    if (!email || !password) {
        throw { status: 400, message: 'email and password are required' };
    }

    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        throw { status: 401, message: 'Invalid credentials' };
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
        throw { status: 401, message: 'Invalid credentials' };
    }

    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        }
    );

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    };
};

export const logoutUser = async (token) => {
    if (token) {
        const decoded = jwt.decode(token);

        const ttl = decoded.exp - Math.floor(Date.now() / 1000);

        if (ttl > 0) {
            await client.set(`blacklist:${token}`, '1', 'EX', ttl);
        }
    }

    return {
        success: true,
        message: 'Logged out successfully'
    };
};

export const getCurrentUser = async (token) => {
    if (!token) {
        throw { status: 401, message: 'Unauthorized' };
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
        where: {
            id: decoded.id
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true
        }
    });

    if (!user) {
        throw { status: 401, message: 'User not found' };
    }

    return user;
};

export const updateProfileService = async ({
    userId,
    name,
    phone,
    birthday,
    image
}) => {

    const user = await prisma.user.findUnique({
        where: {
            id: userId
        }
    });

    if (!user) {
        throw {
            status: 404,
            message: 'User not found'
        };
    }

    // Prisma Update Data
    const prismaUpdateData = {};

    if(name !== undefined){
        prismaUpdateData.name = name;
    }

    if(phone !== undefined){
        prismaUpdateData.phone = phone;
    }

    // PostgreSQL Update
    const updatedUser =
    await prisma.user.update({

        where: {
            id: userId
        },

        data: prismaUpdateData
    });

    const mongoUpdateData = {};

    if(birthday){
        mongoUpdateData.birthday = birthday;
    }

    if (image && image.path) {

        mongoUpdateData.profileImage = {

            url: image.path,

            publicId: image.filename
        };
    }

    const updatedProfile =
    await UserProfile.findOneAndUpdate(

        {
            userId
        },

        mongoUpdateData,

        {
            new: true,
            upsert: true
        }
    );

    return {

        user: updatedUser,

        profile: updatedProfile
    };
};
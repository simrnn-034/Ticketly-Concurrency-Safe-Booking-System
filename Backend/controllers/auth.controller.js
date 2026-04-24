import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import client from '../config/redis.js';

export const register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: role || 'user'
      }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    res.cookie("token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 24 * 60 * 60 * 1000 
});

return res.status(201).json({
  success: true,
  user: { id: user.id, name: user.name, email: user.email, role: user.role }
});

  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

   res.cookie("token", token, {
  httpOnly: true,               
  secure: process.env.NODE_ENV === "production", 
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",         
  maxAge: 7 * 24 * 60 * 60 * 1000 
});

return res.status(200).json({
  success: true,
  user: { id: user.id, name: user.name, email: user.email, role: user.role }
});

  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.cookies.token;

    if (token) {
      const decoded = jwt.decode(token);
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);

      if (ttl > 0) {
        await client.set(`blacklist:${token}`, '1', 'EX', ttl);
      }
    }

    res.clearCookie("token");

    return res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });

  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
};

export const me = async (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    return res.status(200).json({ user });

  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
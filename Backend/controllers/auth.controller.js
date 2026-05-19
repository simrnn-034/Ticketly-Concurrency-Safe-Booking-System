import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  updateProfileService
} from '../services/auth.service.js';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
};

export const register = async (req, res) => {
  try {
    const result = await registerUser(req.body);

    res.cookie('token', result.token, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.status(201).json({
      success: true,
      user: result.user
    });

  } catch (err) {
    return res.status(err.status || 500).json({
      error: err.message
    });
  }
};

export const login = async (req, res) => {
  try {
    const result = await loginUser(req.body);

    res.cookie('token', result.token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      user: result.user
    });

  } catch (err) {
    return res.status(err.status || 500).json({
      error: err.message
    });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.cookies.token;

    const result = await logoutUser(token);

    res.clearCookie('token');

    return res.status(200).json(result);

  } catch (err) {
    return res.status(err.status || 500).json({
      error: err.message
    });
  }
};

export const me = async (req, res) => {
  try {
    const token = req.cookies.token;

    const user = await getCurrentUser(token);

    return res.status(200).json({
      user
    });

  } catch (err) {
    return res.status(err.status || 401).json({
      error: err.message || 'Invalid or expired token'
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const token = req.cookies.token;

    const user = await getCurrentUser(token);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    const updatedData = await updateProfileService(user.id, req.body, req.file);
    return res.status(200).json({
      success: true,
      user: updatedData
    });
   
  } catch (err) {
    return res.status(err.status || 500).json({
      error: err.message
    });
  }
};

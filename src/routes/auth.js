import express from 'express';
import { authenticateUser, createUser } from '../db.js';

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('login');
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = authenticateUser(email, password);
  if (!user) {
    req.flash('error', 'Invalid credentials');
    return res.redirect('/login');
  }
  req.session.userId = user.id;
  req.flash('success', 'Welcome back!');
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('register');
});

router.post('/register', (req, res) => {
  const { role, name, email, password, referralCode } = req.body;
  if (!role || !['provider', 'client'].includes(role)) {
    req.flash('error', 'Please choose a role');
    return res.redirect('/register');
  }
  if (!name || !email || !password) {
    req.flash('error', 'All fields are required');
    return res.redirect('/register');
  }
  try {
    const userId = createUser({ role, name, email, password, referredByCode: referralCode || null });
    req.session.userId = userId;
    req.flash('success', 'Welcome to the platform!');
    res.redirect('/dashboard');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/register');
  }
});

export default router;



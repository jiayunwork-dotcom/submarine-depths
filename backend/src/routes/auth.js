const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../models/database');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const existing = await query(
      'SELECT id FROM players WHERE username = $1',
      [username]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const result = await query(
      'INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, passwordHash]
    );
    
    const token = jwt.sign(
      { id: result.rows[0].id, username },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: result.rows[0] });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const result = await query(
      'SELECT id, username, password_hash FROM players WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    await query(
      'UPDATE players SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    
    const result = await query(
      'SELECT id, username, games_played, games_won, created_at FROM players WHERE id = $1',
      [decoded.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;

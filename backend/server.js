const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors()); // Permitir peticiones cross-origin (ej. de Vercel a Render)
app.use(express.json()); // Permitir parsear el cuerpo de las peticiones en formato JSON

const PORT = process.env.PORT || 3000;

// Servir los archivos estáticos del frontend (HTML, CSS, JS) en la raíz
app.use(express.static(path.join(__dirname, '../frontend')));

// Endpoint que expone la URL y Anon Key públicas de Supabase para el cliente
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});

// Endpoint seguro para validar el inicio de sesión
app.post('/api/login', (req, res) => {
  const { username, room, key } = req.body;

  if (!username || !room || !key) {
    return res.status(400).json({ valid: false, error: "Faltan campos requeridos." });
  }

  const allowedUsers = (process.env.ALLOWED_USERS || '').split(',').map(u => u.trim().toLowerCase());
  const allowedRoom = (process.env.ALLOWED_ROOM || '').trim().toLowerCase();
  const allowedKey = (process.env.ALLOWED_KEY || '').trim();

  const cleanUser = username.trim().toLowerCase();
  const cleanRoom = room.trim().toLowerCase();

  // Validación exclusiva solicitada (se responde con error genérico para mayor seguridad)
  if (allowedUsers.includes(cleanUser) && cleanRoom === allowedRoom && key === allowedKey) {
    return res.json({ valid: true });
  } else {
    return res.status(401).json({ valid: false, error: "Error en el servidor." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en: http://localhost:${PORT}`);
});

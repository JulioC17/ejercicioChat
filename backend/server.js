const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors()); // Permitir peticiones cross-origin (ej. de Vercel a Render)
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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en: http://localhost:${PORT}`);
});

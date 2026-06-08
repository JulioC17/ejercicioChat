const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
app.use(cors()); // Permitir peticiones cross-origin (ej. de Vercel a Render)
app.use(express.json({ limit: '50mb' })); // Permitir parsear JSON con límite aumentado para imágenes

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

// Endpoint para subir imágenes a Cloudinary (Base64)
app.post('/api/upload', async (req, res) => {
  console.log("--> Recibida petición POST /api/upload");
  const { image } = req.body;
  if (!image) {
    console.log("❌ Error: No se proporcionó ninguna imagen.");
    return res.status(400).json({ error: 'No se ha proporcionado ninguna imagen.' });
  }

  const payloadSizeKb = Math.round(Buffer.byteLength(image) / 1024);
  console.log(`ℹ️ Tamaño de la imagen recibida: ${payloadSizeKb} KB`);

  try {
    console.log("⏳ Enviando imagen a Cloudinary...");
    const uploadResult = await cloudinary.uploader.upload(image, {
      folder: 'chat_temporales',
      resource_type: 'auto'
    });
    console.log("✅ Subida exitosa a Cloudinary. URL:", uploadResult.secure_url);

    res.json({
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id
    });
  } catch (error) {
    console.error("❌ Error al subir imagen a Cloudinary:", error);
    res.status(500).json({ error: 'Error al procesar y subir la imagen.' });
  }
});

// Endpoint para borrar imágenes de Cloudinary de forma segura
app.post('/api/delete-image', async (req, res) => {
  const { public_id } = req.body;
  if (!public_id) {
    return res.status(400).json({ error: 'No se ha proporcionado el public_id.' });
  }

  try {
    const destroyResult = await cloudinary.uploader.destroy(public_id);
    res.json({ success: true, result: destroyResult });
  } catch (error) {
    console.error("Error al eliminar imagen de Cloudinary:", error);
    res.status(500).json({ error: 'Error al eliminar la imagen del servidor de almacenamiento.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en: http://localhost:${PORT}`);
});

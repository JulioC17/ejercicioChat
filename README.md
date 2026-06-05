# CryptoChat Móvil 📱🔒

Un chat sencillo diseñado para dispositivos móviles como ejercicio práctico de aprendizaje. Utiliza **Supabase** como base de datos en tiempo real y **cifrado local AES de extremo a extremo (E2EE)** mediante **CryptoJS**.

## 🚀 Características

* **Diseño Mobile-First Premium**: Interfaz oscura con efectos de desenfoque de cristal (glassmorphism) y micro-animaciones, diseñada a medida para pantallas táctiles.
* **Cifrado AES Local**: Los mensajes son cifrados en tu dispositivo antes de viajar a internet. Solo las personas con la clave secreta exacta de la sala podrán leerlos.
* **Tiempo Real**: Sincronización instantánea de nuevos mensajes mediante WebSockets gracias al sistema *Realtime* de Supabase.
* **Sin Registro Complejo**: Acceso rápido con solo ingresar un apodo y la clave de la sala.

## 🛠️ Configuración

1. Abre el archivo **`backend/.env`** en tu editor de código.
2. Configura tus credenciales de Supabase (las que copiaste de tu panel en **Settings > API**):
   ```env
   SUPABASE_URL=tu_supabase_url_aqui
   SUPABASE_ANON_KEY=tu_supabase_anon_key_aqui
   PORT=3000
   ```
3. Ve a la carpeta del backend e instala las dependencias (`express` y `dotenv`):
   ```bash
   cd backend
   npm install
   ```

## 💻 Cómo Ejecutar el Proyecto

Una vez configuradas las credenciales e instaladas las dependencias:

1. Desde la carpeta **`backend/`**, inicia el servidor de desarrollo ejecutando:
   ```bash
   npm start
   ```
   *(o bien `node server.js`)*
2. Abre tu navegador en **`http://localhost:3000`** para empezar a usar la aplicación.
3. Para probar en tu móvil, conéctalo a la misma red Wi-Fi que tu ordenador y accede usando la IP local de tu máquina en el puerto `3000` (ej: `http://192.168.1.XX:3000`).

## 🔒 ¿Cómo funciona la seguridad?

1. **Cifrado en tránsito y reposo**: Cuando escribes un mensaje, `CryptoJS.AES` toma el texto plano y lo cifra con la contraseña de la sala. El resultado es indescifrable (`U2FsdGVkX1...`).
2. **Base de Datos Ciega**: Supabase almacena el remitente (apodo) y el contenido cifrado. Si un atacante roba la base de datos o tú la revisas en el panel de control, los mensajes serán completamente ilegibles.
3. **Descifrado en recepción**: Al cargarse los mensajes, la web intenta descifrar cada uno usando la contraseña activa de la sala. Si la contraseña coincide, el mensaje se visualiza correctamente; de lo contrario, se muestra una alerta visual de "Mensaje Cifrado - Clave Incorrecta" junto con el texto cifrado crudo.

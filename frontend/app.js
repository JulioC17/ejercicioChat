

// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
// El cliente se inicializa dinámicamente desde el backend para mayor seguridad
let supabaseClient = null;

function getBackendUrl() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? ''
    : 'https://ejerciciochat.onrender.com';
}

async function initSupabase() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/api/config`);
    if (!response.ok) throw new Error("No se pudo obtener la configuración del servidor.");
    const config = await response.json();
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    return true;
  } catch (error) {
    console.error("Error cargando configuración de Supabase:", error);
    return false;
  }
}

// ==========================================
// ESTADO DE LA APLICACIÓN
// ==========================================
let currentUser = null; // Guardará { id, username }
let secretKey = '';     // Clave para cifrar/descifrar
let currentRoomName = ''; // Nombre legible de la sala
let currentRoomId = '';   // Hash SHA-256 de la sala
const usersCache = {};  // Caché de { usuario_id: username } para el tiempo real
let messageSubscription = null;

// ==========================================
// ELEMENTOS DEL DOM
// ==========================================
// Pantallas
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');

// Formulario Login
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const secretKeyInput = document.getElementById('secret-key-input');
const btnEnter = document.getElementById('btn-enter');
const toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility');

// Panel Chat
const currentUserDisplay = document.getElementById('current-user-display');
const currentRoomDisplay = document.getElementById('current-room-display');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const btnSend = document.getElementById('btn-send');
const btnLogout = document.getElementById('btn-logout');
const btnShowKey = document.getElementById('btn-show-key');

// Modal
const keyModal = document.getElementById('key-modal');
const activeKeyDisplay = document.getElementById('active-key-display');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCopyKey = document.getElementById('btn-copy-key');

// Botones de Imagen y Modal de Imagen
const btnAttach = document.getElementById('btn-attach');
const imageInput = document.getElementById('image-input');
const imageModal = document.getElementById('image-modal');
const modalImageView = document.getElementById('modal-image-view');
const btnCloseImageModal = document.getElementById('btn-close-image-modal');

// Modal de Confirmación de Salida
const logoutConfirmModal = document.getElementById('logout-confirm-modal');
const btnConfirmLogoutCancel = document.getElementById('btn-confirm-logout-cancel');
const btnConfirmLogoutOk = document.getElementById('btn-confirm-logout-ok');

// Modal de Alerta
const alertModal = document.getElementById('alert-modal');
const alertTitle = document.getElementById('alert-title');
const alertMessage = document.getElementById('alert-message');
const btnCloseAlert = document.getElementById('btn-close-alert');

let alertResolve = null;

function customAlert(message, title = "Aviso") {
  return new Promise((resolve) => {
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    alertModal.classList.add('active');
    alertResolve = resolve;
  });
}

btnCloseAlert.addEventListener('click', () => {
  alertModal.classList.remove('active');
  if (alertResolve) {
    alertResolve();
    alertResolve = null;
  }
});

// ==========================================
// FUNCIONES DE CIFRADO (AES)
// ==========================================

/**
 * Cifra un texto usando la clave secreta
 */
function encryptText(text, key) {
  try {
    return CryptoJS.AES.encrypt(text, key).toString();
  } catch (error) {
    console.error("Error al cifrar:", error);
    return "[Error de Cifrado]";
  }
}

/**
 * Descifra un texto usando la clave secreta.
 * Devuelve null si la clave es incorrecta o falla el descifrado.
 */
function decryptText(cipherText, key) {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText) {
      return null;
    }
    return originalText;
  } catch (error) {
    return null;
  }
}

// ==========================================
// LOGICA DE AUTENTICACIÓN / REGISTRO SIMPLIFICADO
// ==========================================

async function handleLogin() {
  const usernameVal = usernameInput.value.trim();
  const roomVal = roomInput.value.trim();
  const keyVal = secretKeyInput.value;

  // Validaciones básicas
  if (!supabaseClient) {
    customAlert("Error: No se pudo conectar con el servidor o las credenciales en el archivo .env son incorrectas.");
    return;
  }

  if (!usernameVal) {
    customAlert("Por favor, introduce tu nombre o apodo.");
    usernameInput.focus();
    return;
  }

  if (!roomVal) {
    customAlert("Por favor, introduce el nombre de la sala.");
    roomInput.focus();
    return;
  }

  if (!keyVal) {
    customAlert("Por favor, introduce la clave secreta de la sala.");
    secretKeyInput.focus();
    return;
  }

  const cleanUsername = usernameVal.toLowerCase();

  // Desactivar botón y mostrar estado de carga
  btnEnter.disabled = true;
  btnEnter.innerHTML = `<span>Validando credenciales...</span><div class="loader" style="margin:0; width:16px; height:16px; border-width:2px;"></div>`;

  try {
    const backendUrl = getBackendUrl();
    const loginResponse = await fetch(`${backendUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, room: roomVal, key: keyVal })
    });

    if (!loginResponse.ok) {
      customAlert("Error en el servidor.");
      return;
    }

    // Mostrar estado de carga para buscar el usuario en la BD
    btnEnter.innerHTML = `<span>Buscando usuario...</span><div class="loader" style="margin:0; width:16px; height:16px; border-width:2px;"></div>`;

    // 1. Intentar buscar si el usuario ya existe en la base de datos
    let { data: user, error } = await supabaseClient
      .from('usuarios')
      .select('*')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (error) throw error;

    // 2. Si no existe, lo creamos
    if (!user) {
      btnEnter.innerHTML = `<span>Creando usuario nuevo...</span><div class="loader" style="margin:0; width:16px; height:16px; border-width:2px;"></div>`;
      const { data: newUser, error: insertError } = await supabaseClient
        .from('usuarios')
        .insert([{ username: cleanUsername }])
        .select()
        .single();

      if (insertError) throw insertError;
      user = newUser;
    }

    // 3. Guardar en el estado local y localStorage
    currentUser = { id: user.id, username: cleanUsername };
    secretKey = keyVal;
    currentRoomName = roomVal;
    // Generar el hash SHA-256 del nombre de la sala para la base de datos
    currentRoomId = CryptoJS.SHA256(roomVal.toLowerCase()).toString();
    usersCache[user.id] = cleanUsername; // Guardar en caché local

    localStorage.setItem('cryptochat_user', JSON.stringify(currentUser));
    localStorage.setItem('cryptochat_key', secretKey);
    localStorage.setItem('cryptochat_room_name', currentRoomName);

    // 4. Cambiar de pantalla y configurar interfaz
    currentUserDisplay.textContent = `@${cleanUsername}`;
    currentRoomDisplay.textContent = currentRoomName;
    loginScreen.classList.remove('active');
    chatScreen.classList.add('active');

    // Cargar historial de mensajes y suscribirse
    await loadMessages();
    setupRealtimeSubscription();

  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    customAlert("Error al conectar con la base de datos: " + error.message);
  } finally {
    // Restaurar botón
    btnEnter.disabled = false;
    btnEnter.innerHTML = `<span>Entrar al Chat</span><i data-lucide="arrow-right"></i>`;
    lucide.createIcons();
  }
}

// ==========================================
// OBTENER Y PINTAR MENSAJES
// ==========================================

async function loadMessages() {
  messagesContainer.innerHTML = `<div class="loader"></div>`;

  try {
    // Hacer join de mensajes con usuarios y filtrar por sala
    const { data: messages, error } = await supabaseClient
      .from('mensajes')
      .select('*, usuarios(username)')
      .eq('room_id', currentRoomId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    messagesContainer.innerHTML = ''; // Limpiar loader

    // Agregar mensaje explicativo de bienvenida
    const welcomeBox = document.createElement('div');
    welcomeBox.className = 'welcome-box';
    welcomeBox.innerHTML = `
      <i data-lucide="lock" class="welcome-icon"></i>
      <h3>Chat Cifrado Activado</h3>
      <p>Todos los mensajes están cifrados localmente usando AES. Los datos en la base de datos de Supabase son completamente indescifrables sin tu clave.</p>
    `;
    messagesContainer.appendChild(welcomeBox);

    if (messages && messages.length > 0) {
      messages.forEach(msg => {
        // Guardar en la caché de usuarios para uso futuro en tiempo real
        if (msg.usuarios) {
          usersCache[msg.usuario_id] = msg.usuarios.username;
        }
        
        appendMessageToDOM(msg);
      });
      scrollToBottom();
    } else {
      // Si no hay mensajes
      const emptyMsg = document.createElement('p');
      emptyMsg.id = 'empty-chat-message';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.color = 'var(--text-muted)';
      emptyMsg.style.fontSize = '0.9rem';
      emptyMsg.style.padding = '2rem 0';
      emptyMsg.textContent = 'No hay mensajes en esta sala. ¡Sé el primero en escribir!';
      messagesContainer.appendChild(emptyMsg);
    }

    lucide.createIcons();

  } catch (error) {
    console.error("Error al cargar mensajes:", error);
    messagesContainer.innerHTML = `<p style="color:#ef4444; text-align:center; padding: 2rem;">Error al cargar mensajes: ${error.message}</p>`;
  }
}

/**
 * Pinta un mensaje en el DOM, realizando la lógica de descifrado
 */
function appendMessageToDOM(msg) {
  // Eliminar mensaje de chat vacío si existe
  const emptyChatMsg = document.getElementById('empty-chat-message');
  if (emptyChatMsg) emptyChatMsg.remove();

  const isSentByMe = msg.usuario_id === currentUser.id;
  const senderName = usersCache[msg.usuario_id] || 'Usuario Desconocido';
  
  // Crear elementos
  const messageRow = document.createElement('div');
  messageRow.id = `msg-${msg.id}`; // Asignar ID único para manejo en tiempo real
  messageRow.classList.add('message-row');
  messageRow.classList.add(isSentByMe ? 'sent' : 'received');

  // Intentar descifrar
  const decryptedContent = decryptText(msg.contenido, secretKey);
  const isDecryptionSuccessful = decryptedContent !== null;

  // Formatear la hora
  const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isDecryptionSuccessful) {
    // Verificar si es una foto temporal o destruida
    let isJson = false;
    let payload = null;
    try {
      payload = JSON.parse(decryptedContent);
      if (payload && (payload.type === 'view-once-image' || payload.type === 'view-once-image-destroyed')) {
        isJson = true;
      }
    } catch (e) {
      // Es texto normal
    }

    if (isJson && payload) {
      if (payload.type === 'view-once-image') {
        messageRow.innerHTML = `
          <span class="message-sender">${isSentByMe ? 'Tú' : '@' + senderName}</span>
          <div class="message-bubble temp-image-bubble">
            <div class="temp-image-text">
              <i data-lucide="camera" class="temp-image-icon"></i>
              <span>Foto Temporal</span>
            </div>
            <span class="temp-image-sub">Toca para abrir</span>
            <span class="message-time">${timeString}</span>
          </div>
        `;
        
        const bubble = messageRow.querySelector('.temp-image-bubble');
        bubble.addEventListener('click', () => {
          openTempImage(msg.id, payload.url, payload.public_id);
        });
      } else if (payload.type === 'view-once-image-destroyed') {
        messageRow.innerHTML = `
          <span class="message-sender">${isSentByMe ? 'Tú' : '@' + senderName}</span>
          <div class="message-bubble destroyed-photo-bubble">
            <div class="temp-image-text">
              <i data-lucide="eye-off" class="temp-image-icon"></i>
              <span>🚫 Foto abierta y destruida</span>
            </div>
            <span class="message-time">${timeString}</span>
          </div>
        `;
      }
    } else {
      messageRow.innerHTML = `
        <span class="message-sender">${isSentByMe ? 'Tú' : '@' + senderName}</span>
        <div class="message-bubble">
          <span class="msg-text"></span>
          <span class="message-time">${timeString}</span>
        </div>
      `;
      // Asignar el texto de forma segura usando textContent para evitar ataques XSS
      messageRow.querySelector('.msg-text').textContent = decryptedContent;
    }
  } else {
    // Si falla el descifrado, mostramos el error y el texto cifrado original
    messageRow.classList.add('decryption-error');
    messageRow.innerHTML = `
      <span class="message-sender">${isSentByMe ? 'Tú' : '@' + senderName}</span>
      <div class="message-bubble" title="Clave secreta incorrecta para descifrar este mensaje">
        <span>⚠️ [Mensaje Cifrado - Clave Incorrecta]</span>
        <span class="cipher-raw">${msg.contenido.substring(0, 30)}...</span>
        <span class="message-time">${timeString}</span>
      </div>
    `;
  }

  messagesContainer.appendChild(messageRow);
}

// ==========================================
// ENVIAR MENSAJES
// ==========================================

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  // Cifrar el mensaje antes de enviarlo
  const encryptedText = encryptText(text, secretKey);
  messageInput.value = ''; // Limpiar campo de texto de inmediato para dar fluidez

  try {
    const { error } = await supabaseClient
      .from('mensajes')
      .insert([
        {
          contenido: encryptedText,
          usuario_id: currentUser.id,
          room_id: currentRoomId
        }
      ]);

    if (error) throw error;

  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    customAlert("Error al enviar: " + error.message);
  }
}

// ==========================================
// FOTOS TEMPORALES (CLOUDINARY)
// ==========================================

async function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validar tamaño máximo a 30MB
  if (file.size > 30 * 1024 * 1024) {
    customAlert("La foto es demasiado grande. El límite es de 30 MB.");
    imageInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const base64Image = reader.result;

    // Deshabilitar entrada mientras sube
    btnAttach.disabled = true;
    btnSend.disabled = true;
    messageInput.disabled = true;
    const oldPlaceholder = messageInput.placeholder;
    messageInput.placeholder = "Subiendo y cifrando foto...";
    messageInput.value = "Enviando imagen temporal...";

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });

      if (!response.ok) throw new Error("Error en la subida al servidor.");
      const data = await response.json();

      // Cifrar localmente los metadatos de la imagen antes de enviar a Supabase
      const payload = {
        type: "view-once-image",
        url: data.url,
        public_id: data.public_id
      };
      const encryptedPayload = encryptText(JSON.stringify(payload), secretKey);

      const { error } = await supabaseClient
        .from('mensajes')
        .insert([
          {
            contenido: encryptedPayload,
            usuario_id: currentUser.id,
            room_id: currentRoomId
          }
        ]);

      if (error) throw error;

    } catch (error) {
      console.error("Error al enviar foto:", error);
      customAlert("No se pudo enviar la foto: " + error.message);
    } finally {
      btnAttach.disabled = false;
      btnSend.disabled = false;
      messageInput.disabled = false;
      messageInput.placeholder = oldPlaceholder;
      messageInput.value = '';
      imageInput.value = '';
    }
  };

  reader.onerror = (error) => {
    console.error("Error al leer archivo:", error);
    customAlert("Error al leer la foto.");
  };

  reader.readAsDataURL(file);
}

async function openTempImage(messageId, imageUrl, publicId) {
  modalImageView.src = imageUrl;
  imageModal.classList.add('active');

  // Actualizar la interfaz local de inmediato para que sea instantáneo para el que la abre
  const msgEl = document.getElementById(`msg-${messageId}`);
  if (msgEl) {
    const bubble = msgEl.querySelector('.temp-image-bubble');
    if (bubble) {
      bubble.classList.add('destroyed-photo-bubble');
      const textEl = bubble.querySelector('.temp-image-text');
      if (textEl) {
        textEl.innerHTML = `
          <i data-lucide="eye-off" class="temp-image-icon"></i>
          <span>🚫 Foto abierta y destruida</span>
        `;
      }
      const subEl = bubble.querySelector('.temp-image-sub');
      if (subEl) subEl.remove();
      lucide.createIcons();
    }
  }

  try {
    // Sobrescribir en la base de datos para borrar la URL de Cloudinary de Supabase
    const payload = { type: "view-once-image-destroyed" };
    const encryptedPayload = encryptText(JSON.stringify(payload), secretKey);

    await supabaseClient
      .from('mensajes')
      .update({ contenido: encryptedPayload })
      .eq('id', messageId);

    // Notificar al backend para eliminar de Cloudinary
    const backendUrl = getBackendUrl();
    await fetch(`${backendUrl}/api/delete-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_id: publicId })
    });

  } catch (error) {
    console.error("Error al autodestruir la imagen:", error);
  }
}

// ==========================================
// TIEMPO REAL (REALTIME)
// ==========================================

function setupRealtimeSubscription() {
  if (messageSubscription) {
    supabaseClient.removeChannel(messageSubscription);
  }

  messageSubscription = supabaseClient
    .channel('mensajes_en_tiempo_real')
    .on(
      'postgres_changes',
      { 
        event: '*', // Escuchar todo (INSERT, DELETE, UPDATE)
        schema: 'public', 
        table: 'mensajes',
        filter: `room_id=eq.${currentRoomId}` 
      },
      async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new;

          if (!usersCache[newMsg.usuario_id]) {
            try {
              const { data: user, error } = await supabaseClient
                .from('usuarios')
                .select('username')
                .eq('id', newMsg.usuario_id)
                .single();

              if (!error && user) {
                usersCache[newMsg.usuario_id] = user.username;
              }
            } catch (e) {
              console.error("Error al obtener nombre de usuario en tiempo real:", e);
            }
          }

          appendMessageToDOM(newMsg);
          scrollToBottom();
        } else if (payload.eventType === 'UPDATE') {
          const updatedMsg = payload.new;
          const msgEl = document.getElementById(`msg-${updatedMsg.id}`);
          if (msgEl) {
            const decrypted = decryptText(updatedMsg.contenido, secretKey);
            let isJson = false;
            let p = null;
            try {
              p = JSON.parse(decrypted);
              if (p && p.type === 'view-once-image-destroyed') {
                isJson = true;
              }
            } catch (e) {}

            if (isJson) {
              const bubble = msgEl.querySelector('.message-bubble');
              if (bubble) {
                bubble.classList.add('destroyed-photo-bubble');
                const textEl = bubble.querySelector('.temp-image-text');
                if (textEl) {
                  textEl.innerHTML = `
                    <i data-lucide="eye-off" class="temp-image-icon"></i>
                    <span>🚫 Foto abierta y destruida</span>
                  `;
                }
                const subEl = bubble.querySelector('.temp-image-sub');
                if (subEl) subEl.remove();
                lucide.createIcons();
              }
            }
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedMsgId = payload.old.id;
          const msgEl = document.getElementById(`msg-${deletedMsgId}`);
          if (msgEl) {
            msgEl.remove();
          }
        }
      }
    )
    .subscribe();
}

// ==========================================
// UTILIDADES Y EVENTOS
// ==========================================

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Toggle visibilidad de la clave de acceso
toggleKeyVisibilityBtn.addEventListener('click', () => {
  const isPassword = secretKeyInput.type === 'password';
  secretKeyInput.type = isPassword ? 'text' : 'password';
  toggleKeyVisibilityBtn.textContent = isPassword ? 'Ocultar' : 'Mostrar';
});

// Eventos de entrada
btnEnter.addEventListener('click', handleLogin);
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') secretKeyInput.focus();
});
secretKeyInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleLogin();
});

// Eventos del Chat
btnSend.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Eventos de Imagen
btnAttach.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', handleImageUpload);

// Cerrar visor de imagen
btnCloseImageModal.addEventListener('click', () => {
  imageModal.classList.remove('active');
  modalImageView.src = '';
});

// Cerrar sesión (abrir modal custom)
btnLogout.addEventListener('click', () => {
  logoutConfirmModal.classList.add('active');
});

btnConfirmLogoutCancel.addEventListener('click', () => {
  logoutConfirmModal.classList.remove('active');
});

btnConfirmLogoutOk.addEventListener('click', () => {
  logoutConfirmModal.classList.remove('active');
  
  if (messageSubscription) {
    supabaseClient.removeChannel(messageSubscription);
    messageSubscription = null;
  }
  currentUser = null;
  secretKey = '';
  localStorage.removeItem('cryptochat_user');
  localStorage.removeItem('cryptochat_key');
  localStorage.removeItem('cryptochat_room_name');
  
  chatScreen.classList.remove('active');
  loginScreen.classList.add('active');
  
  // Limpiar inputs
  usernameInput.value = '';
  roomInput.value = '';
  secretKeyInput.value = '';
});

// Modal de clave activa
btnShowKey.addEventListener('click', () => {
  activeKeyDisplay.textContent = secretKey;
  keyModal.classList.add('active');
});

btnCloseModal.addEventListener('click', () => {
  keyModal.classList.remove('active');
});

keyModal.addEventListener('click', (e) => {
  if (e.target === keyModal) {
    keyModal.classList.remove('active');
  }
});

// Copiar clave
btnCopyKey.addEventListener('click', () => {
  navigator.clipboard.writeText(secretKey).then(() => {
    const icon = btnCopyKey.querySelector('i');
    icon.setAttribute('data-lucide', 'check');
    lucide.createIcons();
    setTimeout(() => {
      icon.setAttribute('data-lucide', 'copy');
      lucide.createIcons();
    }, 2000);
  });
});

// Cargar configuración e iniciar sesión guardada automáticamente
window.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  
  // Esperar a que se conecte con Supabase
  const isConnected = await initSupabase();
  if (!isConnected) {
    customAlert("No se pudo conectar con la base de datos. Verifica que el servidor esté corriendo y el archivo .env esté configurado.");
    return;
  }
  
  const savedUser = localStorage.getItem('cryptochat_user');
  const savedKey = localStorage.getItem('cryptochat_key');
  const savedRoomName = localStorage.getItem('cryptochat_room_name');
  
  if (savedUser && savedKey && savedRoomName) {
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch (e) {
      parsedUser = null;
    }
    
    const cleanUser = parsedUser && parsedUser.username ? parsedUser.username.toLowerCase() : '';
    
    if (cleanUser && savedKey && savedRoomName) {
      try {
        const backendUrl = getBackendUrl();
        const loginResponse = await fetch(`${backendUrl}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, room: savedRoomName, key: savedKey })
        });

        if (loginResponse.ok) {
          currentUser = parsedUser;
          secretKey = savedKey;
          currentRoomName = savedRoomName;
          currentRoomId = CryptoJS.SHA256(currentRoomName.toLowerCase()).toString();
          usersCache[currentUser.id] = currentUser.username;
          
          currentUserDisplay.textContent = `@${currentUser.username}`;
          currentRoomDisplay.textContent = currentRoomName;
          loginScreen.classList.remove('active');
          chatScreen.classList.add('active');
          
          loadMessages();
          setupRealtimeSubscription();
        } else {
          // Limpiar localStorage si tenía datos antiguos no permitidos
          localStorage.removeItem('cryptochat_user');
          localStorage.removeItem('cryptochat_key');
          localStorage.removeItem('cryptochat_room_name');
        }
      } catch (err) {
        console.error("Error al validar auto-login con el servidor:", err);
      }
    }
  }
});

/* ===========================================================
   CICÍ PRO MAX ULTRA - VERSÃO 17.0 (INSTALADOR & VOZ HUMANA)
   =========================================================== */

const CiciAI = {
    isOpen: false,
    userRole: 'visitor',
    userName: '',
    deviceInfo: 'Dispositivo Desconhecido',
    currentPage: 'Página Desconhecida',
    hasGreeted: false,
    currentLang: 'pt-BR', 
    currentImageBase64: null,
    avatarUrl: 'https://img.freepik.com/fotos-gratis/jovem-mulher-confiante-com-oculos_1098-20868.jpg?w=200',

    // 🌟 MELHORIA: Voz Mais Humana e Expressiva
    speak: function(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); 
        
        const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/\*/g, '').replace(/\[.*?\]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        const voices = window.speechSynthesis.getVoices();
        // Procura vozes "Natural" ou "Premium" que soam muito melhor
        const humanVoice = voices.find(v => (v.lang.startsWith('pt') && v.name.includes('Google')) || v.name.includes('Natural'));
        
        if (humanVoice) {
            utterance.voice = humanVoice;
        }
        
        // Parâmetros para voz menos robótica
        utterance.pitch = 1.1; // Tom levemente mais agudo (mais amigável)
        utterance.rate = 0.95; // Velocidade levemente reduzida para clareza
        utterance.lang = this.currentLang;
        
        window.speechSynthesis.speak(utterance);
    },

    // 🌟 NOVA HABILIDADE: Tutorial de Instalação (PWA)
    showInstallGuide: function() {
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);

        if (isIOS) {
            this.addMessage("<b>📱 Instalar no iPhone:</b><br>1. Toque no ícone de <b>Compartilhar</b> (quadrado com seta abaixo).<br>2. Role e escolha <b>'Adicionar à Tela de Início'</b>.<br>3. Pronto! O ícone aparecerá como um App.", 'cici');
        } else if (isAndroid) {
            this.addMessage("<b>🤖 Instalar no Android:</b><br>1. Toque nos <b>3 pontinhos</b> lá em cima.<br>2. Escolha <b>'Instalar Aplicativo'</b> ou 'Adicionar à tela inicial'.", 'cici');
        } else {
            this.addMessage("Para instalar no computador, clique no ícone de (+) na barra de endereços do Chrome.", 'cici');
        }
    },

    listen: function() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const recognition = new SpeechRecognition();
        recognition.lang = this.currentLang;
        recognition.onstart = () => { document.getElementById('cici-input').placeholder = "🎤 Ouvindo..."; };
        recognition.onresult = (event) => {
            document.getElementById('cici-input').value = event.results[0][0].transcript;
            this.handleSend(); 
        };
        recognition.start();
    },

    init: function() {
        this.detectContext();
        this.renderWidget();
        window.speechSynthesis.getVoices();
        setTimeout(() => {
            const badge = document.getElementById('cici-badge');
            if(badge) badge.classList.remove('hidden');
        }, 1500);
    },

    enableNotifications: async function() {
        if (!('serviceWorker' in navigator)) return;
        try {
            const register = await navigator.serviceWorker.register('/sw.js');
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const urlBase64ToUint8Array = (base64String) => {
                    const padding = '='.repeat((4 - base64String.length % 4) % 4);
                    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                    const rawData = window.atob(base64);
                    const outputArray = new Uint8Array(rawData.length);
                    for (let i = 0; i < rawData.length; ++i) {
                        outputArray[i] = rawData.charCodeAt(i);
                    }
                    return outputArray;
                };
                const publicVapidKey = 'BA_H_d0E7KaJSgex51WxeAchwC9XI6graWVeazPjv2o_CWgi93iQ0ckagGQeSOcZcndzhrHC0jWNIuFIGQJ3BdY';
                const subscription = await register.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                });
                await fetch('/api/notifications/subscribe', {
                    method: 'POST',
                    body: JSON.stringify(subscription),
                    headers: { 'Content-Type': 'application/json' }
                });
                this.addMessage("✅ Notificações ativadas! Vou te avisar de tudo.", 'cici');
            }
        } catch (e) { console.error(e); }
    },

    detectContext: function() {
        const path = window.location.pathname;
        const ua = navigator.userAgent;
        this.deviceInfo = /Android|iPhone|iPad/i.test(ua) ? "Telemóvel" : "Computador";
        if (path === '/' || path.includes('login') || path.includes('index')) this.currentPage = 'Login';
        else if (path.includes('cadastro')) this.currentPage = 'Cadastro';
        else if (path.includes('admin')) { this.currentPage = 'Painel Admin'; this.userRole = 'admin'; }
        else if (path.includes('employee')) { this.currentPage = 'Painel Colaborador'; this.userRole = 'employee'; }
        else if (path.includes('client')) { this.currentPage = 'Painel Cliente'; this.userRole = 'client'; }
        const nameEl = document.getElementById('user-name-display');
        if (nameEl && nameEl.innerText !== '...') this.userName = nameEl.innerText.trim();
    },

    renderWidget: function() {
        if(document.getElementById('cici-widget')) return;
        const html = `
            <div id="cici-widget">
                <div id="cici-chat-window">
                    <div class="cici-header">
                        <div class="cici-info">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <div style="width:40px; height:40px; background:url('${this.avatarUrl}') center/cover; border-radius:50%; border:2px solid #fff;"></div>
                                <div><h4 style="margin:0; font-size:15px; font-weight:700;">Cicí Pro 17.0</h4><small>Logística Inteligente</small></div>
                            </div>
                        </div>
                        <button onclick="CiciAI.toggle()" style="background:none;border:none;color:white;cursor:pointer;font-size:24px;">&times;</button>
                    </div>
                    <div class="cici-body" id="cici-messages"></div>
                    <div id="cici-image-preview" style="display:none; padding: 10px; background: #f1f3f5; border-top: 1px solid #ddd; position: relative;">
                        <img id="cici-preview-img" style="max-height: 60px; border-radius: 5px;">
                        <button onclick="CiciAI.clearImage()" style="position: absolute; top: 5px; right: 10px; background: #ff4757; color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer;">&times;</button>
                    </div>
                    <div class="cici-input-area">
                        <input type="file" id="cici-file-input" accept="image/*" style="display:none;" onchange="CiciAI.handleFileSelect(event)">
                        <button onclick="document.getElementById('cici-file-input').click()" class="cici-mic-btn"><i class="fas fa-camera"></i></button>
                        <button onclick="CiciAI.listen()" class="cici-mic-btn"><i class="fas fa-microphone"></i></button>
                        <input type="text" id="cici-input" placeholder="Diga oi para a Cicí..." onkeypress="CiciAI.handleInput(event)">
                        <button onclick="CiciAI.handleSend()" class="cici-send-btn"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
                <div id="cici-avatar" onclick="CiciAI.toggle()" style="background-image: url('${this.avatarUrl}');">
                    <div id="cici-badge" class="cici-badge hidden">1</div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    toggle: function() {
        const win = document.getElementById('cici-chat-window');
        this.isOpen = !this.isOpen;
        win.classList.toggle('open', this.isOpen);
        if (this.isOpen && !this.hasGreeted) { this.processText("", true, true); this.hasGreeted = true; }
    },

    handleFileSelect: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentImageBase64 = e.target.result;
            document.getElementById('cici-preview-img').src = this.currentImageBase64;
            document.getElementById('cici-image-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    },

    clearImage: function() {
        this.currentImageBase64 = null;
        document.getElementById('cici-file-input').value = "";
        document.getElementById('cici-image-preview').style.display = 'none';
    },

    processText: async function(text, silent = false, isFirstMessage = false) {
        if(!text && !this.currentImageBase64 && !isFirstMessage) return;
        if(!silent && text) this.addMessage(text, 'user');
        this.showTyping();

        const payload = { 
            text, 
            userContext: { role: this.userRole, name: this.userName, deviceInfo: this.deviceInfo, currentPage: this.currentPage },
            image: this.currentImageBase64,
            isFirstMessage 
        };
        this.clearImage();

        try {
            const response = await fetch('/api/cici/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            this.hideTyping();
            if(data.lang) this.currentLang = data.lang;
            let finalReply = data.reply;

            // --- PROCESSADOR DE AÇÕES ---
            if(finalReply.includes('[ACTION:install]')) {
                this.showInstallGuide();
                finalReply = finalReply.replace(/\[ACTION:install\]/g, '');
            }
            if(finalReply.includes('[ACTION:push]')) {
                this.enableNotifications();
                finalReply = finalReply.replace(/\[ACTION:push\]/g, '');
            }
            
            // Redirecionamento
            const redMatch = finalReply.match(/\[ACTION:redirect:(.*?)\]/);
            if(redMatch) {
                setTimeout(() => window.location.href = redMatch[1], 2500);
                finalReply = finalReply.replace(/\[ACTION:redirect:.*?\]/g, '<br>🔄 Redirecionando...');
            }

            // Preenchimento
            const fillMatches = [...finalReply.matchAll(/\[ACTION:fillForm:(.*?):(.*?)\]/g)];
            fillMatches.forEach(match => {
                const el = document.getElementById(match[1]);
                if(el) { el.value = match[2]; el.style.border = "2px solid #2ecc71"; }
            });
            finalReply = finalReply.replace(/\[ACTION:fillForm:.*?:.*?\]/g, '');

            // WhatsApp
            const zapMatch = finalReply.match(/\[ZAP:(.*?):(.*?)\]/);
            if(zapMatch) {
                const link = `https://wa.me/${zapMatch[1].replace(/\D/g,'')}?text=${encodeURIComponent(zapMatch[2])}`;
                finalReply = finalReply.replace(/\[ZAP:.*?:.*?\]/g, '') + 
                `<br><br><a href="${link}" target="_blank" class="zap-btn">Chamar no WhatsApp</a>`;
            }

            this.addMessage(finalReply, 'cici');
        } catch (e) { 
            this.hideTyping(); 
            this.addMessage("Tive um probleminha de conexão.", 'cici'); 
        }
    },

    addMessage: function(text, sender) {
        const msgs = document.getElementById('cici-messages');
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        div.innerHTML = text.replace(/\n/g, '<br>');
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
        if(sender === 'cici') this.speak(text);
    },

    showTyping: function() { 
        const msgs = document.getElementById('cici-messages');
        if(!document.getElementById('typing-dots')) {
            msgs.insertAdjacentHTML('beforeend', '<div id="typing-dots" class="typing-indicator"><span></span><span></span><span></span></div>'); 
            msgs.scrollTop = msgs.scrollHeight;
        }
    },
    hideTyping: function() { const el = document.getElementById('typing-dots'); if(el) el.remove(); },
    handleInput: function(e) { if(e.key === 'Enter') this.handleSend(); },
    handleSend: function() {
        const input = document.getElementById('cici-input');
        const txt = input.value.trim();
        if(txt || this.currentImageBase64) { this.processText(txt); input.value = ''; }
    }
};

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => CiciAI.init(), 1000); });
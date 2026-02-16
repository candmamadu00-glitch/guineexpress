/* ===========================================================
   CICÍ PRO MAX ULTRA - VISÃO COMPUTACIONAL & WHATSAPP
   Versão: 12.0
   =========================================================== */

const CiciAI = {
    isOpen: false,
    userRole: 'visitor',
    userName: '',
    roleLabel: 'Visitante',
    deviceInfo: 'Computador',
    hasGreeted: false,
    currentLang: 'pt-BR', 
    currentImageBase64: null, // Guarda a imagem anexada
    
    avatarUrl: 'https://img.freepik.com/fotos-gratis/jovem-mulher-confiante-com-oculos_1098-20868.jpg?w=200',

    speak: function(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); 
        const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/\*/g, '').replace(/\[ZAP:.*?\]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = this.currentLang;
        window.speechSynthesis.speak(utterance);
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
        setTimeout(() => {
            const badge = document.getElementById('cici-badge');
            if(badge) badge.classList.remove('hidden');
        }, 1500);
    },

    detectContext: function() {
        const path = window.location.pathname;
        const ua = navigator.userAgent;
        this.deviceInfo = /android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : "Computador";

        if (path.includes('dashboard-admin')) { this.userRole = 'admin'; this.roleLabel = 'Administrador'; } 
        else if (path.includes('dashboard-employee')) { this.userRole = 'employee'; this.roleLabel = 'Colaborador'; } 
        else if (path.includes('dashboard-client')) { this.userRole = 'client'; this.roleLabel = 'Cliente VIP'; }
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
                                <div><h4 style="margin:0; font-size:15px; font-weight:700;">Cicí Pro</h4><small>Inteligência Guineexpress</small></div>
                            </div>
                        </div>
                        <button onclick="CiciAI.toggle()" style="background:none;border:none;color:white;cursor:pointer;font-size:24px;">&times;</button>
                    </div>
                    
                    <div class="cici-body" id="cici-messages">
                        <div class="msg cici">Olá! Estou analisando seu painel... 🔍</div>
                    </div>

                    <div id="cici-image-preview" style="display:none; padding: 10px; background: #f1f3f5; border-top: 1px solid #ddd; position: relative;">
                        <img id="cici-preview-img" style="max-height: 50px; border-radius: 5px;">
                        <button onclick="CiciAI.clearImage()" style="position: absolute; top: 5px; right: 10px; background: #ff4757; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer;">&times;</button>
                    </div>

                    <div class="cici-input-area">
                        <input type="file" id="cici-file-input" accept="image/*" style="display:none;" onchange="CiciAI.handleFileSelect(event)">
                        <button onclick="document.getElementById('cici-file-input').click()" class="cici-mic-btn" style="color: #666;"><i class="fas fa-paperclip"></i></button>
                        <button onclick="CiciAI.listen()" class="cici-mic-btn"><i class="fas fa-microphone"></i></button>
                        <input type="text" id="cici-input" placeholder="Digite ou anexe uma foto..." onkeypress="CiciAI.handleInput(event)">
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
        if (this.isOpen && !this.hasGreeted) {
            this.processText("Olá Cicí, analise meu painel, me cumprimente de acordo com meu nível de acesso.", true);
            this.hasGreeted = true;
        }
    },

    // Funções de Imagem
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

    processText: async function(text, silent = false) {
        if(!text && !this.currentImageBase64) return;
        
        let displayMsg = text || "📸 Imagem enviada.";
        if(!silent) this.addMessage(displayMsg, 'user');
        
        this.showTyping();

        const ctx = { role: this.userRole, name: this.userName || 'Usuário', deviceInfo: this.deviceInfo };
        const payload = { text: text, userContext: ctx, image: this.currentImageBase64 };

        // Limpa a imagem após enviar
        this.clearImage();

        try {
            const response = await fetch('/api/cici/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            this.hideTyping();
            
            if (data.lang) this.currentLang = data.lang;

            // INTERCEPTADOR DE WHATSAPP
            let finalReply = data.reply;
            const zapMatch = finalReply.match(/\[ZAP:(.*?):(.*?)\]/);
            
            if(zapMatch) {
                const phone = zapMatch[1].replace(/\D/g, ''); // Limpa o telefone
                const msg = encodeURIComponent(zapMatch[2].trim()); // Prepara pro URL
                const zapLink = `https://wa.me/${phone}?text=${msg}`;
                
                // Remove a tag e insere o botão do Zap
                finalReply = finalReply.replace(/\[ZAP:.*?:.*?\]/g, '').trim();
                finalReply += `
                    <div style="margin-top: 10px;">
                        <a href="${zapLink}" target="_blank" style="display:inline-block; background:#25D366; color:white; padding:8px 15px; border-radius:20px; text-decoration:none; font-weight:bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition:0.3s;">
                            <i class="fab fa-whatsapp"></i> Enviar WhatsApp
                        </a>
                    </div>`;
            }

            this.addMessage(finalReply, 'cici');

        } catch (error) {
            this.hideTyping();
            this.addMessage("Ops, tive um erro de conexão. 📡", 'cici');
        }
    },

    addMessage: function(text, sender) {
        const msgs = document.getElementById('cici-messages');
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        
        let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        formattedText = formattedText.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:cyan;">$1</a>');
        
        div.innerHTML = formattedText;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;

        if(sender === 'cici') this.speak(text);
    },

    showTyping: function() {
        const msgs = document.getElementById('cici-messages');
        if(document.getElementById('typing-dots')) return;
        msgs.insertAdjacentHTML('beforeend', '<div id="typing-dots" class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>');
        msgs.scrollTop = msgs.scrollHeight;
    },

    hideTyping: function() {
        const el = document.getElementById('typing-dots');
        if(el) el.remove();
    },

    handleInput: function(e) { if(e.key === 'Enter') this.handleSend(); },

    handleSend: function() {
        const input = document.getElementById('cici-input');
        const txt = input.value.trim();
        if(!txt && !this.currentImageBase64) return;
        input.value = '';
        this.processText(txt);
    }
};

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { CiciAI.init(); }, 1000); });
/* ===========================================================
   CICÍ PRO MAX ULTRA - VISÃO, WHATSAPP E DETECÇÃO DE HARDWARE
   Versão: 13.0
   =========================================================== */

const CiciAI = {
    isOpen: false,
    userRole: 'visitor',
    userName: '',
    roleLabel: 'Visitante',
    deviceInfo: 'Dispositivo Desconhecido',
    hasGreeted: false,
    currentLang: 'pt-BR', 
    currentImageBase64: null,
    
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

    // Detecção Avançada de Dispositivo
    detectContext: function() {
        const path = window.location.pathname;
        const ua = navigator.userAgent;
        
        // Descobre o aparelho
        let device = "Computador Desconhecido";
        if (/iPhone/i.test(ua)) device = "iPhone";
        else if (/iPad/i.test(ua)) device = "iPad";
        else if (/Samsung/i.test(ua)) device = "Celular Samsung";
        else if (/Xiaomi|Redmi/i.test(ua)) device = "Celular Xiaomi";
        else if (/Motorola/i.test(ua)) device = "Celular Motorola";
        else if (/Android/i.test(ua)) device = "Celular Android";
        else if (/Windows NT 10/i.test(ua)) device = "Computador com Windows 10/11";
        else if (/Mac OS/i.test(ua)) device = "MacBook ou Mac";
        else if (/Linux/i.test(ua)) device = "Computador com Linux";
        
        this.deviceInfo = device;

        // Descobre o cargo
        if (path.includes('dashboard-admin')) { this.userRole = 'admin'; this.roleLabel = 'Administrador'; } 
        else if (path.includes('dashboard-employee')) { this.userRole = 'employee'; this.roleLabel = 'Colaborador'; } 
        else if (path.includes('dashboard-client')) { this.userRole = 'client'; this.roleLabel = 'Cliente VIP'; }
        
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
                                <div><h4 style="margin:0; font-size:15px; font-weight:700;">Cicí Pro</h4><small>Inteligência Guineexpress</small></div>
                            </div>
                        </div>
                        <button onclick="CiciAI.toggle()" style="background:none;border:none;color:white;cursor:pointer;font-size:24px;">&times;</button>
                    </div>
                    
                    <div class="cici-body" id="cici-messages"></div>

                    <div id="cici-image-preview" style="display:none; padding: 10px; background: #f1f3f5; border-top: 1px solid #ddd; position: relative;">
                        <img id="cici-preview-img" style="max-height: 50px; border-radius: 5px;">
                        <button onclick="CiciAI.clearImage()" style="position: absolute; top: 5px; right: 10px; background: #ff4757; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer;">&times;</button>
                    </div>

                    <div class="cici-input-area">
                        <input type="file" id="cici-file-input" accept="image/*" style="display:none;" onchange="CiciAI.handleFileSelect(event)">
                        <button onclick="document.getElementById('cici-file-input').click()" class="cici-mic-btn" style="color: #666;"><i class="fas fa-paperclip"></i></button>
                        <button onclick="CiciAI.listen()" class="cici-mic-btn"><i class="fas fa-microphone"></i></button>
                        <input type="text" id="cici-input" placeholder="Digite ou anexe foto..." onkeypress="CiciAI.handleInput(event)">
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
            // Dispara a primeira mensagem com a flag isFirstMessage
            this.processText("", true, true);
            this.hasGreeted = true;
        }
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
        if(!silent && this.currentImageBase64) this.addMessage("📸 Imagem enviada.", 'user');
        
        this.showTyping();

        const ctx = { role: this.userRole, name: this.userName || 'Usuário', deviceInfo: this.deviceInfo };
        const payload = { text: text, userContext: ctx, image: this.currentImageBase64, isFirstMessage: isFirstMessage };

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
                const phone = zapMatch[1].replace(/\D/g, ''); 
                const msg = encodeURIComponent(zapMatch[2].trim());
                const zapLink = `https://wa.me/${phone}?text=${msg}`;
                
                finalReply = finalReply.replace(/\[ZAP:.*?:.*?\]/g, '').trim();
                finalReply += `
                    <div style="margin-top: 10px;">
                        <a href="${zapLink}" target="_blank" style="display:inline-block; background:#25D366; color:white; padding:8px 15px; border-radius:20px; text-decoration:none; font-weight:bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition:0.3s; width:100%; text-align:center; box-sizing: border-box;">
                            <i class="fab fa-whatsapp"></i> Enviar WhatsApp
                        </a>
                    </div>`;
            }

            this.addMessage(finalReply, 'cici');
            this.renderLanguageButtons(this.currentLang);

        } catch (error) {
            this.hideTyping();
            this.addMessage("Ops, tive um erro de conexão. 📡", 'cici');
        }
    },

    renderLanguageButtons: function(lang) {
        const msgs = document.getElementById('cici-messages');
        const oldBtns = document.querySelectorAll('.cici-buttons-container');
        oldBtns.forEach(el => el.remove());

        const btnContainer = document.createElement('div');
        btnContainer.className = 'cici-buttons-container'; 
        // Flexbox para garantir que fique bom no celular (quebra linha se precisar)
        btnContainer.style = "display:flex; gap:8px; padding:10px 0; flex-wrap:wrap; justify-content: flex-start; width: 100%;";

        const labels = {
            'pt-BR': ['📦 Rastrear Encomenda', '💰 Ver Saldo', '👨‍💻 Suporte'],
            'en-US': ['📦 Track Package', '💰 Check Balance', '👨‍💻 Support'],
            'fr-FR': ['📦 Suivre Colis', '💰 Voir Solde', '👨‍💻 Support'],
            'es-ES': ['📦 Rastrear Pedido', '💰 Ver Saldo', '👨‍💻 Soporte']
        };

        const currentLabels = labels[lang] || labels['pt-BR'];

        currentLabels.forEach(label => {
            const btn = document.createElement('button');
            btn.innerText = label;
            // Estilo responsivo (flex: 1 1 auto faz o botão crescer no celular)
            btn.style = "flex: 1 1 auto; background:#0a1931; color:white; border:none; padding:8px 12px; border-radius:15px; cursor:pointer; font-size:12px; transition: 0.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.2); white-space: nowrap;";
            
            btn.onmouseover = () => btn.style.background = "#1a3a6d";
            btn.onmouseout = () => btn.style.background = "#0a1931";
            
            btn.onclick = () => {
                btnContainer.remove(); 
                this.processText(label);
            };
            btnContainer.appendChild(btn);
        });

        msgs.appendChild(btnContainer);
        msgs.scrollTop = msgs.scrollHeight;
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
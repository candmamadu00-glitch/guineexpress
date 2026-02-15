/* ===========================================================
   CICÍ PRO MAX ULTRA - MULTILINGUAL EDITION
   Versão: 11.0 (Suporte Multi-idioma + Botões Contextuais)
   =========================================================== */

const CiciAI = {
    isOpen: false,
    userRole: 'visitor',
    userName: '',
    roleLabel: 'Visitante',
    deviceInfo: 'Computador',
    hasGreeted: false,
    currentLang: 'pt-BR', // Idioma padrão inicial
    
    // Avatar Premium
    avatarUrl: 'https://img.freepik.com/fotos-gratis/jovem-mulher-confiante-com-oculos_1098-20868.jpg?w=200',

    // ===============================================
    // MOTOR DE VOZ E AUDIÇÃO
    // ===============================================
    speak: function(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); 
        
        const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/\*/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        utterance.lang = this.currentLang;
        utterance.rate = 1.0; 
        utterance.pitch = 1.1; 
        
        const voices = window.speechSynthesis.getVoices();
        let voice = voices.find(v => v.lang === this.currentLang);
        
        if (!voice) {
            const langPrefix = this.currentLang.split('-')[0];
            voice = voices.find(v => v.lang.startsWith(langPrefix));
        }

        if (voice) utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
    },

    listen: function() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.addMessage("Seu navegador não suporta voz. 😢", "cici");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = this.currentLang;
        
        recognition.onstart = () => {
            const input = document.getElementById('cici-input');
            input.placeholder = "🎤 Ouvindo...";
            input.style.backgroundColor = "#fff3cd";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const input = document.getElementById('cici-input');
            input.value = transcript;
            input.style.backgroundColor = "#f1f3f5";
            this.handleSend(); 
        };

        recognition.start();
    },

    // ===============================================
    // INTERFACE E BOTÕES DE IDIOMA
    // ===============================================
    renderLanguageButtons: function(lang) {
        const msgs = document.getElementById('cici-messages');
        
        // Remove botões anteriores para não acumular
        const oldButtons = document.querySelectorAll('.cici-buttons-container');
        oldButtons.forEach(el => el.remove());

        const btnContainer = document.createElement('div');
        btnContainer.className = 'cici-buttons-container'; 
        btnContainer.style = "display:flex; gap:5px; padding:10px; flex-wrap:wrap; justify-content: flex-start;";

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
            btn.style = "background:#0a1931; color:white; border:none; padding:8px 12px; border-radius:15px; cursor:pointer; font-size:12px; transition: 0.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.2);";
            
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

    // ===============================================
    // LÓGICA DO SISTEMA
    // ===============================================
    init: function() {
        this.detectContext();
        this.renderWidget();
        
        setTimeout(() => {
            const badge = document.getElementById('cici-badge');
            if(badge) badge.classList.remove('hidden');
            window.speechSynthesis.getVoices();
        }, 1500);
    },

    detectContext: function() {
        const path = window.location.pathname;
        const ua = navigator.userAgent;
        this.deviceInfo = /android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : "Computador";

        if (path.includes('dashboard-admin')) { 
            this.userRole = 'admin'; this.roleLabel = 'Administrador'; 
        } else if (path.includes('dashboard-employee')) { 
            this.userRole = 'employee'; this.roleLabel = 'Colaborador'; 
        } else if (path.includes('dashboard-client')) { 
            this.userRole = 'client'; this.roleLabel = 'Cliente VIP';
        }

        const nameEl = document.getElementById('user-name-display');
        if (nameEl && nameEl.innerText !== '...') {
            this.userName = nameEl.innerText.trim();
        }
    },

    renderWidget: function() {
        if(document.getElementById('cici-widget')) return;
        const html = `
            <div id="cici-widget">
                <div id="cici-chat-window">
                    <div class="cici-header">
                        <div class="cici-info">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <div style="position:relative;">
                                    <div style="width:40px; height:40px; background:url('${this.avatarUrl}'); background-size:cover; border-radius:50%; border:2px solid #fff;"></div>
                                    <div style="width:12px; height:12px; background:#28a745; border-radius:50%; position:absolute; bottom:0; right:0; border:2px solid #fff;"></div>
                                </div>
                                <div>
                                    <h4 style="margin:0; font-size:15px; font-weight:700;">Cicí Pro</h4>
                                    <small style="color:rgba(255,255,255,0.8); font-size:11px;">Inteligência Guineexpress</small>
                                </div>
                            </div>
                        </div>
                        <button onclick="CiciAI.toggle()" style="background:none;border:none;color:white;cursor:pointer;font-size:24px;">&times;</button>
                    </div>
                    <div class="cici-body" id="cici-messages">
                        <div class="msg cici">Olá! Estou analisando seu painel... 🔍</div>
                    </div>
                    <div class="cici-input-area">
                        <button onclick="CiciAI.listen()" class="cici-mic-btn"><i class="fas fa-microphone"></i></button>
                        <input type="text" id="cici-input" placeholder="Pergunte qualquer coisa..." onkeypress="CiciAI.handleInput(event)">
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
            this.processText("Olá Cicí, analise meu painel, me cumprimente e pergunte se prefiro falar em outro idioma.", true);
            this.hasGreeted = true;
        }
    },

    processText: async function(text, silent = false) {
        if(!text) return;
        if(!silent) this.addMessage(text, 'user');
        this.showTyping();

        const ctx = { 
            role: this.userRole, 
            name: this.userName || 'Usuário', 
            roleLabel: this.roleLabel,
            deviceInfo: this.deviceInfo
        };

        try {
            const response = await fetch('/api/cici/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, userContext: ctx })
            });

            const data = await response.json();
            this.hideTyping();
            
            // Atualiza o idioma e a interface baseado na resposta da IA
            if (data.lang) this.currentLang = data.lang;

            this.addMessage(data.reply, 'cici');
            
            // Renderiza os botões sugeridos no idioma atual
            this.renderLanguageButtons(this.currentLang);

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
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-dots';
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
        msgs.appendChild(typingDiv);
        msgs.scrollTop = msgs.scrollHeight;
    },

    hideTyping: function() {
        const el = document.getElementById('typing-dots');
        if(el) el.remove();
    },

    handleInput: function(e) {
        if(e.key === 'Enter') this.handleSend();
    },

    handleSend: function() {
        const input = document.getElementById('cici-input');
        const txt = input.value.trim();
        if(!txt) return;
        input.value = '';
        this.processText(txt);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { CiciAI.init(); }, 1000);
});
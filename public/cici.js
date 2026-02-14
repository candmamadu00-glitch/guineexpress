/* ===========================================================
   CICÍ PRO MAX ULTRA - INTELIGÊNCIA ARTIFICIAL CONTEXTUAL
   Versão: 8.0 (Personalidade, Voz, PWA e Contexto Real)
   =========================================================== */

const CiciAI = {
    isOpen: false,
    userRole: 'visitor',
    userName: '',
    roleLabel: 'Visitante',
    hasGreeted: false,
    
    // Avatar Premium
    avatarUrl: 'https://img.freepik.com/fotos-gratis/jovem-mulher-confiante-com-oculos_1098-20868.jpg?w=200',

    // ===============================================
    // MOTOR DE VOZ E DETECÇÃO DE HARDWARE
    // ===============================================
    getDeviceInfo: function() {
        const ua = navigator.userAgent;
        if (/android/i.test(ua)) return "Android";
        if (/iPad|iPhone|iPod/.test(ua)) return "iPhone/iOS";
        return "Computador (Desktop)";
    },

    speak: function(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); 
        
        // Limpa marcações para a voz não ler "asterisco asterisco"
        const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/\*/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0; 
        
        const voices = window.speechSynthesis.getVoices();
        const ptVoice = voices.find(v => v.lang.includes('pt'));
        if (ptVoice) utterance.voice = ptVoice;
        
        window.speechSynthesis.speak(utterance);
    },

    listen: function() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.addMessage("Seu navegador não suporta voz. 😢", "cici");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.onstart = () => {
            document.getElementById('cici-input').placeholder = "🎤 Ouvindo...";
        };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            document.getElementById('cici-input').value = transcript;
            this.handleSend(); 
        };
        recognition.start();
    },

    // ===============================================
    // CORE DO SISTEMA
    // ===============================================
    init: function() {
        this.detectContext();
        this.renderWidget();
        
        setTimeout(() => {
            const badge = document.getElementById('cici-badge');
            if(badge) {
                badge.classList.remove('hidden');
                badge.classList.add('pulse-animation');
            }
        }, 1500);
    },

    detectContext: function() {
        const path = window.location.pathname;
        if (path.includes('dashboard-admin')) { this.userRole = 'admin'; this.roleLabel = 'Administrador'; } 
        else if (path.includes('dashboard-employee')) { this.userRole = 'employee'; this.roleLabel = 'Colaborador'; } 
        else if (path.includes('dashboard-client')) { 
            this.userRole = 'client'; 
            this.roleLabel = 'Cliente VIP';
            // Tenta pegar nome do elemento de boas-vindas do painel
            const nameEl = document.querySelector('.user-name');
            if(nameEl) this.userName = nameEl.innerText.split(' ')[0];
        } 
    },

    renderWidget: function() {
        if(document.getElementById('cici-widget')) return;

        const msgs = {
            'visitor': "Olá! ✈️ Sou a Cicí. Quer enviar algo para Guiné-Bissau?",
            'client': `Olá, ${this.userName || 'Cliente'}! 📦 Vim ver suas encomendas.`,
            'admin': "Painel Admin pronto. 🛡️ O que deseja monitorar?",
            'employee': "Trabalho em equipe! 🛠️ Como posso ajudar hoje?"
        };

        const html = `
            <div id="cici-widget">
                <div id="cici-chat-window">
                    <div class="cici-header">
                        <div class="cici-info">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="position:relative;">
                                    <div style="width:35px; height:35px; background:url('${this.avatarUrl}'); background-size:cover; border-radius:50%;"></div>
                                    <div style="width:10px; height:10px; background:#28a745; border-radius:50%; position:absolute; bottom:0; right:0; border:2px solid #fff;"></div>
                                </div>
                                <div><b style="font-size:14px;">Cicí</b><br><small>Online</small></div>
                            </div>
                        </div>
                        <button onclick="CiciAI.toggle()" style="background:none;border:none;color:white;font-size:24px;cursor:pointer;">&times;</button>
                    </div>
                    <div class="cici-body" id="cici-messages">
                        <div class="msg cici">${msgs[this.userRole] || msgs['visitor']}</div>
                        <div class="cici-options">
                            <button class="cici-btn-opt" onclick="CiciAI.processText('Como baixar o App?')">📲 Baixar App</button>
                            <button class="cici-btn-opt" onclick="CiciAI.processText('Rastrear Encomenda')">📦 Rastrear</button>
                        </div>
                    </div>
                    <div class="cici-input-area">
                        <button onclick="CiciAI.listen()" class="cici-mic-btn"><i class="fas fa-microphone"></i></button>
                        <input type="text" id="cici-input" placeholder="Pergunte algo..." onkeypress="CiciAI.handleInput(event)">
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
        if(this.isOpen && !this.hasGreeted) {
            this.speak(document.querySelector('.msg.cici').innerText);
            this.hasGreeted = true;
        }
    },

    processText: async function(text) {
        if(!text) return;
        this.addMessage(text, 'user');
        this.showTyping();

        const ctx = { 
            role: this.userRole, 
            name: this.userName || 'Visitante', 
            roleLabel: this.roleLabel,
            deviceInfo: this.getDeviceInfo()
        };

        try {
            const response = await fetch('/api/cici/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, userContext: ctx })
            });
            const data = await response.json();
            this.hideTyping();
            this.addMessage(data.reply, 'cici');
            this.speak(data.reply);
        } catch (error) {
            this.hideTyping();
            this.addMessage("Estou com instabilidade no satélite. 🛰️", 'cici');
        }
    },

    addMessage: function(text, sender) {
        const msgs = document.getElementById('cici-messages');
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        // Formata links e negritos
        let formatted = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:cyan;">$1</a>');
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        div.innerHTML = formatted;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
    },

    showTyping: function() {
        const msgs = document.getElementById('cici-messages');
        msgs.insertAdjacentHTML('beforeend', `<div id="typing-dots" class="msg cici">...</div>`);
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
        if(txt) { input.value = ''; this.processText(txt); }
    }
};

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => CiciAI.init(), 1000); });
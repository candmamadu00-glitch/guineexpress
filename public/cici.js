/* ===========================================================
   CICÍ PRO MAX ULTRA - INTELIGÊNCIA ARTIFICIAL CONTEXTUAL
   Versão: 8.0 (Frontend Inteligente + API Google Gemini)
   =========================================================== */

const CiciAI = {
    isOpen: false,
    userRole: 'visitor',
    userName: '',
    hasGreeted: false,
    
    // Avatar Premium
    avatarUrl: 'https://img.freepik.com/fotos-gratis/jovem-mulher-confiante-com-oculos_1098-20868.jpg?w=200',

    // ===============================================
    // MOTOR DE VOZ E AUDIÇÃO
    // ===============================================
    speak: function(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); 
        
        // Limpa o texto de HTML e marcações do Gemini (**negrito**)
        const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/\*/g, '');
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0; 
        utterance.pitch = 1.1; 
        
        const voices = window.speechSynthesis.getVoices();
        const ptVoice = voices.find(v => v.lang.includes('pt') && (v.name.includes('Google') || v.name.includes('Luciana') || v.name.includes('Maria')));
        if (ptVoice) utterance.voice = ptVoice;
        
        window.speechSynthesis.speak(utterance);
    },

    listen: function() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.addMessage("Desculpe, seu navegador não suporta reconhecimento de voz. 😢", "cici");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = false;

        recognition.onstart = () => {
            const input = document.getElementById('cici-input');
            input.placeholder = "🎤 Ouvindo você...";
            input.style.backgroundColor = "#fff3cd"; // Alerta visual de gravação
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const input = document.getElementById('cici-input');
            input.value = transcript;
            input.style.backgroundColor = "#f1f3f5";
            this.handleSend(); 
        };

        recognition.onerror = () => {
            const input = document.getElementById('cici-input');
            input.placeholder = "Digite sua dúvida...";
            input.style.backgroundColor = "#f1f3f5";
        };

        recognition.start();
    },

    // ===============================================
    // LÓGICA DO SISTEMA (ENGINE)
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
            if (typeof currentUser !== 'undefined' && currentUser && currentUser.name) {
                this.userName = currentUser.name.split(' ')[0];
            }
        } 
        else { this.userRole = 'visitor'; this.roleLabel = 'Visitante'; }
    },

    renderWidget: function() {
        if(document.getElementById('cici-widget')) return;

        const msgs = {
            'visitor': "Olá! ✈️ Quer enviar encomendas para Guiné-Bissau?",
            'client': `Olá, ${this.userName || 'Cliente'}! 📦 Vim te ajudar com suas encomendas.`,
            'admin': "Painel Admin. 🛡️ O sistema está rodando 100%.",
            'employee': "Pronto para o trabalho? 🛠️ O que vamos fazer hoje?"
        };

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
                                    <h4 style="margin:0; font-size:16px; font-weight:700;">Cicí</h4>
                                    <small style="color:rgba(255,255,255,0.8); font-size:12px;">Assistente Virtual</small>
                                </div>
                            </div>
                        </div>
                        <button onclick="CiciAI.toggle()" style="background:none;border:none;color:white;cursor:pointer;font-size:28px; line-height:1;">&times;</button>
                    </div>
                    
                    <div class="cici-body" id="cici-messages">
                        <div class="msg cici">
                            ${msgs[this.userRole] || msgs['visitor']}
                        </div>
                        ${this.getQuickOptionsHTML()}
                    </div>

                    <div class="cici-input-area">
                        <button onclick="CiciAI.listen()" class="cici-mic-btn" title="Falar com Cicí"><i class="fas fa-microphone"></i></button>
                        <input type="text" id="cici-input" placeholder="Digite sua dúvida..." onkeypress="CiciAI.handleInput(event)" autocomplete="off">
                        <button onclick="CiciAI.handleSend()" class="cici-send-btn"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
                
                <div id="cici-avatar" onclick="CiciAI.toggle()" style="background-image: url('${this.avatarUrl}');">
                    <div id="cici-badge" class="cici-badge hidden">1</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    getQuickOptionsHTML: function() {
        let opts = [];
        if(this.userRole === 'visitor') opts = ['Fazer Login', 'Criar Conta', 'Preços'];
        if(this.userRole === 'client') opts = ['Minhas Encomendas', 'Financeiro'];
        if(this.userRole === 'employee') opts = ['Receber Encomenda', 'Buscar Cliente'];
        if(this.userRole === 'admin') opts = ['Faturamento', 'Ver Equipe'];

        let html = `<div class="cici-options">`;
        opts.forEach(opt => {
            html += `<button class="cici-btn-opt" onclick="CiciAI.processText('${opt}')">${opt}</button>`;
        });
        html += `</div>`;
        return html;
    },

    toggle: function() {
        const win = document.getElementById('cici-chat-window');
        const badge = document.getElementById('cici-badge');
        this.isOpen = !this.isOpen;
        
        if (this.isOpen) {
            win.classList.add('open');
            if(badge) badge.classList.add('hidden');
            setTimeout(() => {
                const input = document.getElementById('cici-input');
                if(input) input.focus();
                
                if(!this.hasGreeted) {
                    const firstMsg = document.querySelector('.msg.cici');
                    if(firstMsg) this.speak(firstMsg.innerText);
                    this.hasGreeted = true;
                }
            }, 300);
        } else {
            win.classList.remove('open');
        }
    },

    // ===============================================
    // COMUNICAÇÃO COM O SERVIDOR NODE.JS (O CÉREBRO)
    // ===============================================
    processText: async function(text) {
        if(!text) return;
        
        // 1. Escreve o que o usuário disse
        this.addMessage(text, 'user');
        this.showTyping();

        // 2. Coleta os dados de quem está falando
        const ctx = { 
            role: this.userRole, 
            name: this.userName, 
            roleLabel: this.roleLabel 
        };

        try {
            // ⚠️ ATENÇÃO: Quando for para o ar, troque esta URL pela URL real do seu Render (ex: https://seu-app.onrender.com/api/cici/chat)
            const apiUrl = '/api/cici/chat'; 
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, userContext: ctx })
            });

            if (!response.ok) throw new Error("Erro de conexão");

            const data = await response.json();
            
            this.hideTyping();
            
            // Se o servidor mandar uma ação para mudar de tela (opcional)
            if (data.action && typeof showSection === 'function') {
                showSection(data.action);
            }

            // A Cicí responde e fala!
            this.addMessage(data.reply, 'cici');

        } catch (error) {
            console.error("Erro na API da Cicí:", error);
            this.hideTyping();
            this.addMessage("Meus servidores estão passando por uma turbulência agora ✈️. Tente novamente em alguns segundos!", 'cici');
        }
    },

    addMessage: function(text, sender) {
        const msgs = document.getElementById('cici-messages');
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        
        // Formata links clicáveis
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let formattedText = text.replace(urlRegex, '<a href="$1" target="_blank" style="color:inherit;text-decoration:underline;font-weight:bold;">$1</a>');
        
        // Formata negritos do markdown do Gemini (**texto**) para HTML (<b>texto</b>)
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        
        div.innerHTML = formattedText;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;

        if(sender === 'cici') {
            this.speak(text);
        }
    },

    showTyping: function() {
        const msgs = document.getElementById('cici-messages');
        if(document.getElementById('typing-dots')) return;
        msgs.innerHTML += `<div id="typing-dots" class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
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
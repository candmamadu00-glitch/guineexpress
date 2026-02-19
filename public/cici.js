/* ===========================================================
   CICÍ PRO MAX ULTRA - VERSÃO 18.0 (GUINEEXPRESS)
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
    languageSet: false,

    // 🌟 Voz Masculina Humana e Expressiva (Suporte Poliglota)
    speak: function(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); 
        
        const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/\*/g, '').replace(/\[.*?\]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
        
        const langPrefix = this.currentLang.split('-')[0];

        // Busca voz masculina específica do idioma ou fallback
        let targetVoice = voices.find(v => 
            v.lang.startsWith(langPrefix) && 
            (v.name.includes('Male') || v.name.includes('Masc') || v.name.includes('Daniel') || v.name.includes('David'))
        ) || voices.find(v => v.lang.startsWith(langPrefix));

        if (targetVoice) utterance.voice = targetVoice;
        utterance.pitch = 0.8; 
        utterance.rate = 1.0;  
        utterance.lang = this.currentLang;
        
        window.speechSynthesis.speak(utterance);
    },

    // 🌟 Definição de Idioma e Saudação Inteligente
    setLang: function(code, name) {
        this.currentLang = code;
        this.languageSet = true;

        let nomeUsuario = this.userName ? `, <b>${this.userName}</b>` : "";
        let saudacao = "";
        
        const templates = {
            'pt-BR': `Excelente${nomeUsuario}! Vejo que você está acessando a Guineexpress através de um <b>${this.deviceInfo}</b>. Como posso ajudar sua logística hoje?`,
            'en-US': `Excellent${nomeUsuario}! I see you're accessing Guineexpress from a <b>${this.deviceInfo}</b>. How can I help today?`,
            'fr-FR': `Super${nomeUsuario}! Je vois que vous accédez depuis un <b>${this.deviceInfo}</b>. Comment puis-je vous aider?`
        };

        saudacao = templates[code] || `Ok! I switched to ${name}. I see you're on a ${this.deviceInfo}. Let's chat!`;
        saudacao += `<br><br>💡 <i>Dica:</i> Deseja instalar nosso App?<br>
        <button onclick="CiciAI.showInstallGuide()" style="margin-top:10px; background:#f39c12; color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold; width: 100%;">📥 Instalar App no ${this.deviceInfo.split(' ')[0]}</button>`;

        this.addMessage(saudacao, 'cici');
        
        const langContainer = document.querySelector('.cici-lang-btn')?.parentElement;
        if(langContainer) langContainer.remove();

        this.checkNetwork();
    },

    // 🌟 Sensor de Conexão (Inteligência de Dados)
    checkNetwork: function() {
        if (navigator.connection) {
            const conn = navigator.connection.effectiveType; 
            const speed = navigator.connection.downlink; 
            if (conn === '2g' || conn === '3g' || speed < 1.5) {
                setTimeout(() => {
                    this.addMessage(`⚠️ Conexão lenta (${conn}). Serei mais direta nas respostas para poupar seus dados!`, 'cici');
                }, 2000);
            }
        }
    },

    // 🌟 Tutorial de Instalação (PWA Dinâmico)
    showInstallGuide: function() {
        const isMobile = this.deviceInfo.includes("Telemóvel");
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

        if (isMobile) {
            if (isIOS) {
                this.addMessage("<b>📱 iPhone:</b> Toque em <b>Compartilhar</b> (seta para cima) e depois em <b>'Adicionar à Tela de Início'</b>.", 'cici');
            } else {
                this.addMessage("<b>🤖 Android:</b> Toque nos <b>3 pontos</b> e selecione <b>'Instalar Aplicativo'</b>.", 'cici');
            }
        } else {
            this.addMessage("<b>💻 PC/Notebook:</b> Clique no ícone de <b>instalação (⊕)</b> na barra de endereços do navegador.", 'cici');
        }
    },

    detectContext: function() {
        const path = window.location.pathname;
        const ua = navigator.userAgent;
        
        if (/tablet|ipad|playbook|silk/i.test(ua)) this.deviceInfo = "Tablet";
        else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Opera Mini/i.test(ua)) this.deviceInfo = "Telemóvel (Smartphone)";
        else this.deviceInfo = "Computador (Notebook/Desktop)";

        if (path.includes('admin')) { this.currentPage = 'Painel Admin'; this.userRole = 'admin'; }
        else if (path.includes('client')) { this.currentPage = 'Painel Cliente'; this.userRole = 'client'; }
        else { this.currentPage = 'Portal Principal'; }
        
        const nameEl = document.getElementById('user-name-display');
        if (nameEl && nameEl.innerText !== '...') this.userName = nameEl.innerText.trim();
        else if (window.currentUser && window.currentUser.name) this.userName = window.currentUser.name; 
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
                                <div><h4 style="margin:0; font-size:15px; font-weight:700;">Cicí Pro 18.0</h4><small>Logística Inteligente</small></div>
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
        
        if (this.isOpen && !this.hasGreeted) {
            const saudacao = `Olá! Sou o assistente virtual da <b>Guineexpress</b>. <br><br>Qual idioma prefere?  Which language?`;
            this.addMessage(saudacao, 'cici');
            
            const botoes = `
                <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                    <button onclick="CiciAI.setLang('pt-BR', 'Português')" class="cici-lang-btn" style="background:#2ecc71; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">🇵🇹 Português</button>
                    <button onclick="CiciAI.setLang('en-US', 'English')" class="cici-lang-btn" style="background:#3498db; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">🇺🇸 English</button>
                    <button onclick="CiciAI.setLang('fr-FR', 'Français')" class="cici-lang-btn" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">🇫🇷 Français</button>
                </div>
            `;
            document.getElementById('cici-messages').insertAdjacentHTML('beforeend', botoes);
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
        this.showTyping();

        try {
            const response = await fetch('/api/cici/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text, 
                    userContext: { role: this.userRole, name: this.userName, deviceInfo: this.deviceInfo, currentPage: this.currentPage },
                    image: this.currentImageBase64,
                    isFirstMessage,
                    lang: this.currentLang 
                })
            });
            const data = await response.json();
            this.hideTyping();
            
            if(data.lang) this.currentLang = data.lang;
            let reply = data.reply;

            // Execução de Ações enviadas pelo Back-end
            if(reply.includes('[ACTION:install]')) { this.showInstallGuide(); reply = reply.replace(/\[ACTION:install\]/g, ''); }
            if(reply.includes('[ACTION:push]')) { this.enableNotifications(); reply = reply.replace(/\[ACTION:push\]/g, ''); }
            
            const redMatch = reply.match(/\[ACTION:redirect:(.*?)\]/);
            if(redMatch) {
                setTimeout(() => window.location.href = redMatch[1], 2500);
                reply = reply.replace(/\[ACTION:redirect:.*?\]/g, '<br>🔄 Redirecionando...');
            }

            this.addMessage(reply, 'cici');
            this.clearImage(); 
        } catch (e) { 
            this.hideTyping(); 
            this.addMessage("Ops, tive um problema na conexão.", 'cici'); 
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
    
    listen: function() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) return this.addMessage("Reconhecimento de voz não suportado.", 'cici');
        const recognition = new SpeechRec();
        recognition.lang = this.currentLang;
        recognition.onstart = () => document.getElementById('cici-input').placeholder = "🎤 Ouvindo..."; 
        recognition.onresult = (e) => {
            document.getElementById('cici-input').value = e.results[0][0].transcript;
            this.handleSend(); 
        };
        recognition.start();
    },
// Adicione estas funções dentro do objeto CiciAI

    // 📄 Função para selecionar e processar documentos
    handleDocumentSelect: function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            // Armazena o documento como base64 para o Gemini analisar
            this.currentImageBase64 = e.target.result;
            
            // Feedback visual para o usuário
            this.addMessage(`📄 <b>Documento recebido:</b> ${file.name}<br>Estou analisando o conteúdo, só um momento...`, 'user');
            
            // Dispara a análise automática
            this.processText(`Analise este documento chamado ${file.name} e extraia as informações principais para mim.`);
        };
        
        // Se for imagem ou PDF (O Gemini Vision lida bem com imagens de documentos)
        reader.readAsDataURL(file);
    },
    handleInput: function(e) { if(e.key === 'Enter') this.handleSend(); },
    handleSend: function() {
        const input = document.getElementById('cici-input');
        if(input.value.trim() || this.currentImageBase64) { 
            this.processText(input.value.trim()); 
            input.value = ''; 
        }
    },

    init: function() {
        this.detectContext();
        this.renderWidget();
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        setTimeout(() => {
            const badge = document.getElementById('cici-badge');
            if(badge) badge.classList.remove('hidden');
        }, 1500);
    }
};

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => CiciAI.init(), 1000); });
/* ===========================================================
   CICÍ PRO MAX ULTRA - VERSÃO 18.0 (GUINEEXPRESS)
   =========================================================== */

const CiciAI = {
    isOpen: false,
    userRole: 'visitor',
    userName: '',
    // 👇 A PÍLULA DA MEMÓRIA: Esse array vai guardar a conversa!
    chatHistory: [], 
    isListening: false,
    recognition: null,
    silenceTimer: null,
    // 👇 ADICIONE ESTAS TRÊS LINHAS:
    isListening: false,
    recognition: null,
    silenceTimer: null,
    deviceInfo: 'Dispositivo Desconhecido',
    currentPage: 'Página Desconhecida',
    hasGreeted: false,
    currentLang: 'pt-BR', 
    currentImageBase64: null,
    isDragging: false,
    xOffset: 0,
    yOffset: 0,
    // 👇 Link atualizado com o avatar da mulher negra de corpo inteiro
    avatarUrl: '/cici.png', 
    languageSet: false,

    // 🌟 Voz Feminina Humana e Expressiva (Suporte Poliglota)
    speak: function(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); 
        
        const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/\*/g, '').replace(/\[.*?\]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
        
        const langPrefix = this.currentLang.split('-')[0];

        // Busca voz feminina específica do idioma ou fallback
        let targetVoice = voices.find(v => 
            v.lang.startsWith(langPrefix) && 
            (v.name.includes('Female') || v.name.includes('Fem') || v.name.includes('Maria') || v.name.includes('Zira') || v.name.includes('Google português do Brasil'))
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
        
        // 👇 Textos atualizados com o aceno de mão e sorriso para todos os idiomas
        const templates = {
            'pt-BR': `Olá${nomeUsuario}! 👋🏾 Dou-lhe as boas-vindas com um grande sorriso e um aceno de mão!<br><br>Vejo que você está acessando a Guineexpress através de um <b>${this.deviceInfo}</b>. Como posso ajudar sua logística hoje?`,
            'en-US': `Hello${nomeUsuario}! 👋🏾 I welcome you with a big smile and a wave!<br><br>I see you're accessing Guineexpress from a <b>${this.deviceInfo}</b>. How can I help today?`,
            'fr-FR': `Bonjour${nomeUsuario}! 👋🏾 Je vous accueille avec un grand sourire et un signe de la main !<br><br>Je vois que vous accédez depuis un <b>${this.deviceInfo}</b>. Comment puis-je vous aider?`
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
     // 🌟 NOVA FUNÇÃO: Arrastável e com Vida Própria (Movimento Autônomo)
    makeDraggableAndAlive: function() {
        const avatar = document.getElementById('cici-avatar');
        if (!avatar) return;

        let currentX, currentY, initialX, initialY;

        // --- LÓGICA DE ARRASTAR (MANUAL) ---
        const dragStart = (e) => {
            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - this.xOffset;
                initialY = e.touches[0].clientY - this.yOffset;
            } else {
                initialX = e.clientX - this.xOffset;
                initialY = e.clientY - this.yOffset;
            }
            if (e.target === avatar || avatar.contains(e.target)) {
                this.isDragging = true;
                avatar.style.transition = 'none'; // Tira o movimento suave para não travar o mouse
            }
        };

        const dragEnd = () => {
            if (!this.isDragging) return;
            initialX = currentX;
            initialY = currentY;
            this.isDragging = false;
        };

        const drag = (e) => {
            if (this.isDragging) {
                e.preventDefault();
                if (e.type === "touchmove") {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }
                this.xOffset = currentX;
                this.yOffset = currentY;
                avatar.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        };

        avatar.addEventListener("touchstart", dragStart, { passive: false });
        avatar.addEventListener("mousedown", dragStart, false);
        document.addEventListener("touchend", dragEnd, false);
        document.addEventListener("mouseup", dragEnd, false);
        document.addEventListener("touchmove", drag, { passive: false });
        document.addEventListener("mousemove", drag, false);

        // --- 🌟 A MÁGICA: MOVIMENTO INDEPENDENTE (COM LIMITES CORRIGIDOS) ---
        setInterval(() => {
            // Só passeia sozinha se o chat estiver FECHADO e ninguém estiver arrastando ela
            if (!this.isOpen && !this.isDragging) {
                // Tamanho atual da Cicí + margem de segurança de 40px para não encostar na borda
                const ciciWidth = 80; 
                const ciciHeight = 160; 

                // Calcula os limites da tela com precisão
                const maxEsquerda = -(window.innerWidth - ciciWidth - 40); 
                const maxCima = -(window.innerHeight - ciciHeight - 40);

                // Sorteia um novo lugar garantindo que não passe do limite
                // Como ela começa no canto direito inferior, o movimento para esquerda e cima é negativo
                const randomX = Math.min(0, Math.max(maxEsquerda, Math.floor(Math.random() * maxEsquerda)));
                const randomY = Math.min(0, Math.max(maxCima, Math.floor(Math.random() * maxCima)));

                this.xOffset = randomX;
                this.yOffset = randomY;

                // Aplica uma transição bem suave de 6 segundos para ela "flutuar" até lá
                avatar.style.transition = 'transform 6s ease-in-out';
                avatar.style.transform = `translate3d(${this.xOffset}px, ${this.yOffset}px, 0)`;
           }
        }, 30000); // A cada 8 segundos ela decide dar um passeio
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
     // 🌟 Radar da Cicí (Procura novos pagamentos a cada 10s)
    startRadarAdmin: function() {
        // Só liga o radar se quem estiver logado for o admin
        if (this.userRole !== 'admin') return;

        setInterval(async () => {
            try {
                const response = await fetch('/api/cici/avisos');
                const avisos = await response.json();
                
                if (avisos && avisos.length > 0) {
                    // Se tiver aviso, a Cicí abre a janela sozinha (se estiver fechada)
                    if (!this.isOpen) this.toggle();
                    
                    // Fala todos os avisos acumulados
                    avisos.forEach(aviso => {
                        this.addMessage(aviso, 'cici');
                    });
                }
            } catch (e) {
                // Se der erro de rede, ela apenas continua tentando em silêncio
            }
        }, 10000); // 10000 ms = 10 segundos
    },
    renderWidget: function() {
        if(document.getElementById('cici-widget')) return;
        const html = `
            <div id="cici-widget">
                <div id="cici-chat-window">
                    <div class="cici-header">
                        <div class="cici-info">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <div style="width:40px; height:40px; background:url('${this.avatarUrl}') top center/cover; border-radius:50%; border:2px solid #fff;"></div>
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
                <div id="cici-avatar" onclick="CiciAI.toggle()" style="
                    background-image: url('${this.avatarUrl}');
                    background-size: contain;
                    background-repeat: no-repeat;
                    background-position: bottom center;
                    background-color: transparent !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    width: 80px !important;
                    height: 160px !important;
                    border: none !important;
                ">
                    <div id="cici-badge" class="cici-badge hidden" style="top: 10px; right: 10px;">1</div>
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
                    // 👇 ENVIAMOS A MEMÓRIA PARA O SERVIDOR!
                    history: this.chatHistory, 
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

            // 👇 GUARDAMOS A CONVERSA NO CADERNINHO (Max 15 mensagens para não pesar)
            if (text) {
                this.chatHistory.push({ role: "user", parts: [{ text: text }] });
                this.chatHistory.push({ role: "model", parts: [{ text: reply }] });
                if (this.chatHistory.length > 15) this.chatHistory = this.chatHistory.slice(-15);
            }

            // ====================================================
            // ⚡ MOTOR UNIVERSAL DE AÇÕES DA CICÍ
            // ====================================================
            const actionRegex = /\[ACTION:([a-zA-Z0-9_]+)(?::(.*?))?\]/g;
            let match;
            
            while ((match = actionRegex.exec(reply)) !== null) {
                const comando = match[1];
                const valor = match[2] ? match[2].trim() : null;

                setTimeout(() => {
                    switch(comando) {
                        case 'install': this.showInstallGuide(); break;
                        case 'push': if(typeof enableNotifications === 'function') enableNotifications(); break;
                        case 'redirect': window.location.href = valor; break;
                        case 'print': 
                            // A Cicí vai mandar "123:2" (Código 123, 2 etiquetas)
                            let partes = valor.split(':');
                            let codigo = partes[0];
                            let qtd = partes.length > 1 ? parseInt(partes[1]) : 1;
                            
                            if(typeof window.imprimirEtiquetaPelaCici === 'function') {
                                window.imprimirEtiquetaPelaCici(codigo, qtd);
                            }
                            break;
                        
                        case 'nav': 
                            const tab = document.getElementById(valor) || document.querySelector(`[onclick*="${valor}"]`);
                            if(tab) tab.click();
                            break;

                        case 'search':
                            const inputBusca = document.getElementById('search-input') || document.querySelector('input[type="search"]');
                            if(inputBusca) { 
                                inputBusca.value = valor; 
                                inputBusca.dispatchEvent(new Event('input')); 
                            }
                            break;

                        case 'new_record':
                            const btnNovo = document.getElementById('btn-new-invoice') || 
                                            document.getElementById('btn-add-client') || 
                                            document.querySelector('button[onclick*="showModal"]');
                            if(btnNovo) btnNovo.click();
                            break;

                        case 'scroll':
                            if(valor === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                            if(valor === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
                            break;

                        case 'logout':
                            window.location.href = '/logout';
                            break;
                    }
                }, 500); 
            }

            reply = reply.replace(/\[ACTION:[a-zA-Z0-9_]+(?::.*?)?\]/g, '').trim();

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
        if (!SpeechRec) return this.addMessage("Reconhecimento de voz não suportado neste navegador.", 'cici');

        // Se já estiver gravando, o botão funciona como um "Desligar Microfone"
        if (this.isListening) {
            if(this.recognition) this.recognition.stop();
            return;
        }

        this.recognition = new SpeechRec();
        this.recognition.lang = this.currentLang;
        this.recognition.continuous = true; // Permite pausas longas sem cortar
        this.recognition.interimResults = true; // Pega o texto enquanto a pessoa ainda está falando

        const inputEl = document.getElementById('cici-input');
        const micBtn = document.querySelector('.cici-mic-btn .fa-microphone'); 

        this.recognition.onstart = () => {
            this.isListening = true;
            inputEl.placeholder = "🎤 Ouvindo... pode falar.";
            if(micBtn) micBtn.style.color = "#ff4757"; // Deixa o microfone vermelho para mostrar que tá gravando
            
            // Faz a Cicí calar a boca se ela estiver falando, para ela poder te ouvir
            window.speechSynthesis.cancel(); 
        };

        this.recognition.onresult = (e) => {
            let partialTranscript = '';
            let finalTranscript = '';

            for (let i = e.resultIndex; i < e.results.length; ++i) {
                if (e.results[i].isFinal) {
                    finalTranscript += e.results[i][0].transcript;
                } else {
                    partialTranscript += e.results[i][0].transcript;
                }
            }

            // Vai mostrando no input o que ela está entendendo
            inputEl.value = finalTranscript || partialTranscript;

            // ⏱️ FREIO DE ANSIEDADE: Toda vez que você fala uma palavra, o relógio zera
            clearTimeout(this.silenceTimer);
            
            // Se você ficar 2.5 segundos em silêncio, ela entende que você terminou a frase e envia
            this.silenceTimer = setTimeout(() => {
                this.recognition.stop(); 
            }, 2500); 
        };

        this.recognition.onend = () => {
            this.isListening = false;
            inputEl.placeholder = "Diga oi para a Cicí...";
            if(micBtn) micBtn.style.color = ""; // Volta a cor do microfone ao normal
            
            // Só envia a mensagem se tiver algo escrito
            if(inputEl.value.trim() !== '') {
                // 👇 Chama a função que envia a mensagem para o servidor!
                this.handleSend(); 
            }
        };

        this.recognition.onerror = (e) => {
            this.isListening = false;
            if(micBtn) micBtn.style.color = "";
            inputEl.placeholder = "Diga oi para a Cicí...";
        };

        this.recognition.start();
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
        
        // Chamada para ativar o movimento
        setTimeout(() => this.makeDraggableAndAlive(), 500);

        // LIGANDO O RADAR DO ADMIN 📡
        this.startRadarAdmin();

        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        setTimeout(() => {
            const badge = document.getElementById('cici-badge');
            if(badge) badge.classList.remove('hidden');
        }, 1500);
    }
    };

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => CiciAI.init(), 1000); });
/* ===========================================================
   CICÍ PRO MAX ULTRA - VERSÃO 16.0 (POLIGLOTA & AUTOMAÇÃO)
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

    // 🌟 NOVA HABILIDADE: Voz Poliglota Dinâmica
    speak: function(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); 
        
        const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/\*/g, '').replace(/\[.*?\]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // Tenta encontrar a melhor voz disponível para o idioma atual
        const voices = window.speechSynthesis.getVoices();
        const bestVoice = voices.find(v => v.lang.startsWith(this.currentLang.split('-')[0]));
        if (bestVoice) utterance.voice = bestVoice;
        
        utterance.lang = this.currentLang;
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    },

    listen: function() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const recognition = new SpeechRecognition();
        recognition.lang = this.currentLang;
        recognition.onstart = () => { document.getElementById('cici-input').placeholder = "🎤 Ouvindo em " + this.currentLang + "..."; };
        recognition.onresult = (event) => {
            document.getElementById('cici-input').value = event.results[0][0].transcript;
            this.handleSend(); 
        };
        recognition.start();
    },

    init: function() {
        this.detectContext();
        this.renderWidget();
        // Carrega vozes para o Chrome/Safari
        window.speechSynthesis.getVoices();
        setTimeout(() => {
            const badge = document.getElementById('cici-badge');
            if(badge) badge.classList.remove('hidden');
        }, 1500);
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
                                <div style="width:40px; height:40px; background:url('${this.avatarUrl}') center/cover; border-radius:50%; border:2px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.2);"></div>
                                <div><h4 style="margin:0; font-size:15px; font-weight:700;">Cicí Pro 16.0</h4><small>Logística Inteligente</small></div>
                            </div>
                        </div>
                        <button onclick="CiciAI.toggle()" style="background:none;border:none;color:white;cursor:pointer;font-size:24px;">&times;</button>
                    </div>
                    <div class="cici-body" id="cici-messages"></div>
                    <div id="cici-image-preview" style="display:none; padding: 10px; background: #f1f3f5; border-top: 1px solid #ddd; position: relative;">
                        <img id="cici-preview-img" style="max-height: 60px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <button onclick="CiciAI.clearImage()" style="position: absolute; top: 5px; right: 10px; background: #ff4757; color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer;">&times;</button>
                    </div>
                    <div class="cici-input-area">
                        <input type="file" id="cici-file-input" accept="image/*" style="display:none;" onchange="CiciAI.handleFileSelect(event)">
                        <button onclick="document.getElementById('cici-file-input').click()" class="cici-mic-btn" title="Anexar Foto"><i class="fas fa-camera"></i></button>
                        <button onclick="CiciAI.listen()" class="cici-mic-btn" title="Falar"><i class="fas fa-microphone"></i></button>
                        <input type="text" id="cici-input" placeholder="Pergunte em qualquer idioma..." onkeypress="CiciAI.handleInput(event)">
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
        if(!silent && this.currentImageBase64) this.addMessage("📸 Analisando dados da imagem...", 'user');
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
            
            // 🌟 Atualiza o idioma atual para a voz funcionar
            if(data.lang) this.currentLang = data.lang;
            
            let finalReply = data.reply;

            // --- PROCESSADOR DE AÇÕES AVANÇADO ---
            
            // 1. Redirecionamento
            const redMatch = finalReply.match(/\[ACTION:redirect:(.*?)\]/);
            if(redMatch) {
                setTimeout(() => window.location.href = redMatch[1], 2500);
                finalReply = finalReply.replace(/\[ACTION:redirect:.*?\]/g, '<br><b>🔄 Redirecionando...</b>');
            }

            // 2. Preenchimento Automático (Magia para Etiquetas)
            const fillMatches = [...finalReply.matchAll(/\[ACTION:fillForm:(.*?):(.*?)\]/g)];
            fillMatches.forEach(match => {
                const el = document.getElementById(match[1]);
                if(el) { 
                    el.value = match[2]; 
                    el.style.backgroundColor = "#e8f8f5";
                    el.style.border = "2px solid #2ecc71"; 
                }
            });
            finalReply = finalReply.replace(/\[ACTION:fillForm:.*?:.*?\]/g, '');

            // 3. Destaque Visual (Ajuda a achar botões)
            const highMatch = finalReply.match(/\[ACTION:highlight:(.*?)\]/);
            if(highMatch) {
                const el = document.getElementById(highMatch[1]);
                if(el) { 
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('cici-highlight-pulse');
                    setTimeout(() => el.classList.remove('cici-highlight-pulse'), 6000);
                }
                finalReply = finalReply.replace(/\[ACTION:highlight:.*?\]/g, '');
            }

            // 4. WhatsApp
            const zapMatch = finalReply.match(/\[ZAP:(.*?):(.*?)\]/);
            if(zapMatch) {
                const link = `https://wa.me/${zapMatch[1].replace(/\D/g,'')}?text=${encodeURIComponent(zapMatch[2])}`;
                finalReply = finalReply.replace(/\[ZAP:.*?:.*?\]/g, '') + 
                `<br><br><a href="${link}" target="_blank" style="background:#25D366; color:white; padding:12px; border-radius:8px; text-decoration:none; display:block; text-align:center; font-weight:bold;"><i class="fab fa-whatsapp"></i> Chamar no WhatsApp</a>`;
            }

            this.addMessage(finalReply, 'cici');
        } catch (e) { 
            this.hideTyping(); 
            this.addMessage("Ops, perdi o sinal. Pode repetir?", 'cici'); 
        }
    },

    addMessage: function(text, sender) {
        const msgs = document.getElementById('cici-messages');
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        formatted = formatted.replace(/\n/g, '<br>');
        
        div.innerHTML = formatted;
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
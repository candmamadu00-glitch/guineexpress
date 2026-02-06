/* ===========================================================
   CICÍ PRO MAX ULTRA - INTELIGÊNCIA ARTIFICIAL CONTEXTUAL
   Versão: 6.0 (Leitura de DOM + NLP Básico)
   =========================================================== */

const CiciAI = {
    isOpen: false,
    userRole: 'visitor',
    userName: '',
    
    // Avatar
    avatarUrl: 'https://img.freepik.com/fotos-gratis/jovem-mulher-confiante-com-oculos_1098-20868.jpg?w=200',

    // ===============================================
    // CÉREBRO: PADRÕES E AÇÕES (Intents)
    // ===============================================
    intents: [
        // --- 1. GERAL (Conversa Fiada Inteligente) ---
        {
            roles: ['all'],
            patterns: [/oi/i, /olá/i, /ola/i, /eai/i, /hey/i],
            response: (ctx) => {
                const hour = new Date().getHours();
                let timeGreeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
                return `${timeGreeting}, ${ctx.name || 'visitante'}! 👋 Sou a Cicí. Estou no painel de **${ctx.roleLabel}**. Como posso ser útil hoje?`;
            },
            action: null
        },
        {
            roles: ['all'],
            patterns: [/obrigado/i, /valeu/i, /grato/i, /tks/i],
            response: () => [
                "Por nada! A Guineexpress agradece. ✈️💛", 
                "Disponha! Qualquer coisa, é só chamar.", 
                "Imagina! Estamos aqui para facilitar sua logística."
            ], // Array para respostas aleatórias
            action: null
        },
        {
            roles: ['all'],
            patterns: [/quem é você/i, /o que você faz/i, /ajuda/i],
            response: () => "Sou a Inteligência Artificial da Guineexpress. 🤖 Posso te ajudar a navegar, rastrear encomendas ou tirar dúvidas sobre o sistema.",
            action: null
        },

        // --- 2. VISITANTE (Vendas) ---
        {
            roles: ['visitor'],
            patterns: [/cadastro/i, /criar conta/i, /registrar/i, /não tenho conta/i],
            response: () => "Ótima escolha! 🎉 Vamos criar sua conta agora mesmo. Clique no formulário que abri.",
            action: () => { if(typeof showRegister === 'function') showRegister(); }
        },
        {
            roles: ['visitor'],
            patterns: [/entrar/i, /login/i, /logar/i, /acessar/i],
            response: () => "Claro! Digite seu e-mail e senha. Se esqueceu a senha, me avise.",
            action: () => { if(typeof showLogin === 'function') showLogin(); }
        },
        {
            roles: ['visitor'],
            patterns: [/senha/i, /esqueci/i, /recuperar/i],
            response: () => "Sem problemas. 🔒 Vou abrir a tela de recuperação de senha para você.",
            action: () => { 
                const modal = document.getElementById('modal-recover');
                if(modal) modal.classList.remove('hidden'); 
            }
        },

        // --- 3. CLIENTE (Onde a mágica acontece) ---
        {
            roles: ['client'],
            patterns: [/rastrear/i, /minhas encomendas/i, /pedidos/i, /chegou/i, /status/i],
            response: (ctx) => {
                // ELA LÊ A TELA: Conta quantos itens tem na tabela
                const count = CiciAI.countTableRows('orders-list'); // ID da tabela de encomendas
                if (count > 0) {
                    return `Encontrei **${count} encomendas** na sua lista! 📦 Vou te mostrar. Se estiver 'Verde', já pode vir buscar!`;
                } else {
                    return "Abri sua lista, mas não vejo encomendas recentes agora. 🧐 Quer adicionar uma nova?";
                }
            },
            action: () => { showSection('orders-view'); }
        },
        {
            roles: ['client'],
            patterns: [/pagar/i, /fatura/i, /pix/i, /dinheiro/i, /devo/i],
            response: () => "Área Financeira. 💲 Verifique suas faturas abertas abaixo. Aceitamos Pix e Cartão.",
            action: () => { showSection('billing-view'); }
        },
        {
            roles: ['client'],
            patterns: [/agendar/i, /retirar/i, /buscar/i, /horário/i],
            response: () => "Perfeito! 📅 Escolha um horário disponível na agenda para não pegar fila.",
            action: () => { showSection('schedule-view'); }
        },

        // --- 4. ADMIN (Gestão) ---
        {
            roles: ['admin'],
            patterns: [/resumo/i, /geral/i, /como estamos/i],
            response: () => {
                return "Análise rápida: Verifique os Logs de acesso e o Faturamento do dia. Tudo parece operante, Chefe! 🫡";
            },
            action: () => { showSection('logs-view'); } 
        },
        {
            roles: ['admin'],
            patterns: [/etiqueta/i, /imprimir/i, /tag/i],
            response: () => "Gerador de Etiquetas pronto. 🏷️ Lembre-se de verificar o papel da impressora.",
            action: () => { showSection('labels-view'); } 
        },

        // --- 5. FUNCIONÁRIO (Operacional) ---
        {
            roles: ['employee'],
            patterns: [/receber/i, /nova/i, /triagem/i],
            response: () => "Modo de Recebimento Ativado. 📥 Prepare o scanner e a balança.",
            action: () => { showSection('receipts-view'); } 
        },
        {
            roles: ['employee'],
            patterns: [/cliente/i, /buscar cliente/i],
            response: () => "Vou abrir o scanner de QR Code para identificar o cliente. 📸",
            action: () => { if(typeof startScanner === 'function') startScanner(); } 
        }
    ],

    // ===============================================
    // LÓGICA DO SISTEMA (ENGINE)
    // ===============================================
    init: function() {
        this.detectContext();
        this.renderWidget();
        
        // Efeito sonoro de entrada (opcional, removido para não ser chato)
        setTimeout(() => {
            const badge = document.getElementById('cici-badge');
            if(badge) {
                badge.classList.remove('hidden');
                badge.classList.add('pulse-animation'); // Adicione isso no CSS para pulsar
            }
        }, 1000);
    },

    // Detecção Contextual Melhorada
    detectContext: function() {
        const path = window.location.pathname;
        
        if (path.includes('dashboard-admin')) { this.userRole = 'admin'; this.roleLabel = 'Administrador'; } 
        else if (path.includes('dashboard-employee')) { this.userRole = 'employee'; this.roleLabel = 'Colaborador'; } 
        else if (path.includes('dashboard-client')) { 
            this.userRole = 'client'; 
            this.roleLabel = 'Cliente VIP';
            // Tenta pegar o nome da variável global do script.js
            if (typeof currentUser !== 'undefined' && currentUser.name) {
                this.userName = currentUser.name.split(' ')[0];
            }
        } 
        else { this.userRole = 'visitor'; this.roleLabel = 'Visitante'; }

        console.log(`🧠 Cici v6.0 Online. Contexto: ${this.userRole}`);
    },

    // FUNÇÃO DE "VISÃO": Conta linhas de tabelas para dar respostas reais
    countTableRows: function(tableId) {
        const table = document.getElementById(tableId);
        if(!table) return 0;
        // Conta trs dentro do tbody, se existir, ou da table direta
        const rows = table.querySelectorAll('tbody tr').length || table.querySelectorAll('tr').length - 1; 
        return Math.max(0, rows);
    },

    renderWidget: function() {
        if(document.getElementById('cici-widget')) return;

        // Saudação inicial inteligente
        const msgs = {
            'visitor': "Olá! ✈️ Quer enviar encomendas para Guiné-Bissau?",
            'client': `Olá, ${this.userName}! 📦 Vim te ajudar com suas encomendas.`,
            'admin': "Painel Admin. 🛡️ O sistema está rodando 100%.",
            'employee': "Pronto para o trabalho? 🛠️ O que vamos fazer?"
        };

        const html = `
            <div id="cici-widget">
                <div id="cici-chat-window">
                    <div class="cici-header">
                        <div class="cici-info">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <div style="position:relative;">
                                    <div style="width:38px; height:38px; background:url('${this.avatarUrl}'); background-size:cover; border-radius:50%; border:2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"></div>
                                    <div style="width:10px; height:10px; background:#28a745; border-radius:50%; position:absolute; bottom:0; right:0; border:2px solid #fff;"></div>
                                </div>
                                <div>
                                    <h4 style="margin:0; font-size:15px; font-weight:700;">Cicí Assistente</h4>
                                    <small style="color:rgba(255,255,255,0.8); font-size:11px;">● IA Online</small>
                                </div>
                            </div>
                        </div>
                        <button onclick="CiciAI.toggle()" style="background:none;border:none;color:white;cursor:pointer;font-size:24px; line-height:1;">&times;</button>
                    </div>
                    
                    <div class="cici-body" id="cici-messages">
                        <div class="msg cici">
                            ${msgs[this.userRole] || msgs['visitor']}
                        </div>
                        ${this.getQuickOptionsHTML()}
                    </div>

                    <div class="cici-input-area">
                        <input type="text" id="cici-input" placeholder="Digite sua dúvida..." onkeypress="CiciAI.handleInput(event)" autocomplete="off">
                        <button onclick="CiciAI.handleSend()" class="cici-send-btn"><i class="fas fa-paper-plane"></i> ➤</button>
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
        if(this.userRole === 'client') opts = ['Rastrear', 'Financeiro', 'Agendar Retirada'];
        if(this.userRole === 'employee') opts = ['Receber Encomenda', 'Buscar Cliente', 'Gravar Vídeo'];
        if(this.userRole === 'admin') opts = ['Faturamento', 'Ver Equipe', 'Logs do Sistema'];

        let html = `<div class="cici-options" style="margin-top:10px;">`;
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
            badge.classList.add('hidden');
            setTimeout(() => document.getElementById('cici-input').focus(), 300);
        } else {
            win.classList.remove('open');
        }
    },

    processText: function(text) {
        if(!text) return;
        this.addMessage(text, 'user');
        this.showTyping();

        // Inteligência para normalizar texto (remove acentos e lowercase)
        const cleanText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        setTimeout(() => {
            this.hideTyping();
            
            let match = null;
            
            // Busca Match
            for (let intent of this.intents) {
                if (!intent.roles.includes('all') && !intent.roles.includes(this.userRole)) continue;

                for (let pattern of intent.patterns) {
                    if (pattern.test(text) || pattern.test(cleanText)) {
                        match = intent;
                        break;
                    }
                }
                if (match) break;
            }

            // Resposta
            if (match) {
                // Prepara contexto para passar para a função de resposta
                const ctx = { role: this.userRole, name: this.userName, roleLabel: this.roleLabel };
                
                let reply = "";
                // Se a resposta for uma função, executa. Se for array, pega aleatório. Se for string, usa ela.
                if (typeof match.response === 'function') {
                    reply = match.response(ctx);
                } else if (Array.isArray(match.response)) {
                    reply = match.response[Math.floor(Math.random() * match.response.length)];
                } else {
                    reply = match.response;
                }

                this.addMessage(reply, 'cici');
                if (match.action) match.action();

            } else {
                // Fallback Inteligente (Não entendeu)
                const fallbackMsg = this.userRole === 'client' 
                    ? "Não entendi bem, mas posso te mostrar suas **Encomendas** ou **Faturas**. O que prefere?"
                    : "Desculpe, ainda estou aprendendo. 🧠 Tente clicar nos botões abaixo:";
                
                this.addMessage(fallbackMsg, 'cici');
                const msgs = document.getElementById('cici-messages');
                msgs.innerHTML += this.getQuickOptionsHTML();
                msgs.scrollTop = msgs.scrollHeight;
            }
        }, 700); // Tempo de "pensar" levemente maior para realismo
    },

    addMessage: function(text, sender) {
        const msgs = document.getElementById('cici-messages');
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        // Detecta Links e transforma em clicáveis
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const formattedText = text.replace(urlRegex, '<a href="$1" target="_blank" style="color:white;text-decoration:underline;">$1</a>');
        
        div.innerHTML = formattedText;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
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
        input.value = '';
        this.processText(txt);
    }
};

// Inicializa com segurança
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { CiciAI.init(); }, 800);
});
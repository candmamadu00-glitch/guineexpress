/* cici.js - Inteligência Artificial Contextual (CORRIGIDO) */

const CiciAI = {
    isOpen: false,
    userRole: 'visitor', // visitor, client, employee, admin
    currentContext: 'home', // home, finance, orders, etc.
    userName: '',

    // ===============================================
    // BASE DE CONHECIMENTO (CÉREBRO)
    // ===============================================
    knowledge: {
        // --- VISITANTES (Tela de Login) ---
        'visitor': {
            default: {
                msg: "Olá! Bem-vindo à Guineexpress. ✈️ Precisa de ajuda para entrar?",
                opts: [
                    { t: "Como me cadastro?", a: "Clique no botão azul **Sou Cliente** e depois em **Cadastrar**. É rapidinho!" },
                    { t: "Esqueci a senha", a: "Sem pânico! Clique em **Recuperar Acesso** abaixo dos campos de senha." },
                    { t: "Preços de envio", a: "Nossos preços variam por Kg. Faça login ou fale no WhatsApp para uma cotação atualizada!" }
                ]
            }
        },

        // --- CLIENTES ---
        'client': {
            default: {
                msg: "Olá! Como posso ajudar com suas encomendas hoje?",
                opts: [
                    { t: "Rastrear Encomenda", a: "Vá para a aba **Minhas Encomendas**. Se o status for 'Enviado', já está voando! ✈️" },
                    { t: "Como funciona o Box?", a: "O **Box** é onde juntamos suas compras pequenas até formar uma caixa grande para enviar." },
                    { t: "Minhas Faturas", a: "Na tela inicial, veja o card 'Faturas em Aberto'. Clique para ver detalhes e pagar." }
                ]
            },
            'box-view': {
                msg: "Vejo que você está no seu Box Virtual. 📦",
                opts: [
                    { t: "Como enviar isso?", a: "Quando quiser enviar seus itens acumulados, clique no botão **Solicitar Envio** no topo da lista." },
                    { t: "Itens proibidos", a: "Não enviamos: Baterias soltas, líquidos inflamáveis, armas e dinheiro em espécie." }
                ]
            }
        },

        // --- ADMIN ---
        'admin': {
            default: {
                msg: "Olá Chefe! 🫡 Painel administrativo pronto. O que precisa?",
                opts: [
                    { t: "Criar Embarque", a: "Vá em **Embarques**, clique em 'Novo Manifesto', selecione as caixas e feche o lote." },
                    { t: "Cadastrar Funcionário", a: "Vá em **Usuários** > Novo Usuário > Selecione o cargo 'Funcionário'." },
                    { t: "Ver Lucro", a: "Acesse a aba **Financeiro** para ver gráficos de receitas e despesas." }
                ]
            },
            'finance-view': {
                msg: "Modo Financeiro ativado. 💰 Vamos falar de números?",
                opts: [
                    { t: "Lançar Despesa", a: "Clique em **Nova Despesa**, escolha a categoria (ex: Aluguel) e salve." },
                    { t: "Exportar Relatório", a: "Use o botão 'Exportar Excel' no topo da tabela para baixar os dados." }
                ]
            },
            'shipments-view': {
                msg: "Gerenciando Embarques (Manifestos). ✈️",
                opts: [
                    { t: "Imprimir Manifesto", a: "Na lista de manifestos, clique no ícone de **Impressora** para gerar o PDF." },
                    { t: "Fechar Lote", a: "Selecione as caixas pendentes e clique em **Criar Manifesto**." }
                ]
            }
        },

        // --- FUNCIONÁRIOS ---
        'employee': {
            default: {
                msg: "Olá! Bom turno de trabalho. 🛠️",
                opts: [
                    { t: "Receber Caixa", a: "Vá em **Receber na Loja**. Digite o código do cliente ou use o scanner." },
                    { t: "Pesar Caixa", a: "Ao receber, coloque o peso exato. O sistema calcula o preço automaticamente." },
                    { t: "Imprimir Etiqueta", a: "Na lista de caixas, clique na impressora para gerar a etiqueta de identificação." }
                ]
            }
        }
    },

    // ===============================================
    // LÓGICA DO SISTEMA
    // ===============================================
    init: function() {
        this.detectUser();
        this.detectContext();
        this.renderWidget();
        
        // Monitorar cliques no menu para mudar o contexto da Cicí
        document.querySelectorAll('button, a').forEach(el => {
            el.addEventListener('click', () => setTimeout(() => this.updateContext(), 500));
        });

        // Boas vindas com delay
        setTimeout(() => {
            const badge = document.getElementById('cici-badge');
            if(badge) badge.classList.remove('hidden');
        }, 3000);
    },

    detectUser: function() {
        const path = window.location.pathname;
        if (path.includes('admin')) this.userRole = 'admin';
        else if (path.includes('employee')) this.userRole = 'employee';
        else if (path.includes('client')) this.userRole = 'client';
        else this.userRole = 'visitor';
    },

    detectContext: function() {
        const sections = document.querySelectorAll('section:not(.hidden)');
        if (sections.length > 0) {
            this.currentContext = sections[0].id; 
        } else {
            this.currentContext = 'default';
        }
    },

    updateContext: function() {
        this.detectContext();
        if(this.isOpen) {
            
        }
    },

    renderWidget: function() {
        if(document.getElementById('cici-widget')) return;

        const html = `
            <div id="cici-widget">
                <div id="cici-chat-window">
                    <div class="cici-header">
                        <div class="cici-info">
                            <h4>Cicí Assistente</h4>
                            <small>● Online • Guineexpress IA</small>
                        </div>
                        <button onclick="CiciAI.toggle()" style="background:none;border:none;color:white;cursor:pointer;font-size:18px;">&times;</button>
                    </div>
                    <div class="cici-body" id="cici-messages"></div>
                    <div class="cici-input-area">
                        <input type="text" id="cici-input" placeholder="Digite sua dúvida..." onkeypress="CiciAI.handleInput(event)">
                        <button onclick="CiciAI.handleSend()" style="background:none;border:none;cursor:pointer;">🚀</button>
                    </div>
                </div>
                
                <div id="cici-avatar" onclick="CiciAI.toggle()">
                    <div id="cici-badge" class="cici-badge hidden">1</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    toggle: function() {
        const win = document.getElementById('cici-chat-window');
        const badge = document.getElementById('cici-badge');
        
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            win.classList.add('open');
            badge.classList.add('hidden');
            if (document.getElementById('cici-messages').innerHTML.trim() === '') {
                this.updateContext();
                this.showTypingAndResponse(null, true);
            }
        } else {
            win.classList.remove('open');
        }
    },

    getSmartResponse: function(text) {
        const roleData = this.knowledge[this.userRole];
        let contextData = roleData[this.currentContext] || roleData['default'];
        
        if (text) {
            text = text.toLowerCase();
            let found = null;
            Object.values(roleData).forEach(ctx => {
                ctx.opts.forEach(opt => {
                    if (opt.t.toLowerCase().includes(text) || opt.a.toLowerCase().includes(text)) {
                        found = opt.a;
                    }
                });
            });

            if (found) return { msg: found, opts: [] };
            
            if(text.includes('ola') || text.includes('oi')) return { msg: "Olá! Como posso ajudar hoje?", opts: contextData.opts };
            if(text.includes('obrigado')) return { msg: "Por nada! Estou sempre aqui. 💛", opts: [] };
            if(text.includes('tchau')) return { msg: "Até logo! Bons envios. ✈️", opts: [] };
            
            return { msg: "Hmm, ainda estou aprendendo sobre isso. Tente usar os botões ou fale com o Suporte Humano no WhatsApp.", opts: contextData.opts };
        }
        return { msg: contextData.msg, opts: contextData.opts };
    },

    showTypingAndResponse: function(userText, isAuto = false) {
        const msgs = document.getElementById('cici-messages');
        
        if (userText) {
            msgs.innerHTML += `<div class="msg user">${userText}</div>`;
            msgs.scrollTop = msgs.scrollHeight;
        }

        const typingId = 'typing-' + Date.now();
        msgs.innerHTML += `
            <div id="${typingId}" class="typing-indicator">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
            </div>`;
        msgs.scrollTop = msgs.scrollHeight;

        setTimeout(() => {
            document.getElementById(typingId).remove();
            
            const response = this.getSmartResponse(userText);
            
            let finalHtml = `<div class="msg cici">${response.msg}</div>`;
            
            if (response.opts && response.opts.length > 0) {
                finalHtml += `<div class="cici-options">`;
                response.opts.forEach(opt => {
                    // CORREÇÃO CRÍTICA: Tratamos aspas simples para não quebrar o HTML do botão
                    const safeTxt = opt.t.replace(/'/g, "\\'");
                    const safeAns = opt.a.replace(/'/g, "\\'");
                    finalHtml += `<button class="cici-btn-opt" onclick="CiciAI.clickOption('${safeTxt}', '${safeAns}')">${opt.t}</button>`;
                });
                finalHtml += `</div>`;
            }

            msgs.innerHTML += finalHtml;
            msgs.scrollTop = msgs.scrollHeight;
        }, 1000);
    },
    
    // Função Única para clique no botão (A anterior duplicada foi removida)
    clickOption: function(txt, ans) {
        const msgs = document.getElementById('cici-messages');
        msgs.innerHTML += `<div class="msg user">${txt}</div>`;
        
        const typingId = 'typ-' + Date.now();
        msgs.innerHTML += `<div id="${typingId}" class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
        msgs.scrollTop = msgs.scrollHeight;

        setTimeout(() => {
            document.getElementById(typingId).remove();
            msgs.innerHTML += `<div class="msg cici">${ans}</div>`;
            msgs.scrollTop = msgs.scrollHeight;
        }, 800);
    },

    handleInput: function(e) {
        if(e.key === 'Enter') this.handleSend();
    },

    handleSend: function() {
        const input = document.getElementById('cici-input');
        const txt = input.value.trim();
        if(!txt) return;
        
        input.value = '';
        this.showTypingAndResponse(txt);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    CiciAI.init();
});
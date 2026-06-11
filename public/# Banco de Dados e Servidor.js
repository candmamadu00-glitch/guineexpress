# Banco de Dados e Servidor
SESSION_SECRET=gere_uma_chave_aleatoria_de_64_chars_aqui
NODE_ENV=production
PORT=3000
BASE_URL=https://guineexpress-f6ab.onrender.com

# Email (SMTP)
EMAIL_USER=Comercialguineexpress245@gmail.com
EMAIL_PASS=sua_nova_senha_de_app_gmail

# Email (IMAP - Monitor Nubank)
IMAP_USER=Comercialguineexpress245@gmail.com
IMAP_PASS=sua_nova_senha_de_app_gmail

# WhatsApp Admin
ADMIN_PHONE=5585998239207

# Push Notifications (VAPID)
VAPID_EMAIL=candemamadu09@gmail.com
VAPID_PUBLIC_KEY=BHz6ezs_RX0nln77mT3xRFrBpf6WhAWwiedXWOwDoRl90r32Iwmgx4ROqxzLRWhwXHc_pvIejfWcKNOaPNFzEsY
VAPID_PRIVATE_KEY=o7cuX6wivGgnxOoLwa__pYUFH66B3R16hzwtr3yavV4

# Mercado Pago
MP_ACCESS_TOKEN=seu_token_aqui

# Google Gemini AI
GEMINI_API_KEY=sua_chave_gemini_aqui

# Render Disk
RENDER_DISK_PATH=/data
// ==========================================
// ROTA: UPLOAD DE COMPROVANTE (IMAGEM OU PDF) COM ANÁLISE DA CICÍ 🤖 E ANTI-FRAUDE 🛡️
// ==========================================
app.post('/api/invoices/:id/upload-receipt', upload.single('receipt'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Nenhum arquivo foi enviado.' });
    }

    const invoiceId = req.params.id;
    const receiptPath = '/uploads/' + req.file.filename; 
    const fullFilePath = req.file.path; 

    // 1. Atualiza o status preliminar no banco
    db.run("UPDATE invoices SET status = 'in_review', receipt_url = ? WHERE id = ?", [receiptPath, invoiceId], (err) => {
        if (err) return res.json({ success: false, message: 'Erro ao salvar no banco.' });

        // 2. Busca os dados da fatura
        db.get("SELECT invoices.amount, users.name FROM invoices JOIN users ON invoices.client_id = users.id WHERE invoices.id = ?", [invoiceId], async (err, row) => {
            const clientName = row ? row.name : "um cliente";
            const expectedAmount = row ? parseFloat(row.amount) : 0;

            let mensagemCici = "";

            try {
                // 3. 🤖 A CICÍ LÊ O ARQUIVO
                const arquivoPart = fileToGenerativePart(fullFilePath, req.file.mimetype);
                const dataHoje = new Date().toLocaleDateString('pt-BR');
                
                const prompt = `
                Você é um auditor financeiro rigoroso. Analise este arquivo.
                Hoje é dia ${dataHoje}. O valor exato cobrado é R$ ${expectedAmount}.
                
                Responda APENAS em formato JSON:
                {"eh_comprovante": true, "agendado": false, "valor_bate": true, "data_pagamento": "DD/MM/AAAA", "id_transacao": "codigo", "alerta_data": false, "motivo": "..."}
                
                Regras:
                1. "eh_comprovante": É um comprovante bancário real (Pix/Transferência/Ecobank)?
                2. "agendado": É um agendamento futuro?
                3. "valor_bate": O valor pago é EXATAMENTE R$ ${expectedAmount}?
                4. "data_pagamento": Extraia a data do pagamento.
                5. "id_transacao": Extraia o Código de Autenticação/Transação/End-to-End. Se não achar, escreva "Nao_Encontrado".
                6. "alerta_data": Marque true SE a data for MAIS VELHA que 10 dias de hoje (${dataHoje}).
                7. "motivo": Explique brevemente.
                `;

                const result = await model.generateContent([prompt, arquivoPart]);
                const iaRespostaText = result.response.text().trim().replace(/```json/g, '').replace(/```/g, '');
                const analise = JSON.parse(iaRespostaText);

                // 4. 🛡️ VERIFICAÇÃO ANTI-FRAUDE NO BANCO DE DADOS
                let comprovanteReciclado = false;
                let idFaturaAntiga = null;

                // Só checa fraude se ela achou um código válido
                if (analise.id_transacao && analise.id_transacao !== "Nao_Encontrado" && analise.id_transacao.length > 5) {
                    
                    // Salva esse ID nesta fatura
                    db.run("UPDATE invoices SET transaction_id = ? WHERE id = ?", [analise.id_transacao, invoiceId]);

                    // Procura se o mesmo ID já existe em OUTRA fatura
                    const checkFraude = await new Promise((resolve, reject) => {
                        db.get("SELECT id FROM invoices WHERE transaction_id = ? AND id != ? AND status != 'canceled'", [analise.id_transacao, invoiceId], (err, row_fraude) => {
                            resolve(row_fraude);
                        });
                    });

                    if (checkFraude) {
                        comprovanteReciclado = true;
                        idFaturaAntiga = checkFraude.id;
                    }
                }

                // 5. A CICÍ DECIDE O QUE FALAR PARA O LELO (Agora com a trava de fraude)
                if (comprovanteReciclado) {
                    mensagemCici = `🚨 **GOLPE DETECTADO!** Lelo, o cliente **${clientName}** tentou usar um comprovante na Fatura #${invoiceId} que **JÁ FOI USADO** antes na Fatura #${idFaturaAntiga}! Não aprove! <br>💳 *ID Reciclado:* ${analise.id_transacao} <br><br> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Ver Prova do Golpe</button>`;
                
                } else if (!analise.eh_comprovante) {
                    mensagemCici = `❌ **ARQUIVO INVÁLIDO!** Lelo, o cliente **${clientName}** enviou a Fatura #${invoiceId}, mas a foto **não é um recibo bancário**. Motivo da IA: ${analise.motivo}. <br><br> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Ver Foto</button>`;
                
                } else if (analise.agendado) {
                    mensagemCici = `🚨 **ALERTA!** Lelo, o cliente **${clientName}** enviou um comprovante (Fatura #${invoiceId}), mas a IA detectou que é um **AGENDAMENTO**. Cuidado! <br><br> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Ver Arquivo Suspeito</button>`;
                
                } else if (!analise.valor_bate) {
                    mensagemCici = `⚠️ **VALOR INCORRETO!** Lelo, o cliente **${clientName}** enviou o comprovante (Fatura #${invoiceId}), mas o **valor não bate** com os R$ ${expectedAmount}. Motivo: ${analise.motivo}. <br><br> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#f39c12; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Analisar Manualmente</button>`;
                
                } else if (analise.alerta_data) {
                    mensagemCici = `⏳ **COMPROVANTE ANTIGO!** Lelo, o cliente **${clientName}** mandou o valor certo na Fatura #${invoiceId}, mas a data é de **${analise.data_pagamento}** (mais de 10 dias atrás). Verifique! <br>💳 *ID:* ${analise.id_transacao} <br><br> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#e67e22; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Analisar Manualmente</button>`;

                } else {
                    mensagemCici = `✅ **TUDO CERTO!** Lelo, chequei o comprovante de **${clientName}** (Fatura #${invoiceId}). O valor de R$ ${expectedAmount} está correto e o pagamento é novo (${analise.data_pagamento})! Nenhuma fraude detectada. Posso dar baixa? <br>💳 *ID:* ${analise.id_transacao} <br><br> <button onclick="approveInvoice(${invoiceId})" style="background:#28a745; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">👍 Sim, Aprovar Agora</button> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#6c757d; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; margin-left:5px;">Ver Arquivo</button>`;
                }

            } catch (iaErr) {
                console.error("Erro na leitura da Cicí:", iaErr);
                mensagemCici = `Olá Lelo! O cliente **${clientName}** anexou um arquivo (Fatura #${invoiceId}). Tive um probleminha para ler o formato, por favor verifique manualmente. <br><br> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#17a2b8; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Ver Comprovante</button>`;
            }

            // Envia a notificação
            if (!global.ciciAvisos) global.ciciAvisos = [];
            global.ciciAvisos.push(mensagemCici);
            
            // --- NOTIFICAÇÃO ZAP (MANTIDA) ---
            if (typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                try {
                    const meuNumeroAdmin = "5585998239207"; 
                    const msgAdmin = `🔔 *NOVO PAGAMENTO*\n\nComprovante da Fatura #${invoiceId} de ${clientName} chegou. A Cicí já analisou no painel!`;
                    const idOficial = await clientZap.getNumberId(meuNumeroAdmin);
                    if (idOficial) await clientZap.sendMessage(idOficial._serialized, msgAdmin);
                    else await clientZap.sendMessage(`${meuNumeroAdmin}@c.us`, msgAdmin);
                } catch (zapErr) { console.error("Erro zap:", zapErr.message); }
            }

            res.json({ success: true, message: 'Comprovativo recebido e enviado para análise!' });
        });
    });
});
 <div style="margin: 35px 15px; text-align: center; display: flex; justify-content: center;">
    <div style="position: relative; width: 100%; max-width: 350px; height: 60px; padding: 2px; border-radius: 20px; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0, 242, 254, 0.2);">
        <div style="position: absolute; width: 200%; height: 200%; background: conic-gradient(from 0deg, transparent, #00f2fe, #d4af37, transparent 50%); animation: spinElectric 2.5s linear infinite; z-index: 1;"></div>
        <button onclick="window.location.href='dashboard-vip.html'" style="position: absolute; inset: 2px; background: #050a15; border: none; border-radius: 18px; color: #fff; font-size: 15px; font-weight: 900; letter-spacing: 1px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; z-index: 2; text-transform: uppercase;">
            <i class="fas fa-plane-departure" style="color: #00f2fe; font-size: 18px; animation: bounce 2s infinite;"></i>
            Acessar SITE VIP
        </button>
    </div>
</div>
<div class="btn-electric-wrapper"><div class="electric-ring" style="background: conic-gradient(from 0deg, transparent, #dfaf12, #00f2fe, transparent 50%);"></div>
            <button onclick="showSection('store-view'); carregarLojaCliente();" class="nav-btn premium-btn store-btn" style="background: #dfaf12; color: #0a1931; font-weight: 900;"><i class="fas fa-store"></i> Loja</button>
        </div>

        <div class="bottom-nav-bar">
    <button onclick="showSection('home-view')" class="bottom-nav-item active" id="nav-home">
        <i class="fas fa-home"></i>
        <span>Início</span>
    </button>
    
    <button onclick="showSection('store-view');" class="bottom-nav-item" id="nav-store">
        <i class="fas fa-store-alt"></i> 
        <span>Loja</span>
    </button>

    <button onclick="abrirModalCarrinho()" class="bottom-nav-item" id="nav-sacola">
        <div style="position: relative;">
            <i class="fas fa-shopping-bag"></i>
            <span id="bottom-cart-counter" class="cart-badge hidden">0</span>
        </div>
        <span>Sacola</span>
    </button>

    <button onclick="abrirMeusPedidosLoja()" class="bottom-nav-item" id="nav-pedidos">
        <i class="fas fa-receipt"></i>
        <span>Pedidos</span>
    </button>

    <button onclick="showSection('profile-view')" class="bottom-nav-item" id="nav-profile">
        <i class="fas fa-user"></i>
        <span>Perfil</span>
    </button>
</div>
<div id="modal-produto-premium" class="modal-overlay hidden" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(12, 6, 0, 0.85); backdrop-filter: blur(10px); z-index: 99999; display: flex; justify-content: center; align-items: center; opacity: 0; transition: opacity 0.4s ease;">
    <div class="produto-card-glass" style="background: rgba(20, 10, 0, 0.8); border: 1px solid rgba(255, 94, 0, 0.3); border-radius: 25px; width: 90%; max-width: 400px; padding: 20px; box-shadow: 0 30px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 94, 0, 0.1); position: relative; transform: scale(0.8); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
        
        <button onclick="fecharModalProduto()" style="position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.5); border: none; color: #fff; width: 35px; height: 35px; border-radius: 50%; cursor: pointer; font-size: 16px; border: 1px solid rgba(255,255,255,0.1);"><i class="fas fa-times"></i></button>

        <div style="width: 100%; height: 250px; border-radius: 15px; overflow: hidden; margin-bottom: 20px; position: relative;">
            <img id="vip-prod-img" src="" alt="Produto" style="width: 100%; height: 100%; object-fit: cover;">
            <div style="position: absolute; bottom: 10px; left: 10px; background: var(--primary-orange); color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; box-shadow: 0 4px 10px rgba(255,94,0,0.5);">
                VIP EXCLUSIVO
            </div>
        </div>

        <h2 id="vip-prod-title" style="color: #fff; margin: 0 0 10px 0; font-size: 22px; font-weight: 800;">Nome do Produto</h2>
        <p id="vip-prod-desc" style="color: #ccc; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">Descrição detalhada do produto vai aparecer aqui.</p>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">
            <div>
                <span style="color: #888; font-size: 12px; display: block;">Preço Atual</span>
                <span id="vip-prod-price" style="color: var(--primary-orange); font-size: 26px; font-weight: 900;">R$ 0,00</span>
            </div>
        </div>

        <button id="btn-comprar-vip" onclick="tentarComprar()" style="width: 100%; background: var(--primary-orange); color: white; border: none; padding: 18px; border-radius: 15px; font-size: 16px; font-weight: 900; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: center; align-items: center; gap: 10px; box-shadow: 0 10px 25px rgba(255, 94, 0, 0.4); transition: 0.3s;">
            <i class="fas fa-shopping-bag"></i> QUERO COMPRAR
        </button>
    </div>
</div>

<section id="store-vip-view" class="aurora-bg" style="display: none;">
    <div class="vip-glass-container" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-radius: 0 0 25px 25px; margin: 0 0 20px 0;">
        <button onclick="fecharVitrineVip()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 18px; backdrop-filter: blur(5px); cursor: pointer;">
            <i class="fas fa-arrow-left"></i>
        </button>
        <div style="text-align: center;">
            <h2 style="color: white; margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 2px;">GUINEEXPRESS</h2>
            <span style="color: #d4af37; font-size: 10px; font-weight: bold; letter-spacing: 3px;">PREMIUM COLLECTION</span>
        </div>
        <div style="width: 40px;"></div> 
    </div>

    <div class="flag-3d-container">
        <div class="flag-3d flag-br"></div>
        <i class="fas fa-plane" style="color: white; font-size: 18px; align-self: center; opacity: 0.8; animation: flyRight 3s infinite linear;"></i>
        <div class="flag-3d flag-gw"></div>
    </div>
    
    <style>
        @keyframes flyRight { 0% { transform: translateX(-10px); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateX(10px); opacity: 0; } }
    </style>

    <div style="padding: 0 20px;">
        <h3 style="color: white; text-align: center; margin-bottom: 20px; font-weight: 300; letter-spacing: 1px;">Toque num produto para a magia acontecer.</h3>
        
        <div id="vip-products-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px;">
        </div>
    </div>
</section>   

<script>
    // 3. O GUARDA-COSTAS DA COMPRA (Verifica Login)
    function tentarComprar() {
        if (!window.currentUser) {
            fecharModalProduto(); // Fecha o produto
            alert("🔒 Acesso Restrito! Faça login ou crie uma conta grátis para finalizar sua compra.");
            
            const loginScreen = document.getElementById('login-screen'); 
            if(loginScreen) {
                loginScreen.classList.remove('hidden');
            } else {
                window.location.href = '/'; 
            }
        } else {
            alert("✅ Produto adicionado ao carrinho com sucesso!");
        }
    }

    // Faz a cor e a animação pularem para o botão que o cliente acabou de clicar!
    const navItemsBottom = document.querySelectorAll('.bottom-nav-item');
    navItemsBottom.forEach(item => {
        item.addEventListener('click', () => {
            if(!item.getAttribute('onclick').includes('Carrinho') && !item.getAttribute('onclick').includes('Pedidos')) {
                navItemsBottom.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });

    // 2. CONTROLES DE ABRIR E FECHAR A VITRINE VIP 3D (CORRIGIDO)
    function abrirVitrineVip() {
        event.preventDefault(); // Impede a página de piscar/recarregar!
        const vitrine = document.getElementById('store-vip-view');
        if (vitrine) {
            vitrine.style.display = 'block';
            vitrine.style.opacity = '1';
            try { carregarLojaVip(); } catch(e) { console.log("A carregar loja..."); }
        }
    }
    
    function fecharVitrineVip() {
        document.getElementById('store-vip-view').style.display = 'none';
    }
</script>


<section id="store-view" class="hidden" style="background: #f4f7f6; min-height: 100vh; padding-bottom: 80px;">

    <div style="background: linear-gradient(135deg, #ee4d2d, #ff7337); padding: 25px 20px 30px 20px; border-radius: 0 0 30px 30px; box-shadow: 0 10px 25px rgba(238, 77, 45, 0.3); margin-bottom: -20px; position: relative; z-index: 2;">
    
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        
        <div>
            <h2 style="color: #ffffff !important; margin: 0; font-size: 24px; font-weight: 900; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-shopping-bag" style="color: #ffffff !important;"></i> Loja
            </h2>
            <p style="color: rgba(255,255,255,0.9); font-size: 12px; margin: 3px 0 0 0;">Os melhores produtos para a Guiné!</p>
        </div>
        
        <div style="display: flex; gap: 8px; align-items: center;">
            
            <button onclick="abrirMeusPedidosLoja()" style="background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255,255,255,0.4); width: 42px; height: 42px; border-radius: 50%; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: 0.3s;">
                <i class="fas fa-receipt"></i>
            </button>

            <div onclick="abrirModalCarrinho()" style="position: relative; background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255,255,255,0.4); width: 42px; height: 42px; border-radius: 50%; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: 0.3s;">
                <i class="fas fa-shopping-cart"></i>
                <span id="cart-counter" class="hidden" style="position: absolute; top: -5px; right: -5px; background: #0a1931; color: white; font-size: 11px; font-weight: 900; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid #ee4d2d;">0</span>
            </div>

            <div style="background: rgba(255, 255, 255, 0.2); padding: 8px 10px; border-radius: 20px; backdrop-filter: blur(5px); border: 1px solid rgba(255,255,255,0.4); display: flex; align-items: center;">
                <select id="currency-selector" onchange="alterarMoedaLoja()" style="background: transparent; color: white; border: none; font-size: 13px; font-weight: bold; cursor: pointer; outline: none; appearance: none; -webkit-appearance: none;">
                    <option value="BRL" style="color: #333;">R$</option>
                    <option value="CFA" style="color: #333;">XOF</option>
                    <option value="EUR" style="color: #333;">€</option>
                    <option value="USD" style="color: #333;">$</option>
                </select>
                <i class="fas fa-chevron-down" style="color: white; font-size: 10px; margin-left: 4px; pointer-events: none;"></i>
            </div>

        </div>
    </div>

    <div style="position: relative;">
<input type="text" id="search-store" oninput="aplicarFiltrosLoja()" placeholder="🔍 O que você está procurando?" style="width: 100%; padding: 14px 15px 14px 45px; border-radius: 16px; border: none; font-size: 14px; font-weight: 500; box-shadow: 0 4px 15px rgba(0,0,0,0.15); outline: none; color: #333;">
        <i class="fas fa-search" style="position: absolute; left: 18px; top: 16px; color: #ee4d2d; font-size: 16px;"></i>
    </div>
</div>

    <div style="padding: 40px 20px 20px 20px;">
        <div style="width: 100%; overflow: hidden; position: relative; border-radius: 15px; box-shadow: 0 10px 20px rgba(0,0,0,0.1);">
            <div id="banner-track" style="display: flex; width: 300%; transition: transform 0.5s ease-in-out;">
                <div style="width: 33.333%; position: relative;">
                    <img src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1000&auto=format&fit=crop" style="width: 100%; height: 160px; object-fit: cover;">
                    <div style="position: absolute; bottom: 10px; left: 15px; color: white; text-shadow: 1px 1px 5px rgba(0,0,0,0.8);">
                        <h3 style="margin:0; font-weight:900;">MEGA OFERTA</h3>
                    </div>
                </div>
                <div style="width: 33.333%; position: relative;">
                    <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1000&auto=format&fit=crop" style="width: 100%; height: 160px; object-fit: cover;">
                    <div style="position: absolute; bottom: 10px; left: 15px; color: white; text-shadow: 1px 1px 5px rgba(0,0,0,0.8);">
                        <h3 style="margin:0; font-weight:900;">CHEGOU NOVIDADE</h3>
                    </div>
                </div>
                <div style="width: 33.333%; position: relative;">
                    <img src="https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=1000&auto=format&fit=crop" style="width: 100%; height: 160px; object-fit: cover;">
                    <div style="position: absolute; bottom: 10px; left: 15px; color: white; text-shadow: 1px 1px 5px rgba(0,0,0,0.8);">
                        <h3 style="margin:0; font-weight:900;">FRETE REDUZIDO</h3>
                    </div>
                </div>
            </div>
            
            <div style="position: absolute; bottom: 10px; width: 100%; display: flex; justify-content: center; gap: 6px;">
                <div class="dot active" style="width: 8px; height: 8px; background: white; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.5);"></div>
                <div class="dot" style="width: 8px; height: 8px; background: rgba(255,255,255,0.5); border-radius: 50%;"></div>
                <div class="dot" style="width: 8px; height: 8px; background: rgba(255,255,255,0.5); border-radius: 50%;"></div>
            </div>
        </div>
    </div>

    <div id="category-filters" style="display: flex; overflow-x: auto; gap: 15px; padding: 15px 20px; background: white; margin-bottom: 20px; scrollbar-width: none; -ms-overflow-style: none; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
    <style>#category-filters::-webkit-scrollbar { display: none; }</style>

    <div class="cat-item active" onclick="filtrarLoja('Todos', this)" style="display: flex; flex-direction: column; align-items: center; min-width: 60px; cursor: pointer; gap: 5px;">
        <div class="cat-icon" style="width: 50px; height: 50px; background: #fff0ed; border-radius: 50%; display: flex; justify-content: center; align-items: center; border: 2px solid #ee4d2d; transition: 0.3s;">
            <i class="fas fa-th-large" style="color: #ee4d2d; font-size: 20px; transition: 0.3s;"></i>
        </div>
        <span style="font-size: 11px; font-weight: bold; color: #333; text-align: center; transition: 0.3s;">Todos</span>
    </div>

    <div class="cat-item" onclick="filtrarLoja('Eletrônicos', this)" style="display: flex; flex-direction: column; align-items: center; min-width: 60px; cursor: pointer; gap: 5px;">
        <div class="cat-icon" style="width: 50px; height: 50px; background: #f8fafc; border-radius: 50%; display: flex; justify-content: center; align-items: center; border: 2px solid transparent; transition: 0.3s;">
            <i class="fas fa-mobile-alt" style="color: #64748b; font-size: 20px; transition: 0.3s;"></i>
        </div>
        <span style="font-size: 11px; font-weight: bold; color: #64748b; text-align: center; transition: 0.3s;">Celulares</span>
    </div>

    <div class="cat-item" onclick="filtrarLoja('Cabelos/Perucas', this)" style="display: flex; flex-direction: column; align-items: center; min-width: 60px; cursor: pointer; gap: 5px;">
        <div class="cat-icon" style="width: 50px; height: 50px; background: #f8fafc; border-radius: 50%; display: flex; justify-content: center; align-items: center; border: 2px solid transparent; transition: 0.3s;">
            <i class="fas fa-cut" style="color: #64748b; font-size: 20px; transition: 0.3s;"></i>
        </div>
        <span style="font-size: 11px; font-weight: bold; color: #64748b; text-align: center; transition: 0.3s;">Cabelos</span>
    </div>

    <div class="cat-item" onclick="filtrarLoja('Perfumes', this)" style="display: flex; flex-direction: column; align-items: center; min-width: 60px; cursor: pointer; gap: 5px;">
        <div class="cat-icon" style="width: 50px; height: 50px; background: #f8fafc; border-radius: 50%; display: flex; justify-content: center; align-items: center; border: 2px solid transparent; transition: 0.3s;">
            <i class="fas fa-spray-can" style="color: #64748b; font-size: 20px; transition: 0.3s;"></i>
        </div>
        <span style="font-size: 11px; font-weight: bold; color: #64748b; text-align: center; transition: 0.3s;">Perfumes</span>
    </div>

    <div class="cat-item" onclick="filtrarLoja('Roupas', this)" style="display: flex; flex-direction: column; align-items: center; min-width: 60px; cursor: pointer; gap: 5px;">
        <div class="cat-icon" style="width: 50px; height: 50px; background: #f8fafc; border-radius: 50%; display: flex; justify-content: center; align-items: center; border: 2px solid transparent; transition: 0.3s;">
            <i class="fas fa-tshirt" style="color: #64748b; font-size: 20px; transition: 0.3s;"></i>
        </div>
        <span style="font-size: 11px; font-weight: bold; color: #64748b; text-align: center; transition: 0.3s;">Roupas</span>
    </div>
</div>

<script>
    // Magia para trocar as cores (ficar laranja) da bolinha clicada!
    function atualizarEstiloCategoriaClicada(elementoClicado) {
        // Tira o laranja de todos
        document.querySelectorAll('.cat-item').forEach(item => {
            item.querySelector('.cat-icon').style.border = "2px solid transparent";
            item.querySelector('.cat-icon').style.background = "#f8fafc";
            item.querySelector('i').style.color = "#64748b";
            item.querySelector('span').style.color = "#64748b";
        });
        // Bota laranja apenas no que foi clicado
        elementoClicado.querySelector('.cat-icon').style.border = "2px solid #ee4d2d";
        elementoClicado.querySelector('.cat-icon').style.background = "#fff0ed";
        elementoClicado.querySelector('i').style.color = "#ee4d2d";
        elementoClicado.querySelector('span').style.color = "#333";
    }

    const catItems = document.querySelectorAll('.cat-item');
    catItems.forEach(item => {
        item.addEventListener('click', function() {
            atualizarEstiloCategoriaClicada(this);
        });
    });
</script>

<div style="padding: 0 20px 30px 20px;">
    <div id="store-products-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;">
        </div>
</div>
</section> 

<div id="modal-my-store-orders" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10, 25, 49, 0.8); z-index:50000; backdrop-filter: blur(8px); justify-content: center; align-items: center;">
    <div class="modal-content" style="background: #f1f5f9; border-radius: 24px; width: 95%; max-width: 500px; display: flex; flex-direction: column; max-height: 85vh; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
        
        <div style="background: white; padding: 25px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3 style="margin: 0; color: #0f172a; font-size: 20px;"><i class="fas fa-truck-fast" style="color: #dfaf12; margin-right: 8px;"></i> Rastreio de Pedidos</h3>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: #64748b;">Acompanhe as suas compras em tempo real.</p>
            </div>
            <button onclick="document.getElementById('modal-my-store-orders').style.display='none'" style="background: #f1f5f9; border: none; color: #64748b; width: 40px; height: 40px; border-radius: 50%; font-size: 20px; cursor: pointer; transition: 0.3s;"><i class="fas fa-times"></i></button>
        </div>
      
        <div id="my-store-orders-list" style="padding: 20px; overflow-y: auto; flex-grow: 1;">
            </div>
    </div>
</div>

<div id="cart-overlay" onclick="toggleCarrinho()" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10001; backdrop-filter: blur(3px);"></div>

<div id="side-cart" style="position: fixed; top: 0; right: -450px; width: 100%; max-width: 450px; height: 100%; background: white; z-index: 10002; transition: 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); box-shadow: -10px 0 30px rgba(0,0,0,0.2); display: flex; flex-direction: column;">
    
    <div style="padding: 20px; background: #0a1931; color: white; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 18px;"><i class="fas fa-shopping-bag" style="color: #dfaf12;"></i> Sua Sacola</h3>
        <button onclick="toggleCarrinho()" style="background: transparent; border: none; color: white; font-size: 24px; cursor: pointer;"><i class="fas fa-times"></i></button>
    </div>

    <div id="cart-step-1" style="display: flex; flex-direction: column; flex-grow: 1; overflow: hidden;">
        <div id="cart-items-container" style="flex-grow: 1; overflow-y: auto; padding: 20px; background: #f8fafc;">
        </div>
        
        <div style="padding: 20px; border-top: 1px solid #e2e8f0; background: white; padding-bottom: env(safe-area-inset-bottom, 25px);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: 900; font-size: 18px; color: #0a1931;">
                <span>Total:</span>
                <span id="cart-side-total" style="color: #ee4d2d;">R$ 0,00</span>
            </div>
            
            <button onclick="irParaCheckout()" style="width: 100%; background: #0a1931; color: #dfaf12; border: none; padding: 15px; border-radius: 12px; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 10px rgba(10, 25, 49, 0.2);">
                AVANÇAR PARA PAGAMENTO <i class="fas fa-arrow-right" style="margin-left: 5px;"></i>
            </button>
        </div>
    </div>

    <div id="cart-step-2" style="display: none; flex-direction: column; flex-grow: 1; overflow: hidden; background: #f8fafc;">
        
        <div style="padding: 15px 20px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center;">
            <button onclick="voltarParaCarrinho()" style="background: none; border: none; color: #0a1931; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 16px;">
                <i class="fas fa-arrow-left"></i> Voltar à Sacola
            </button>
        </div>
        
        <div style="flex-grow: 1; overflow-y: auto; padding: 20px;">
            <h4 style="margin: 0 0 15px 0; color: #0f172a;"><i class="fas fa-map-marker-alt" style="color: #ee4d2d;"></i> Dados de Entrega</h4>
            <input type="text" id="checkout-name" placeholder="Seu Nome Completo" style="width: 100%; padding: 14px; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 10px; font-size: 14px; outline: none;">
            <input type="text" id="checkout-phone" placeholder="Seu Telefone / WhatsApp" style="width: 100%; padding: 14px; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 10px; font-size: 14px; outline: none;">
            <textarea id="checkout-address" placeholder="Endereço de Entrega (Rua, Bairro, Referência)" rows="3" style="width: 100%; padding: 14px; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 25px; font-size: 14px; outline: none; font-family: inherit; resize: none;"></textarea>

            <h4 style="margin: 0 0 15px 0; color: #0f172a;"><i class="fas fa-wallet" style="color: #ee4d2d;"></i> Forma de Pagamento</h4>
            
            <div style="background: white; border: 2px solid #24c703; border-radius: 12px; padding: 15px; margin-bottom: 15px; position: relative;">
                <div style="position: absolute; top: -10px; right: 15px; background: #24c703; color: white; font-size: 10px; font-weight: 900; padding: 3px 8px; border-radius: 20px;">RECOMENDADO</div>
                
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <i class="fab fa-pix" style="color: #24c703; font-size: 24px;"></i>
                    <span style="font-weight: 900; color: #0a1931;">PIX / Transferência</span>
                </div>
                
                <p style="font-size: 12px; color: #64748b; margin: 0 0 10px 0;">Copie a chave, faça o pagamento no seu banco e finalize o pedido aqui para liberação imediata!</p>
                
                <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span id="chave-pix-loja" style="font-size: 13px; font-weight: bold; color: #0f172a;">sua-chave-pix-aqui@email.com</span>
                    <button onclick="copiarPixLoja()" style="background: #0a1931; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold;">
                        COPIAR
                    </button>
                </div>
            </div>

            <div style="background: white; border: 1px solid #cbd5e1; border-radius: 12px; padding: 15px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-money-bill-wave" style="color: #64748b; font-size: 20px;"></i>
                    <span style="font-weight: 900; color: #64748b;">Pagar na Entrega (Em breve)</span>
                </div>
            </div>
        </div>
        
        <div style="padding: 20px; border-top: 1px solid #e2e8f0; background: white; padding-bottom: 90px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: 900; font-size: 18px; color: #0a1931;">
                <span>Total a Pagar:</span>
                <span id="checkout-side-total" style="color: #ee4d2d;">R$ 0,00</span>
            </div>
            
            <button onclick="processarCompraDaLoja()" id="btn-final-buy" style="width: 100%; background: #24c703; color: white; border: none; padding: 16px; border-radius: 12px; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 10px rgba(36, 199, 3, 0.3); display: flex; justify-content: center; align-items: center; gap: 8px;">
                FINALIZAR PEDIDO <i class="fas fa-check-circle"></i>
            </button>
        </div>
    </div>
</div>

<script>
function copiarPixLoja() {
    const chave = document.getElementById('chave-pix-loja').innerText;
    navigator.clipboard.writeText(chave).then(() => {
        alert("✅ Chave PIX copiada! Vá ao seu banco, pague e volte aqui para clicar em FINALIZAR PEDIDO.");
    });
}
</script>


function renderizarModalPedidosLoja(orders) {
    // Verifica se o modal já existe, se não, cria um novo
    let modal = document.getElementById('modal-meus-pedidos');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-meus-pedidos';
        modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); z-index: 30000; display: flex; justify-content: center; align-items: center;";
        document.body.appendChild(modal);
    }

    let html = `
    <div style="background: white; width: 90%; max-width: 500px; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; flex-direction: column; max-height: 80vh;">
        <div style="background: #0a1931; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; color: #dfaf12;"><i class="fas fa-receipt"></i> Minhas Compras</h3>
            <button onclick="document.getElementById('modal-meus-pedidos').style.display='none'" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">&times;</button>
        </div>
        <div style="padding: 20px; overflow-y: auto; flex-grow: 1; background: #f4f7f6;">`;

    if (orders.length === 0) {
        html += `<div style="text-align: center; padding: 30px; color: #666;"><i class="fas fa-box-open" style="font-size: 40px; margin-bottom: 10px; color: #ccc;"></i><p>Você ainda não tem compras na loja.</p></div>`;
    } else {
        orders.forEach(o => {
            html += `
            <div style="background: white; border-radius: 10px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-left: 4px solid #dfaf12;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong>Pedido #${o.id}</strong>
                    <span style="color: #d32f2f; font-weight: bold;">${o.currency_used} ${o.total_brl.toFixed(2)}</span>
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 10px;">Método: <strong>${o.payment_method.toUpperCase()}</strong></div>
                <div style="font-size: 13px;">`;
            
            o.items.forEach(item => {
                html += `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 4px 0;">
                            <span>${item.quantity}x ${item.product_name}</span>
                         </div>`;
            });
            html += `</div></div>`;
        });
    }

    html += `</div></div>`;
    modal.innerHTML = html;
    modal.style.display = 'flex';
}

// 2. Abre o Pop-up de Detalhes do Produto
function abrirDetalhesProduto(idProduto, simboloMoeda, precoConvertido) {
    const produto = produtosOriginais.find(p => p.id === idProduto);
    if (!produto) return;

    // Preenche as informações na tela
    document.getElementById('detail-image').src = produto.image_url || '/logo.png';
    document.getElementById('detail-category').innerText = produto.category;
    document.getElementById('detail-name').innerText = produto.name;
    document.getElementById('detail-price').innerText = `${simboloMoeda} ${precoConvertido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('detail-desc').innerText = produto.description || "Sem descrição detalhada disponível.";
    
    const stockEl = document.getElementById('detail-stock');
    if (produto.stock > 0) {
        stockEl.innerHTML = `<i class="fas fa-box"></i> Restam ${produto.stock} unid.`;
        stockEl.style.color = '#28a745'; // Verde
    } else {
        stockEl.innerHTML = `<i class="fas fa-times-circle"></i> Esgotado`;
        stockEl.style.color = '#dc3545'; // Vermelho
    }

    // Configura o botão de comprar
    const btnAdd = document.getElementById('btn-add-detail');
    btnAdd.onclick = (e) => {
        adicionarAoCarrinho(produto.id, e);
        fecharDetalhesProduto();
    };

    // Mostra a tela
    document.getElementById('modal-product-details').style.display = 'block';
}

function fecharDetalhesProduto() {
    document.getElementById('modal-product-details').style.display = 'none';
}


<div id="modal-my-store-orders" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; backdrop-filter: blur(5px);">
    <div class="modal-content" style="background:#f4f7f6; margin:10% auto; border-radius:20px; width:90%; max-width:500px; position:relative; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.3); display: flex; flex-direction: column; max-height: 80vh;">
        
        <div style="background: #0a1931; padding: 20px; color: white; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; color: #dfaf12;"><i class="fas fa-shopping-bag"></i> Minhas Compras</h3>
            <span onclick="closeModal('modal-my-store-orders')" style="cursor:pointer; font-size:24px; font-weight:bold;">&times;</span>
        </div>
      
        <div id="my-store-orders-list" style="padding: 20px; overflow-y: auto; flex-grow: 1;">
            </div>
    </div>
</div>
<div id="modal-product-details" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:25000; backdrop-filter: blur(5px);">
    
    <div class="modal-content" style="background: #f4f7f6; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 500px; border-radius: 25px 25px 0 0; overflow: hidden; display: flex; flex-direction: column; max-height: 90vh; animation: slideUp 0.3s ease-out;">
        
        <div style="position: relative; background: #fff;">
            <button onclick="fecharDetalhesProduto()" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.8); border: none; width: 35px; height: 35px; border-radius: 50%; font-size: 18px; color: #333; cursor: pointer; z-index: 2; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"><i class="fas fa-times"></i></button>
<img id="detail-image" src="" onclick="abrirImagemTelaCheia(this.src)" style="width: 100%; height: 350px; object-fit: cover; border-bottom: 1px solid #eee; cursor: zoom-in;">
        </div>

        <div style="padding: 20px; overflow-y: auto; flex-grow: 1; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <div>
                    <span id="detail-category" style="background: #dfaf12; color: #0a1931; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 900; text-transform: uppercase;"></span>
                    <h2 id="detail-name" style="margin: 8px 0; color: #0a1931; font-size: 20px; font-weight: bold; line-height: 1.2;"></h2>
                </div>
                <div style="text-align: right;">
                    <h2 id="detail-price" style="margin: 0; color: #d32f2f; font-size: 24px; font-weight: 900;"></h2>
                </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; font-size: 12px; color: #666;">
                <span style="color: #ffc107;"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i> (99+ vendidos)</span>
                <span>•</span>
                <span id="detail-stock" style="color: #28a745; font-weight: bold;"><i class="fas fa-box"></i> Em Estoque</span>
            </div>

            <h4 style="color: #0a1931; font-size: 14px; margin-bottom: 5px;">Descrição do Produto:</h4>
            <p id="detail-desc" style="color: #555; font-size: 13px; line-height: 1.6; margin-bottom: 20px;"></p>
            
            <div style="display: flex; gap: 10px; border-top: 1px solid #eee; padding-top: 15px;">
                <div style="flex: 1; text-align: center; font-size: 11px; color: #666;"><i class="fas fa-shield-alt" style="font-size: 20px; color: #39dac4; margin-bottom: 5px; display: block;"></i> Compra Segura</div>
                <div style="flex: 1; text-align: center; font-size: 11px; color: #666;"><i class="fas fa-plane" style="font-size: 20px; color: #0a1931; margin-bottom: 5px; display: block;"></i> Envio Rápido</div>
                <div style="flex: 1; text-align: center; font-size: 11px; color: #666;"><i class="fas fa-undo" style="font-size: 20px; color: #dfaf12; margin-bottom: 5px; display: block;"></i> Garantia</div>
            </div>
        </div>

        <div style="padding: 15px 20px; background: white; border-top: 1px solid #eee; box-shadow: 0 -5px 10px rgba(0,0,0,0.03);">
            <button id="btn-add-detail" style="width: 100%; background: #0a1931; color: #dfaf12; border: none; padding: 16px; border-radius: 12px; font-weight: 900; font-size: 16px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 10px; transition: 0.3s;">
                ADICIONAR À SACOLA <i class="fas fa-shopping-bag"></i>
            </button>
        </div>
    </div>
</div>


<div id="floating-carousel-container" style="position: fixed; bottom: 120px; right: 20px; width: 110px; height: 160px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 20px rgba(0,0,0,0.3); z-index: 9999; border: 2px solid #dfaf12; background: #fff;">
    <button onclick="this.parentElement.style.display='none'" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 10px; cursor: pointer; z-index: 10;">X</button>
    <img id="carousel-dynamic-img" src="" style="width: 100%; height: 100%; object-fit: cover; transition: opacity 0.5s ease;">
    <div style="position: absolute; bottom: 0; left: 0; width: 100%; background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 15px 5px 5px 5px;">
        <p id="carousel-dynamic-name" style="color: white; font-size: 9px; font-weight: bold; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></p>
        <span style="color: #dfaf12; font-size: 10px; font-weight: 900;">VER AGORA</span>
    </div>
</div>

<div id="marketing-toast" style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-150px); background: rgba(10, 25, 49, 0.95); color: white; padding: 10px 20px; border-radius: 30px; display: flex; align-items: center; gap: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 30000; transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); backdrop-filter: blur(5px); border: 1px solid #dfaf12; width: 90%; max-width: 350px;">
    <i class="fas fa-shopping-bag" style="color: #dfaf12; font-size: 18px;"></i>
    <span id="marketing-toast-text" style="font-size: 12px; font-weight: bold;"></span>
</div>
<div id="floating-carousel-container" style="position: fixed; bottom: 120px; right: 20px; width: 110px; height: 160px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 20px rgba(0,0,0,0.3); z-index: 9999; border: 2px solid #ee4d2d; background: #fff;">
    <button onclick="this.parentElement.style.display='none'" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 10px; cursor: pointer; z-index: 10;">X</button>
    <img id="carousel-dynamic-img" src="" style="width: 100%; height: 100%; object-fit: cover; transition: opacity 0.5s ease;">
    <div style="position: absolute; bottom: 0; left: 0; width: 100%; background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 15px 5px 5px 5px; text-align: center;">
        <p id="carousel-dynamic-name" style="color: white; font-size: 9px; font-weight: bold; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></p>
        <span style="color: #ee4d2d; font-size: 10px; font-weight: 900;">VER OFERTA</span>
    </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>


<style>
    /* Dá espaço no final da página para o menu não esconder os produtos */
    body { padding-bottom: 85px; }

    /* O NOVO MENU INFERIOR MÁGICO (VIDRO TRANSPARENTE) */
    .bottom-nav-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        
        /* 🧊 O SEGREDO DO VIDRO COMEÇA AQUI */
        background: rgba(255, 255, 255, 0.35); /* Muito mais transparente (35%) */
        backdrop-filter: blur(12px); /* Efeito de vidro embaçado */
        -webkit-backdrop-filter: blur(12px); /* Para funcionar perfeito em iPhones/Safari */
        /* ================================ */

        display: flex;
        justify-content: space-around;
        align-items: center;
        padding: 12px 5px;
        padding-bottom: env(safe-area-inset-bottom, 20px); /* Para iPhones */
        box-shadow: 0 -8px 25px rgba(0,0,0,0.1); /* Sombra mais suave para destacar o vidro */
        z-index: 10000;
        border-top: 1px solid rgba(255, 255, 255, 0.7); /* Bordinha branca brilhante do vidro */
        border-radius: 25px 25px 0 0; /* Cantos arredondados no topo */
    }

    .bottom-nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-decoration: none;
        color: #64748b; /* Cinza um pouquinho mais escuro para ler bem no vidro */
        font-size: 10px;
        font-weight: 800;
        cursor: pointer;
        background: transparent;
        border: none;
        width: 20%;
        /* Transição elástica super moderna */
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .bottom-nav-item i {
        font-size: 22px;
        margin-bottom: 4px;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    /* Quando ativado (clicado), fica laranja, sobe e cresce um pouquinho */
    .bottom-nav-item.active { color: #ee4d2d; }
    .bottom-nav-item.active i { 
        transform: translateY(-4px) scale(1.15); 
        color: #ee4d2d;
        text-shadow: 0 4px 10px rgba(238, 77, 45, 0.4); /* Brilho laranja */
    }

    /* O contador da sacola modernizado */
    #bottom-cart-counter {
        position: absolute; 
        top: -6px; 
        right: 12px; 
        background: #dfaf12; /* Dourado/Amarelo de destaque */
        color: #0a1931; 
        font-size: 10px; 
        font-weight: 900; 
        width: 18px; 
        height: 18px; 
        border-radius: 50%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        border: 2px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: transform 0.3s;
    }

    /* ANIMAÇÃO DA SACOLA QUANDO COMPRA ALGO */
    @keyframes puloSacola {
        0% { transform: scale(1); }
        40% { transform: scale(1.3) translateY(-5px); }
        60% { transform: scale(0.9); }
        80% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    .animar-sacola-compra {
        animation: puloSacola 0.6s ease-in-out;
        color: #dfaf12 !important; /* Pisca dourado */
    }
</style>

// =======================================================
// 🛒 DESENHAR SACOLA E CALCULAR TOTAL (PASSO 1 E 2)
// =======================================================
function renderizarCarrinhoLateral() {
    const container = document.getElementById('cart-items-container');
    const totalStep1 = document.getElementById('cart-side-total'); // Total da tela 1
    const totalStep2 = document.getElementById('checkout-side-total'); // Total da tela de pagamento
    
    if (!container) return;

    // Pega a moeda que o cliente escolheu lá no topo
    const moeda = document.getElementById('currency-selector') ? document.getElementById('currency-selector').value : 'BRL';
    const cotacoes = window.COTACAO || { XOF: 120, EUR: 0.18, USD: 0.20 };
    
    let totalBRL = 0;
    let html = '';

    // Agrupa os itens para não repetir o mesmo produto várias vezes (mostra a quantidade)
    let itensAgrupados = {};
    itensNoCarrinho.forEach(p => {
        if(itensAgrupados[p.id]) {
            itensAgrupados[p.id].qtd += 1;
        } else {
            itensAgrupados[p.id] = { ...p, qtd: 1 };
        }
        totalBRL += parseFloat(p.price_brl);
    });

    // Se a sacola estiver vazia
    if (itensNoCarrinho.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 50px 20px; color: #94a3b8;"><i class="fas fa-shopping-bag fa-4x" style="margin-bottom: 15px; opacity: 0.3;"></i><p>A sua sacola está vazia.</p></div>';
        if(totalStep1) totalStep1.innerText = 'R$ 0,00';
        if(totalStep2) totalStep2.innerText = 'R$ 0,00';
        return;
    }

    // Desenha os produtos agrupados
    Object.values(itensAgrupados).forEach(item => {
        let precoFinal = item.price_brl;
        let simbolo = 'R$';

        if (moeda === 'CFA') { precoFinal = item.price_brl * cotacoes.XOF; simbolo = 'XOF'; }
        else if (moeda === 'EUR') { precoFinal = item.price_brl * cotacoes.EUR; simbolo = '€'; }
        else if (moeda === 'USD') { precoFinal = item.price_brl * cotacoes.USD; simbolo = '$'; }

        html += `
        <div style="display: flex; align-items: center; background: white; padding: 15px; margin-bottom: 12px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
            <img src="${item.image_url || '/logo.png'}" style="width: 65px; height: 65px; border-radius: 8px; object-fit: cover; margin-right: 15px;">
            <div style="flex-grow: 1;">
                <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #0a1931; line-height: 1.2;">${item.name}</h4>
                <div style="color: #ee4d2d; font-weight: 900; font-size: 15px;">${simbolo} ${(precoFinal * item.qtd).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                <button onclick="removerDoCarrinho(${item.id})" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px;"><i class="fas fa-trash-alt"></i></button>
                <div style="display: flex; align-items: center; background: #f8fafc; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1;">
                    <button onclick="alterarQuantidadeCarrinho(${item.id}, 'diminuir')" style="background: none; border: none; padding: 4px 10px; cursor: pointer; color: #0f172a; font-weight: bold;">-</button>
                    <span style="font-weight: 900; font-size: 12px; width: 22px; text-align: center; color: #0f172a;">${item.qtd}</span>
                    <button onclick="alterarQuantidadeCarrinho(${item.id}, 'aumentar')" style="background: none; border: none; padding: 4px 10px; cursor: pointer; color: #0f172a; font-weight: bold;">+</button>
                </div>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;

    // Converte o Total Final para a moeda certa
    let totalMoeda = totalBRL;
    let simboloTotal = 'R$';
    if (moeda === 'CFA') { totalMoeda = totalBRL * cotacoes.XOF; simboloTotal = 'XOF'; }
    else if (moeda === 'EUR') { totalMoeda = totalBRL * cotacoes.EUR; simboloTotal = '€'; }
    else if (moeda === 'USD') { totalMoeda = totalBRL * cotacoes.USD; simboloTotal = '$'; }

    const textoFinal = `${simboloTotal} ${totalMoeda.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    
    // Atualiza a tela 1 (Sacola) E a tela 2 (Pagamento)
    if(totalStep1) totalStep1.innerText = textoFinal;
    if(totalStep2) totalStep2.innerText = textoFinal; 
}


function adicionarAoCarrinho(productId, event) {
    const produtoOriginal = produtosOriginais.find(p => p.id === productId);
    if (!produtoOriginal) return;

    if (produtoOriginal.stock <= 0) {
        const querEncomendar = confirm("⏳ A Cicí informa: Este produto esgotou e está a ser produzido!\n\nDeseja solicitar uma reserva para garantir o seu na próxima remessa?");
        if (!querEncomendar) return; 
    } else {
        const qtdNoCarrinho = itensNoCarrinho.filter(item => item.id === productId).length;
        if (qtdNoCarrinho >= produtoOriginal.stock) {
            alert(`Você já colocou todas as ${produtoOriginal.stock} unidades disponíveis na sacola! 🛍️`);
            return;
        }
    }

    // 👕 VARIAÇÕES DE PRODUTO
    let nomeComVariacao = produtoOriginal.name;
    if (produtoOriginal.category === 'Roupas' || produtoOriginal.category === 'Cabelos/Perucas') {
        const escolha = prompt(`Você está comprando: ${produtoOriginal.name}\n\nDigite a Cor ou Tamanho desejado (Ex: P, M, Loiro, Preto):`);
        if (escolha === null) return; 
        if (escolha.trim() !== '') {
            nomeComVariacao = `${produtoOriginal.name} (${escolha})`;
        }
    }

    const produtoParaSacola = { ...produtoOriginal, name: nomeComVariacao };
    itensNoCarrinho.push(produtoParaSacola);
    
    atualizarContadorCarrinho();
    
    // 👇 MÁGICA 1: SALVA O CARRINHO NO CELULAR DO CLIENTE
    salvarCarrinhoNaMemoriaDoCelular(); 

    if (event && event.currentTarget) {
        fazerProdutoVoar(produtoParaSacola.image_url, event.currentTarget);
    }

    setTimeout(() => {
        const cart = document.getElementById('side-cart');
        if (cart && cart.style.right !== '0px') {
            toggleCarrinho();
        } else {
            renderizarCarrinhoLateral();
        }
    }, 800);
}

function removerDoCarrinho(productId) {
    const index = itensNoCarrinho.findIndex(item => item.id === productId);
    if (index > -1) {
        itensNoCarrinho.splice(index, 1);
        renderizarCarrinhoLateral();
        atualizarContadorCarrinho();
        
        // 👇 MÁGICA 2: ATUALIZA O CELULAR DO CLIENTE APÓS REMOVER
        salvarCarrinhoNaMemoriaDoCelular(); 
    }
}


function renderizarProdutos() {
    const grid = document.getElementById('store-products-grid');
    if (!grid) return;
    
    // Fallback caso não encontre o seletor na hora
    const moedaElement = document.getElementById('currency-selector');
    const moeda = moedaElement ? moedaElement.value : 'BRL';
    let html = '';

    produtosOriginais.forEach(p => {
        let precoFinal = p.price_brl;
        let simbolo = 'R$';

        // Lógica da cotação usando a variável global window.COTACAO que criámos mais cedo
        const cotacoes = window.COTACAO || { XOF: 120, EUR: 0.18, USD: 0.20 };
        
        if (moeda === 'CFA') { precoFinal = p.price_brl * cotacoes.XOF; simbolo = 'XOF'; }
        else if (moeda === 'EUR') { precoFinal = p.price_brl * cotacoes.EUR; simbolo = '€'; }
        else if (moeda === 'USD') { precoFinal = p.price_brl * cotacoes.USD; simbolo = '$'; }

        // Verifica se este produto está nos favoritos do cliente
        let favs = JSON.parse(localStorage.getItem('loja_favoritos')) || [];
        let isFav = favs.includes(p.id);
        let corCoracao = isFav ? '#ee4d2d' : '#ccc';

        html += `
    <div class="product-card-premium" style="position: relative; cursor: pointer; display: flex; flex-direction: column;" onclick="abrirDetalhesProduto(${p.id}, '${simbolo}', ${precoFinal})">
        <div class="promo-badge">Oferta</div>
        
        <div id="fav-${p.id}" class="fav-btn" onclick="toggleFavorito(${p.id}); event.stopPropagation();" style="color: ${corCoracao};">
            <i class="fas fa-heart"></i>
        </div>
        
        <div class="img-container">
            <img src="${p.image_url || '/logo.png'}" alt="${p.name}" style="width: 100%; height: 160px; object-fit: cover;">
        </div>

        <div class="product-details" style="display: flex; flex-direction: column; flex-grow: 1;">
            <span class="product-cat">${p.category}</span>
            <h3 class="product-title" style="margin-bottom: 5px; height: 36px; overflow: hidden;">${p.name}</h3>
            
            <div class="product-stars" style="margin-bottom: 10px;">
                <i class="fas fa-star" style="color: #f59e0b;"></i>
                <i class="fas fa-star" style="color: #f59e0b;"></i>
                <i class="fas fa-star" style="color: #f59e0b;"></i>
                <i class="fas fa-star" style="color: #f59e0b;"></i>
                <i class="fas fa-star-half-alt" style="color: #f59e0b;"></i>
                <span style="font-size: 11px; color: #94a3b8;">(99+)</span>
            </div>

            <div style="margin-top: auto;">
                <div class="price-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span class="price-amount" style="color: #ee4d2d; font-weight: 900; font-size: 16px;">${simbolo} ${precoFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
                
                <div style="display: flex; gap: 6px; width: 100%;">
                    <button class="add-btn-premium" onclick="adicionarAoCarrinho(${p.id}, event); event.stopPropagation();" style="flex: 1; border-radius: 8px; font-size: 13px; font-weight: bold; padding: 10px 0; display: flex; justify-content: center; align-items: center; gap: 5px;">
                        <i class="fas fa-cart-plus"></i> Adicionar
                    </button>
                    
                    <button onclick="enviarDuvidaWhatsApp('${p.name.replace(/'/g, "\\'")}'); event.stopPropagation();" style="background: #25d366; color: white; border: none; width: 42px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3);">
                        <i class="fab fa-whatsapp" style="font-size: 18px;"></i>
                    </button>
                </div>
            </div>

        </div>
    </div>
    `;
    });
    grid.innerHTML = html;
}

// A Lógica do Voo Nível NASA
function fazerProdutoVoar(imgUrl, elementoOrigem) {
    // A foto que vai voar (padrão é logo se não tiver foto)
    const fotoUrl = imgUrl || '/logo.png';
    
    // Cria o elemento da imagem voadora no HTML
    const voadora = document.createElement('img');
    voadora.src = fotoUrl;
    voadora.classList.add('flying-product');
    document.body.appendChild(voadora);

    // Posição do botão clicado (Origem)
    const rectOrigem = elementoOrigem.getBoundingClientRect();
    // Posição do Carrinho da Cicí (Destino)
    const rectDestino = document.getElementById('floating-cici-cart').getBoundingClientRect();

    // Define a posição inicial exata da imagem voadora (em cima do botão)
    voadora.style.left = `${rectOrigem.left + rectOrigem.width/2 - 25}px`;
    voadora.style.top = `${rectOrigem.top + rectOrigem.height/2 - 25}px`;
    voadora.style.transform = 'scale(0.5)'; // Começa pequena

    // 🚀 O VOO: Usa um timeout bem curto para o navegador registrar a posição inicial antes de animar
    setTimeout(() => {
        // Define o destino final e transformações durante o voo (roda e cresce)
        voadora.style.left = `${rectDestino.left + rectDestino.width/2 - 25}px`;
        voadora.style.top = `${rectDestino.top + rectDestino.height/2 - 25}px`;
        voadora.style.transform = 'scale(1) rotate(360deg)';
        voadora.style.opacity = '0.5'; // Vai sumindo
    }, 10);

    // 🏁 A CHEGADA: O que acontece quando o produto "pousa" no carrinho
    setTimeout(() => {
        // 1. Remove a imagem voadora
        voadora.remove();

        // 2. MÁGICA DA SACOLA: O botão inteiro dá um "pulo" quando o item cai
        const carrinhoFlutuante = document.getElementById('floating-cici-cart');
        
        if (carrinhoFlutuante) {
            // Vamos usar a mesma classe que você já tinha, mas agora no botão principal
            carrinhoFlutuante.classList.add('cart-eat');

            // Remove a animação para poder tocar de novo no próximo produto
            setTimeout(() => {
                carrinhoFlutuante.classList.remove('cart-eat');
            }, 600);
        }

        // 3. Atualiza o contador
        atualizarContadorCarrinho();
        
    }, 800); // Tempo exato do voo (igual ao CSS transition)
}

// =======================================================
// 🛒 ATUALIZAR CONTADORES DA SACOLA (TOTALMENTE BLINDADO)
// =======================================================
function atualizarContadorCarrinho() {
    // 1. Garante que a variável existe
    const qtd = (typeof itensNoCarrinho !== 'undefined' && itensNoCarrinho) ? itensNoCarrinho.length : 0;

    // 2. Blinda o contador flutuante
    const contadorPrincipal = document.getElementById('cart-counter');
    if (contadorPrincipal) {
        contadorPrincipal.innerText = qtd;
        if (qtd > 0) {
            contadorPrincipal.classList.remove('hidden');
            contadorPrincipal.style.display = 'flex';
        } else {
            contadorPrincipal.classList.add('hidden');
            contadorPrincipal.style.display = 'none';
        }
    }

    // 3. Blinda o contador de baixo
    const contadorBaixo = document.getElementById('bottom-cart-counter');
    if (contadorBaixo) {
        contadorBaixo.innerText = qtd;
        if (qtd > 0) {
            contadorBaixo.classList.remove('hidden');
            contadorBaixo.style.display = 'flex';
        } else {
            contadorBaixo.classList.add('hidden');
            contadorBaixo.style.display = 'none';
        }
    }

    // 4. Blinda o contador VIP
    const contadorVip = document.getElementById('cart-counter-vip');
    if (contadorVip) {
        contadorVip.innerText = qtd;
        if (qtd > 0) {
            contadorVip.style.display = 'flex';
        } else {
            contadorVip.style.display = 'none';
        }
    }
}
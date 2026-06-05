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

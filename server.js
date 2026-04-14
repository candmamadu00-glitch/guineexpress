require('dotenv').config(); // Lê o arquivo .env
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit'); // <-- NOVA IMPORTAÇÃO AQUI
const compression = require('compression'); 
const MercadoPagoConfig = require('mercadopago').MercadoPagoConfig;
const Payment = require('mercadopago').Payment;
const Preference = require('mercadopago').Preference;
const cron = require('node-cron'); 
const path = require('path');      
const SQLiteStore = require('connect-sqlite3')(session);
const db = require('./database'); 
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const webpush = require('web-push');
const app = express(); // <-- O App é criado aqui
const ExcelJS = require('exceljs');
// === NOVAS IMPORTAÇÕES DO FFMPEG (CONVERSOR DE VÍDEO) ===
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
// ==========================================
// 🛡️ 1. PROTEÇÃO CONTRA HACKERS (HELMET)
// ==========================================
app.use(helmet({
    contentSecurityPolicy: false, // Desativado para não bloquear seus scripts e imagens
    crossOriginEmbedderPolicy: false
}));

// ==========================================
// 🛡️ 2. PROTEÇÃO CONTRA QUEDA (DDOS)
// ==========================================
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 300, // Máximo de 300 requisições por IP
    message: { success: false, msg: "⚠️ Muitas requisições. Sistema de segurança ativado. Aguarde alguns minutos." }
});
app.use(generalLimiter);

// ==========================================
// 🛡️ 3. PROTEÇÃO CONTRA ROBÔS (CADASTRO E LOGIN)
// ==========================================
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // Máximo de 10 tentativas
    message: { success: false, msg: "🚫 Muitas tentativas de acesso. Seu IP foi bloqueado por segurança. Tente novamente em 1 hora." }
});

app.use('/api/user/register', authLimiter); 
app.use('/api/user/login', authLimiter); 
app.use('/api/admin/register-client', authLimiter);

// Configuração do caminho da sessão
const SESSION_PATH = fs.existsSync('/data') ? '/data/session-admin' : './session-admin';

let clientZap = null;
// Configuração de identidade para as Notificações
webpush.setVapidDetails(
    'mailto:candemamadu09@gmail.com', 
    'BHz6ezs_RX0nln77mT3xRFrBpf6WhAWwiedXWOwDoRl90r32Iwmgx4ROqxzLRWhwXHc_pvIejfWcKNOaPNFzEsY', // Public Key
    'o7cuX6wivGgnxOoLwa__pYUFH66B3R16hzwtr3yavV4' // Private Key
);

// ========================================================
// PATCH FORÇADO: GARANTE QUE AS COLUNAS DE VOLUMES EXISTEM
// ========================================================
db.run("ALTER TABLE boxes ADD COLUMN volumes INTEGER DEFAULT 1", (err) => {
    if (!err) console.log("✅ Coluna 'volumes' criada na tabela boxes!");
});
db.run("ALTER TABLE orders ADD COLUMN volumes INTEGER DEFAULT 1", (err) => {
    if (!err) console.log("✅ Coluna 'volumes' criada na tabela orders!");
});

// ==================================================================
// CONFIGURAÇÃO DO DISCO PERMANENTE (FOTOS E VÍDEOS)
// ==================================================================
// 1. Descobre se está no Render (/data) ou no seu PC
const baseStorageFolder = fs.existsSync('/data') ? '/data' : __dirname;

// 2. Define os caminhos exatos
const uploadsFolder = path.join(baseStorageFolder, 'uploads');
const videosFolder = path.join(uploadsFolder, 'videos');

// 3. Cria as pastas se elas não existirem
if (!fs.existsSync(uploadsFolder)) fs.mkdirSync(uploadsFolder, { recursive: true });
if (!fs.existsSync(videosFolder)) fs.mkdirSync(videosFolder, { recursive: true });

// 4. Libera o acesso para o navegador poder ver as fotos e vídeos
app.use('/uploads', express.static(uploadsFolder));
// ==============================================================
// 🏦 🪄 GERADOR DE PIX COPIA E COLA DINÂMICO (CUSTO ZERO)
// ==============================================================
function gerarPixCopiaECola(chavePix, nomeTitular, cidadeTitular, valorFatura, idFatura) {
    function pad(str, length) { return str.toString().padStart(length, '0'); }

    // Limpa os dados para evitar erros no banco
    const nome = nomeTitular.substring(0, 25).normalize("NFD").replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase();
    const cidade = cidadeTitular.substring(0, 15).normalize("NFD").replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase();
    const txid = idFatura ? idFatura.toString().substring(0, 25) : "***";

    const payloadFormat = "000201";
    const merchantAccount = `0014br.gov.bcb.pix01${pad(chavePix.length, 2)}${chavePix}`;
    const merchantAccountField = `26${pad(merchantAccount.length, 2)}${merchantAccount}`;
    const merchantCategory = "52040000";
    const transactionCurrency = "5303986";
    
    // Trava o valor no código
    const valorStr = parseFloat(valorFatura).toFixed(2);
    const transactionAmount = `54${pad(valorStr.length, 2)}${valorStr}`;
    
    const countryCode = "5802BR";
    const merchantNameField = `59${pad(nome.length, 2)}${nome}`;
    const merchantCityField = `60${pad(cidade.length, 2)}${cidade}`;
    
    const additionalData = `05${pad(txid.length, 2)}${txid}`;
    const additionalDataField = `62${pad(additionalData.length, 2)}${additionalData}`;
    
    // Junta tudo
    let payload = `${payloadFormat}${merchantAccountField}${merchantCategory}${transactionCurrency}${transactionAmount}${countryCode}${merchantNameField}${merchantCityField}${additionalDataField}6304`;

    // Calcula a assinatura digital (CRC16) obrigatória do Banco Central
    let crc = 0xFFFF;
    for (let c = 0; c < payload.length; c++) {
        crc ^= payload.charCodeAt(c) << 8;
        for (let i = 0; i < 8; i++) {
            if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
            else crc = crc << 1;
        }
    }
    let hex = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    
    return payload + hex;
}
// ==================================================================
// CONFIGURAÇÃO DO MULTER (SALVAR ARQUIVOS)
// ==================================================================
// Para Fotos (Perfil, Comprovantes)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsFolder);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Para Vídeos
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, videosFolder),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadVideo = multer({ storage: videoStorage });

// ==================================================================
// CONFIGURAÇÃO DE EMAIL (GMAIL)
// ==================================================================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false 
    }
});

// Função Auxiliar para Enviar Email
async function sendEmailHtml(to, subject, title, message) {
    if (!to || to.includes('undefined')) return;

    const senderEmail = process.env.EMAIL_USER; 

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #000; padding: 20px; text-align: center;">
            <h1 style="color: #d4af37; margin: 0;">GUINEEXPRESS</h1>
            <p style="color: #fff; font-size: 10px; margin: 0;">LOGÍSTICA INTERNACIONAL</p>
        </div>
        <div style="padding: 30px; background-color: #fff; color: #333;">
            <h2 style="color: #0a1931; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">${title}</h2>
            <p style="font-size: 16px; line-height: 1.6;">${message}</p>
            <br>
            <a href="${process.env.BASE_URL || 'http://seusite.com'}" style="background-color: #28a745; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Acessar Minha Conta</a>
        </div>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #777;">
            <p>Guineexpress Ltda</p>
            <p>Não responda a este e-mail automático.</p>
        </div>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Guineexpress Logística" <${senderEmail}>`,
            to: to,
            subject: subject,
            html: htmlContent
        });
        console.log(`📧 Email enviado para ${to}`);
    } catch (error) {
        console.error("❌ Erro ao enviar email:", error);
    }
}
// ==========================================
// 🧠 INTELIGÊNCIA ARTIFICIAL DA CICÍ (GEMINI) - FUNÇÃO CONVERSORA
// ==========================================
// Função para converter a imagem para a IA ler
function fileToGenerativePart(filePath, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType
        },
    };
}
// Função para gravar logs automaticamente (COM NOME E EMAIL CORRETOS)
function logSystemAction(req, action, details) {
    // 🔥 Puxando as informações do usuário corretamente
    const userLogado = req.session.user;
    const user = userLogado ? `${userLogado.name} (${userLogado.email})` : 'Sistema/Desconhecido';
    
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Desconhecido';

    db.run("INSERT INTO system_logs (user_name, action, details, ip_address) VALUES (?, ?, ?, ?)", 
        [user, action, details, ip], 
        (err) => {
            if(err) console.error("Erro ao salvar log no sistema:", err);
        }
    );
}

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN }); 
const payment = new Payment(client);

// Segurança e Performance
app.use(helmet({ contentSecurityPolicy: false })); 
app.use(compression()); 

// Verificação de segurança do banco
if (!db || typeof db.get !== 'function') {
    console.error("ERRO CRÍTICO: Banco de dados não carregou. Verifique o final do arquivo database.js"); 
    process.exit(1);
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));
app.use(session({
store: new SQLiteStore({ db: 'sessions.db', dir: baseStorageFolder }),
    secret: process.env.SESSION_SECRET || 'segredo_padrao',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 7, 
        secure: false 
    } 
}));
// 🛡️ Middleware: Só deixa passar se for ADMIN
const adminOnly = (req, res, next) => {
    if (req.session.userId && req.session.role === 'admin') {
        return next();
    }
    res.redirect('/login.html?error=acesso_negado');
};

// 🛡️ Middleware: Só deixa passar se for FUNCIONÁRIO ou ADMIN
const employeeOnly = (req, res, next) => {
    if (req.session.userId && (req.session.role === 'employee' || req.session.role === 'admin')) {
        return next();
    }
    res.redirect('/login.html?error=acesso_negado');
};

// 🛡️ Middleware: Só deixa passar se estiver LOGADO (Qualquer cargo)
const loggedIn = (req, res, next) => {
    if (req.session.userId) return next();
    res.redirect('/login.html');
};

// --- APLICAÇÃO DA PROTEÇÃO NAS ROTAS DAS PÁGINAS ---

app.get('/dashboard-admin.html', adminOnly, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard-admin.html'));
});

app.get('/dashboard-employee.html', employeeOnly, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard-employee.html'));
});

app.get('/dashboard-client.html', loggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard-client.html'));
});
// ==========================================
// ROTA: EXPORTAR EXCEL INTELIGENTE (PESO 100% SINCRONIZADO COM O DASHBOARD)
// ==========================================
app.get('/api/export/smart-excel', (req, res) => {
    
    // 1. MÁGICA DA SINCRONIZAÇÃO: Pega o peso EXATO igualzinho à Visão Geral
    const sqlWeight = `SELECT SUM(weight) as totalWeight FROM orders WHERE deleted = 0 OR deleted IS NULL`;
    
    // 2. Pega os boxes para listar as mercadorias e contar as caixas físicas
    const sqlBoxes = `SELECT * FROM boxes WHERE deleted = 0 OR deleted IS NULL`;

    db.get(sqlWeight, [], (err, stats) => {
        if (err) return res.status(500).send("Erro ao buscar peso das encomendas.");
        
        // Peso Líquido cravado com o Dashboard
        let totalNetWeight = parseFloat(stats.totalWeight || 0);

        db.all(sqlBoxes, [], async (err, rows) => {
            if (err) return res.status(500).send("Erro ao buscar boxes.");

            try {
                let itemMap = {};
                let uniqueBoxes = new Set(); // Conta os caixotes (BOX 1, BOX 2)

                // SOMAR ITENS E SEPARAR AS CAIXAS FÍSICAS
                rows.forEach(row => {
                    // Guarda o nome do Box (ex: "BOX 1"). Ignora os repetidos!
                    if (row.box_code) {
                        uniqueBoxes.add(row.box_code.trim().toUpperCase());
                    }

                    // Organiza os produtos (inalterado)
                    if (row.products) {
                        let items = row.products.split(/,|\n/);
                        items.forEach(item => {
                            let cleanItem = item.trim();
                            if (!cleanItem) return;

                            let match = cleanItem.match(/^(\d+)\s*(.*)$/) || cleanItem.match(/^(.*)\s+(\d+)$/);
                            let qtd = 1, nome = cleanItem;

                            if (match) {
                                if (!isNaN(match[1])) { qtd = parseInt(match[1]); nome = match[2]; }
                                else { qtd = parseInt(match[2]); nome = match[1]; }
                            }

                            nome = nome.trim() || "ITENS DIVERSOS";
                            itemMap[nome] = (itemMap[nome] || 0) + qtd;
                        });
                    }
                });

                // ==========================================
                // CÁLCULO DE PESOS BRUTOS E CAIXAS
                // ==========================================
                const totalVolumes = uniqueBoxes.size; // Ex: 2 (BOX 1 e BOX 2)
                const pesoPorCaixaVazia = 4; // Cada caixote pesa 4 kilos
                const pesoTotalDasCaixasDePapelao = totalVolumes * pesoPorCaixaVazia;
                const totalGrossWeight = totalNetWeight + pesoTotalDasCaixasDePapelao; // Roupas + Caixotes

                // ==========================================
                // CRIAR O EXCEL
                // ==========================================
                const workbook = new ExcelJS.Workbook();
                const sheet = workbook.addWorksheet('Nota de venda');
                
                sheet.columns = [
                    { key: 'item', width: 6 }, { key: 'produto', width: 35 },
                    { key: 'qtd', width: 15 }, { key: 'peso', width: 20 },
                    { key: 'compra', width: 20 }, { key: 'finalidade', width: 15 },
                    { key: 'preco_saida', width: 25 }, { key: 'total_saida', width: 25 }
                ];

                let mesAno = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                mesAno = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);

                // Cabeçalho Principal
                sheet.mergeCells('A1:H1');
                sheet.getCell('A1').value = `EXPORTAÇÃO\nGUINE EXPRESS LTDA\n${mesAno}`;
                sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                sheet.getCell('A1').font = { bold: true };
                sheet.getRow(1).height = 60;

                sheet.addRow([]);
                sheet.addRow(['NOME CLIENTE']);
                sheet.getCell(`A3`).font = { bold: true };
                sheet.addRow([]);
                sheet.getCell(`G4`).value = '<<< Preencher';
                sheet.getCell(`G4`).font = { color: { argb: 'FFFF0000' } };
                
                sheet.addRow(['ENDEREÇO COMPLETO CLIENTE']);
                sheet.getCell(`A5`).font = { bold: true };
                sheet.addRow([]);
                sheet.getCell(`G6`).value = '<<< Preencher';
                sheet.getCell(`G6`).font = { color: { argb: 'FFFF0000' } };
                sheet.addRow([]);

                // Títulos das Colunas
                const headerRow = sheet.addRow(['ITEM', 'PRODUTO', 'QUANTIDADE', 'PESO LÍQUIDO (KG)', 'PREÇO DE COMPRA', 'FINALIDADE', 'PREÇO UNITÁRIO SAÍDA', 'TOTAL ITEM SAÍDA']);
                headerRow.font = { bold: true };
                headerRow.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                });

                let keys = Object.keys(itemMap).sort();
                let startRow = 9;

                keys.forEach((nome, index) => {
                    let rowNum = startRow + index;
                    let row = sheet.addRow([
                        index + 1, nome, itemMap[nome], '', '', 'Revenda'  
                    ]);

                    // Fórmulas Automáticas do Excel (Preço de Saída x4)
                    sheet.getCell(`G${rowNum}`).value = { formula: `E${rowNum}*4` };
                    sheet.getCell(`G${rowNum}`).numFmt = '"R$ "#,##0.00';
                    sheet.getCell(`H${rowNum}`).value = { formula: `C${rowNum}*G${rowNum}` };
                    sheet.getCell(`H${rowNum}`).numFmt = '"R$ "#,##0.00';
                    sheet.getCell(`H${rowNum}`).font = { bold: true };

                    sheet.getCell(`F${rowNum}`).dataValidation = {
                        type: 'list', allowBlank: true, formulae: ['"Revenda,Amostra"']
                    };

                    row.eachCell(cell => { cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }; });
                });

                // ==========================================
                // ✨ RODAPÉ INTELIGENTE ✨
                // ==========================================
                let nextRow = sheet.rowCount + 2;

                sheet.mergeCells(`A${nextRow}:H${nextRow}`);
                sheet.getCell(`A${nextRow}`).value = 'RESUMO GERAL DO EMBARQUE';
                sheet.getCell(`A${nextRow}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
                sheet.getCell(`A${nextRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1931' } };
                sheet.getCell(`A${nextRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
                sheet.getRow(nextRow).height = 25;

                // 1. Quantidade de Caixotes Físicos (Boxes únicos)
                sheet.mergeCells(`A${nextRow+1}:G${nextRow+1}`);
                sheet.getCell(`A${nextRow+1}`).value = 'QUANTIDADE TOTAL DE CAIXAS (VOLUMES FÍSICOS):';
                sheet.getCell(`A${nextRow+1}`).alignment = { horizontal: 'right', vertical: 'middle' };
                sheet.getCell(`A${nextRow+1}`).font = { bold: true };
                sheet.getCell(`H${nextRow+1}`).value = totalVolumes; 
                sheet.getCell(`H${nextRow+1}`).alignment = { horizontal: 'center', vertical: 'middle' };
                sheet.getCell(`H${nextRow+1}`).font = { bold: true, size: 12 };

                // 2. Peso de Cada Caixa
                sheet.mergeCells(`A${nextRow+2}:G${nextRow+2}`);
                sheet.getCell(`A${nextRow+2}`).value = 'PESO DE CADA CAIXA VAZIA (KG):';
                sheet.getCell(`A${nextRow+2}`).alignment = { horizontal: 'right', vertical: 'middle' };
                sheet.getCell(`A${nextRow+2}`).font = { bold: true };
                sheet.getCell(`H${nextRow+2}`).value = pesoPorCaixaVazia; 
                sheet.getCell(`H${nextRow+2}`).alignment = { horizontal: 'center', vertical: 'middle' };

                // 3. Peso Líquido (Apenas Encomendas - IDÊNTICO AO DASHBOARD)
                sheet.mergeCells(`A${nextRow+3}:G${nextRow+3}`);
                sheet.getCell(`A${nextRow+3}`).value = 'PESO LÍQUIDO TOTAL DAS ENCOMENDAS (KG):';
                sheet.getCell(`A${nextRow+3}`).alignment = { horizontal: 'right', vertical: 'middle' };
                sheet.getCell(`A${nextRow+3}`).font = { bold: true };
                sheet.getCell(`H${nextRow+3}`).value = totalNetWeight.toFixed(2); 
                sheet.getCell(`H${nextRow+3}`).alignment = { horizontal: 'center', vertical: 'middle' };

                // 4. Peso Bruto Total
                sheet.mergeCells(`A${nextRow+4}:G${nextRow+4}`);
                sheet.getCell(`A${nextRow+4}`).value = 'PESO BRUTO TOTAL (CAIXAS + ENCOMENDAS) (KG):';
                sheet.getCell(`A${nextRow+4}`).alignment = { horizontal: 'right', vertical: 'middle' };
                sheet.getCell(`A${nextRow+4}`).font = { bold: true, color: { argb: 'FFFF0000' } }; 
                sheet.getCell(`H${nextRow+4}`).value = totalGrossWeight.toFixed(2); 
                sheet.getCell(`H${nextRow+4}`).alignment = { horizontal: 'center', vertical: 'middle' };
                sheet.getCell(`H${nextRow+4}`).font = { bold: true, size: 12, color: { argb: 'FFFF0000' } };
                
                // Coloca as bordas
                for (let i = nextRow; i <= nextRow + 4; i++) {
                    sheet.getRow(i).eachCell(cell => {
                        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                    });
                }

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=Nota_Venda_Padrao.xlsx`);
                await workbook.xlsx.write(res);
                res.end();
                
            } catch (e) {
                console.error("❌ ERRO AO CRIAR O ARQUIVO EXCEL:", e);
                res.status(500).send("Erro interno ao gerar a planilha.");
            }
        });
    });
});
// ==================================================================
// FUNÇÃO AUXILIAR: Detectar Dispositivo e Salvar Log
// ==================================================================
function logAccess(req, userInput, status, reason) {
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
    const device = isMobile ? 'Celular 📱' : 'Computador 💻';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'IP Oculto';

    const sql = "INSERT INTO access_logs (user_input, status, reason, device, ip_address) VALUES (?, ?, ?, ?, ?)";
    db.run(sql, [userInput, status, reason, device, ip], (err) => {
        if(err) console.error("Erro ao salvar log:", err);
    });
}

// ==================================================================
// ROTA: LOGIN INTELIGENTE (COM RASTREAMENTO)
// ==================================================================
app.post('/api/login', (req, res) => {
    const { login, password, role } = req.body;

    // 1. Busca o usuário
    const sql = "SELECT * FROM users WHERE email = ? OR phone = ?";
    
    db.get(sql, [login, login], (err, user) => {
        if (err) {
            logAccess(req, login, 'Erro', 'Erro interno no Banco');
            return res.status(500).json({ success: false, msg: 'Erro interno.' });
        }

        // 2. Se não achou o usuário (A Cici entra em ação)
        if (!user) {
            logAccess(req, login, 'Falha', 'Usuário não encontrado');
            return res.status(400).json({ 
                success: false, 
                msg: '🙋‍♀️ Oi, Cici aqui! Ainda não encontrei o seu número no nosso sistema. Por favor, clique no botão dourado "CRIAR CONTA" logo abaixo para se cadastrar primeiro!',
                falaCici: true // <-- SINAL PARA O NAVEGADOR FALAR
            });
        }

        // 3. Verifica se a conta está ativa
        if (user.active !== 1) {
            logAccess(req, login, 'Falha', 'Conta Desativada');
            return res.status(400).json({ success: false, msg: 'Conta desativada. Fale com o suporte.' });
        }

        // 4. Verifica a Senha
        if (!bcrypt.compareSync(password, user.password)) {
            // AQUI ESTÁ O PULO DO GATO: Salvamos que alguém tentou invadir
            logAccess(req, login, 'Falha', 'Senha Incorreta 🔒');
            return res.status(400).json({ success: false, msg: 'Senha incorreta.' });
        }

        // 5. Verifica o Cargo
        if (user.role !== role) {
            logAccess(req, login, 'Falha', `Cargo Errado (Tentou ${role} sendo ${user.role})`);
            return res.status(400).json({ 
                success: false, 
                msg: `Login incorreto! Você é ${user.role}, mas tentou entrar como ${role}.` 
            });
        }

        // 6. Sucesso Absoluto
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.user = user; // Salva o objeto user inteiro na sessão para facilitar
        
        // Registra o sucesso
        logAccess(req, login, 'Sucesso', `Login Realizado (${user.role}) ✅`);
        
        console.log(`✅ Login Sucesso: ${user.name}`);
        res.json({ success: true, role: user.role, name: user.name });
    });
});
// ==================================================================
// BIOMETRIA: WEB-AUTHN (IMPRESSÃO DIGITAL E FACE ID) - 100% CORRIGIDO
// ==================================================================
const { 
    generateRegistrationOptions, verifyRegistrationResponse, 
    generateAuthenticationOptions, verifyAuthenticationResponse 
} = require('@simplewebauthn/server');

const rpName = 'Guineexpress Logística';

// 1. Pedir para Registar a Impressão Digital
app.post('/api/webauthn/register-request', async (req, res) => {
    const origin = req.get('origin') || `https://${req.get('host')}`;
    const rpID = new URL(origin).hostname; 

    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Precisa estar logado.' });

    db.get("SELECT * FROM users WHERE id = ?", [userId], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Utilizador não encontrado.' });

        const userUint8Array = new Uint8Array(Buffer.from(user.id.toString()));

        try {
            // 🌟 A CORREÇÃO ESTÁ AQUI: Adicionamos o "await" para esperar a criptografia!
            const options = await generateRegistrationOptions({
                rpName, 
                rpID,
                userID: userUint8Array,
                userName: user.email,
                attestationType: 'none',
                authenticatorSelection: { 
                    authenticatorAttachment: 'platform', 
                    residentKey: 'required', 
                    userVerification: 'preferred' 
                }
            });

            req.session.currentChallenge = options.challenge;
            res.json(options);
        } catch (error) {
            console.error("Erro no request:", error);
            res.status(500).json({ error: 'Erro ao gerar biometria.' });
        }
    });
});

// 2. Guardar a Impressão Digital
app.post('/api/webauthn/register-verify', async (req, res) => {
    const origin = req.get('origin') || `https://${req.get('host')}`;
    const rpID = new URL(origin).hostname;

    const userId = req.session.userId;
    const expectedChallenge = req.session.currentChallenge;

    try {
        const verification = await verifyRegistrationResponse({
            response: req.body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID
        });

        if (verification.verified) {
            const { credential } = verification.registrationInfo;
            
            const credIdStr = credential.id; 
            const pubKeyStr = Buffer.from(credential.publicKey).toString('base64');
            const counter = credential.counter;

            // 🌟 CORREÇÃO: Agora o servidor escuta a resposta do Banco de Dados!
            db.run("UPDATE users SET webauthn_id = ?, webauthn_public_key = ?, webauthn_counter = ? WHERE id = ?", 
                [credIdStr, pubKeyStr, counter, userId], 
                function(err) {
                    if (err) {
                        console.error("Erro do SQLite:", err.message);
                        return res.status(500).json({ error: 'Erro interno ao guardar no banco de dados.' });
                    }
                    if (this.changes === 0) {
                        console.error("Erro: Nenhum utilizador atualizado. userId:", userId);
                        return res.status(400).json({ error: 'Sessão perdida. Por favor, faça login novamente e tente ativar.' });
                    }
                    // Se chegou aqui, o banco guardou de verdade!
                    res.json({ success: true, msg: 'Impressão Digital ativada com sucesso!' });
                }
            );
        } else {
            res.status(400).json({ error: 'Falha ao verificar a biometria.' });
        }
    } catch (error) {
        console.error("Erro no verify:", error.message);
        res.status(400).json({ error: error.message });
    }
});

// 3. Iniciar o Login com Impressão Digital
app.post('/api/webauthn/login-request', async (req, res) => {
    const origin = req.get('origin') || `https://${req.get('host')}`;
    const rpID = new URL(origin).hostname;

    const { login } = req.body;
    db.get("SELECT * FROM users WHERE email = ? OR phone = ?", [login, login], async (err, user) => {
        if (!user || !user.webauthn_id) {
            return res.status(400).json({ error: 'Nenhuma impressão digital registada para esta conta.' });
        }

        try {
            const options = await generateAuthenticationOptions({
                rpID,
                allowCredentials: [{
                    // 🌟 VERSÃO NOVA: O 'id' agora usa o texto diretamente, sem precisar de Buffer!
                    id: user.webauthn_id, 
                    type: 'public-key'
                }],
                userVerification: 'preferred'
            });

            req.session.currentChallenge = options.challenge;
            req.session.loginAttemptUserId = user.id;
            res.json(options);
        } catch (error) {
            console.error("Erro no login request:", error);
            res.status(500).json({ error: 'Erro ao gerar pedido de login.' });
        }
    });
});


// ==================================================================
// 3. Rota: Pedir para fazer Login com Biometria
// ==================================================================
app.post('/api/webauthn/login-request', (req, res) => {
    const { login } = req.body; // Pega o email digitado
    
    // Procura o utilizador no banco de dados pelo email
    db.get("SELECT * FROM users WHERE email = ?", [login], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Conta não encontrada com este e-mail.' });
        }
        if (!user.webauthn_id) {
            return res.status(400).json({ error: 'Nenhuma impressão digital registada para esta conta.' });
        }

        try {
            const options = await generateAuthenticationOptions({
                rpID: new URL(req.get('origin') || `http://${req.get('host')}`).hostname,
                allowCredentials: [{
                    id: user.webauthn_id,
                    type: 'public-key',
                }],
                userVerification: 'preferred',
            });

            // 🌟 O SEGREDO ESTÁ AQUI: Guardar na sessão temporária quem está a tentar entrar!
            req.session.loginUserId = user.id; 
            req.session.currentChallenge = options.challenge;

            res.json(options);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao gerar o desafio biométrico.' });
        }
    });
});

// ==================================================================
// 4. Rota: Validar a Impressão Digital no Login (VERSÃO ÚNICA E BLINDADA)
// ==================================================================
app.post('/api/webauthn/login-verify', (req, res) => {
    console.log("🔥 CHEGOU NA ROTA BLINDADA DO LOGIN!"); 
    
    // Suporta tanto o nome da sessão antigo como o novo
    const userId = req.session.loginUserId || req.session.loginAttemptUserId;
    const expectedChallenge = req.session.currentChallenge;

    if (!userId || !expectedChallenge) {
        return res.status(400).json({ error: 'Sessão expirada. Tente de novo.' });
    }

    db.get("SELECT * FROM users WHERE id = ?", [userId], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Erro ao recuperar conta.' });

        try {
            console.log(`🔥 Lendo credenciais do utilizador: ${user.name}`);
            const publicKeyBytes = new Uint8Array(Buffer.from(user.webauthn_public_key, 'base64'));
            
            const origin = req.get('origin') || `https://${req.get('host')}`;
            const rpID = new URL(origin).hostname;

            const verification = await verifyAuthenticationResponse({
                response: req.body,
                expectedChallenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                
                // 🛡️ MODO BLINDADO: Para versões v9 ou mais antigas
                authenticator: {
                    credentialID: new Uint8Array(Buffer.from(user.webauthn_id, 'base64')),
                    credentialPublicKey: publicKeyBytes,
                    counter: user.webauthn_counter || 0
                },
                
                // 🛡️ MODO BLINDADO: Para versões v10 ou mais novas
                credential: {
                    id: user.webauthn_id,
                    publicKey: publicKeyBytes,
                    counter: user.webauthn_counter || 0
                }
            });

            console.log("🔥 Biblioteca validou com sucesso? ", verification.verified);

            if (verification.verified) {
                // --- 🛡️ TRAVA DE SEGURANÇA POR CARGO (NOVIDADE) ---
                // Pegamos o role que o utilizador escolheu na tela de login (veio no corpo da requisição ou guardamos antes)
                // Se não enviou o role, vamos assumir que ele deve ser validado.
                
                // NOTA: Para biometria ser 100% segura, o ideal é passar o 'role' no fetch do login-request
                // Mas aqui vamos garantir que ele só entra se o cargo bater com o que está no Banco.
                
                const newCounter = verification.authenticationInfo?.newCounter || 0;
                db.run("UPDATE users SET webauthn_counter = ? WHERE id = ?", [newCounter, user.id]);
                
                // Criamos a sessão
                req.session.userId = user.id; 
                req.session.role = user.role;
                req.session.user = user;
                
                delete req.session.loginUserId;
                delete req.session.loginAttemptUserId;
                delete req.session.currentChallenge;
                
                // Retornamos o cargo real para o JavaScript saber para onde redirecionar
                res.json({ success: true, role: user.role, name: user.name });

            } else {
                res.status(400).json({ error: 'Falha na verificação da biometria.' });
            }
        } catch (error) {
            console.error("❌ ERRO REAL DENTRO DA BIBLIOTECA:", error.message);
            res.status(400).json({ error: 'Erro de segurança: ' + error.message });
        }
    });
});
// --- ROTA EXTRA: Para o Admin ver os Logs ---
app.get('/api/admin/logs', (req, res) => {
    if (!req.session.role || req.session.role !== 'admin') {
        return res.status(403).json([]);
    }
    // Pega os últimos 100 acessos, do mais recente para o mais antigo
    db.all("SELECT * FROM access_logs ORDER BY id DESC LIMIT 100", (err, rows) => {
        res.json(rows || []);
    });
});
app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({success: true}); });
// ROTA: Checar Sessão Ativa (Para Auto-Login)
app.get('/api/check-session', (req, res) => {
    if (req.session.userId && req.session.user) { 
        res.json({ 
            loggedIn: true, 
            user: { 
                id: req.session.userId,
                name: req.session.user.name, 
                email: req.session.user.email,
                role: req.session.role,
                profile_pic: req.session.user.profile_pic // <-- ADICIONADA ESTA LINHA: Envia a foto do perfil
            }
        });
    } else {
        res.json({ loggedIn: false });
    }
});
app.get('/api/user', (req, res) => {
    if (!req.session.userId) return res.status(401).json({});
    db.get("SELECT * FROM users WHERE id = ?", [req.session.userId], (err, row) => res.json(row));
});
// ROTA: Alterar Senha (CORRIGIDA)
app.post('/api/users/change-password', (req, res) => {
    // CORREÇÃO: Agora verificamos 'userId' em vez de 'user'
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Não autorizado. Por favor, faça login novamente.' });
    }

    const { currentPass, newPass } = req.body;
    const userId = req.session.userId; // Pega o ID correto da sessão

    // 1. Busca a senha atual do banco
    db.get("SELECT password FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) return res.json({ success: false, message: "Erro ao buscar usuário." });

        // 2. Verifica se a senha atual confere
        if (!bcrypt.compareSync(currentPass, user.password)) {
            return res.json({ success: false, message: "❌ A senha atual está incorreta." });
        }

        // 3. Criptografa a nova senha e salva
        const newHash = bcrypt.hashSync(newPass, 10);
        db.run("UPDATE users SET password = ? WHERE id = ?", [newHash, userId], (err) => {
            if (err) return res.json({ success: false, message: "Erro ao atualizar." });
            res.json({ success: true, message: "✅ Senha alterada com sucesso!" });
        });
    });
});
// Exemplo de como você deve atualizar a imagem ao carregar os dados do utilizador
async function loadUserProfileData() {
    try {
        const res = await fetch('/api/user');
        const user = await res.json();
        
        if (user.name) {
            // Atualiza o nome (você já devia ter algo parecido)
            document.getElementById('user-name-display').innerText = user.name;
        }

        // --- CÓDIGO NOVO PARA A FOTO DE PERFIL ---
        if (user.profile_pic) {
            // Se o utilizador tiver foto, construa o caminho correto
            // Verifique se a pasta de uploads se chama mesmo '/uploads/' no seu servidor
            const profilePicUrl = `/uploads/${user.profile_pic}`;
            
            // Atualiza a foto no Cabeçalho VIP
            const vipImg = document.getElementById('vip-profile-img');
            if (vipImg) vipImg.src = profilePicUrl;
            
            // Atualiza a foto na aba "Perfil" (que você já tinha)
            const profileImg = document.getElementById('profile-img-display');
            if (profileImg) profileImg.src = profilePicUrl;
        }
        // -----------------------------------------

    } catch (error) {
        console.error("Erro ao carregar os dados do perfil:", error);
    }
}

// --- ROTA: Ler Logs do Sistema ---
app.get('/api/admin/logs', (req, res) => {
    // Apenas Admin pode ver
    // if (!req.session.role || req.session.role !== 'admin') return res.status(403).json([]);

    // CORREÇÃO: Lendo da tabela 'system_logs' ordenado pelo mais recente
    db.all("SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100", (err, rows) => {
        if (err) {
            console.error(err);
            return res.json([]);
        }
        res.json(rows);
    });
});
// ==========================================
// ROTA SECRETA PARA CONSERTAR O BANCO DE DADOS (VERSÃO AVANÇADA)
// ==========================================
app.get('/api/consertar-banco', (req, res) => {
    // 1. Adicionamos a coluna de forma simples, sem o relógio automático (o SQLite aceita isso)
    db.run("ALTER TABLE users ADD COLUMN created_at DATETIME", (err) => {
        // Se der erro aqui, é porque a coluna já foi criada antes, não tem problema.
        
        // 2. Preenchemos todos os clientes antigos com a data/hora de agora (para não ficarem com o "-")
        db.run("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL", () => {
            
            // 3. Criamos o "Gatilho" Mágico! 
            // Ele avisa ao banco: "Toda vez que um cliente novo entrar, carimba a data de hoje nele!"
            const triggerSql = `
                CREATE TRIGGER IF NOT EXISTS carimbar_data_novo_cliente
                AFTER INSERT ON users
                FOR EACH ROW
                WHEN NEW.created_at IS NULL
                BEGIN
                    UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                END;
            `;
            
            db.run(triggerSql, (errTrigger) => {
                if (errTrigger) {
                    return res.json({ status: "Erro no Gatilho", erro: errTrigger.message });
                }
                res.json({ 
                    status: "Sucesso Absoluto! 🚀", 
                    mensagem: "Coluna corrigida, clientes antigos atualizados e gatilho automático ativado!" 
                });
            });
        });
    });
});
// --- ROTA DE CLIENTES (À PROVA DE FALHAS) ---
app.get('/api/clients', (req, res) => {
    // 1. Tenta buscar os clientes organizados pela data nova
    db.all("SELECT * FROM users WHERE role = 'client' ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            // 2. SE DER ERRO (A coluna ainda não existe), ele não quebra! 
            // Ele faz a busca normal e devolve os clientes para a tela não ficar vazia.
            db.all("SELECT * FROM users WHERE role = 'client'", (err2, rows2) => {
                if(err2) {
                    console.error("Erro extremo ao buscar clientes:", err2);
                    return res.json([]);
                }
                res.json(rows2); // Manda os clientes pra tela
            });
        } else {
            // Se a coluna nova funcionou, manda os clientes já organizados
            res.json(rows);
        }
    });
});
// --- ROTA DE DADOS COMPLETOS PARA O RECIBO ---
app.get('/api/full-receipt/:orderId', (req, res) => {
    const orderId = req.params.orderId;

    // 1. Busca dados da Encomenda + Cliente
    const sqlOrder = `
        SELECT orders.*, users.name as client_name, users.phone, users.document, users.country
        FROM orders
        JOIN users ON orders.client_id = users.id
        WHERE orders.id = ?
    `;

    // 2. Busca TODAS as Caixas vinculadas a essa encomenda
    const sqlBoxes = `SELECT * FROM boxes WHERE order_id = ?`;

    db.get(sqlOrder, [orderId], (err, order) => {
        if (err || !order) return res.json({ success: false, msg: "Encomenda não encontrada." });

        db.all(sqlBoxes, [orderId], (err, boxes) => {
            if (err) return res.json({ success: false, msg: "Erro nas caixas." });
            
            // Envia tudo junto para o frontend
            res.json({ success: true, order: order, boxes: boxes });
        });
    });
});
// --- ROTA DE CADASTRO (COM VALIDAÇÃO DE SEGURANÇA CORRIGIDA) ---
app.post('/api/register', (req, res) => {
    const {name, email, phone, country, document, password} = req.body;

    // 1. Validação de Campos Vazios
    if (!name || !email || !password || !phone || !document || !country) {
        return res.json({success: false, msg: 'Preencha todos os campos obrigatórios.'});
    }

    // 2. Validação de Senha (Mínimo 6 caracteres)
    if (password.length < 6) {
        return res.json({success: false, msg: 'A senha deve ter no mínimo 6 caracteres.'});
    }

    // 3. Validação e Limpeza do Documento (A Mágica para Estrangeiros)
    let finalDoc = document.trim(); // Pega o documento do jeito que a pessoa digitou

    // SE FOR BRASIL: Aplica a regra rigorosa (apenas números e valida tamanho 11 ou 14)
    if (country === 'BR') {
        finalDoc = document.replace(/\D/g, ''); // Tira pontos e traços
        if (finalDoc.length !== 11 && finalDoc.length !== 14) {
            return res.json({success: false, msg: 'Documento brasileiro inválido. Digite um CPF (11) ou CNPJ (14) válido.'});
        }
    } else {
        // SE FOR OUTRO PAÍS: Deixa passar do jeito que está, apenas verifica se não é muito curto
        if (finalDoc.length < 4) {
            return res.json({success: false, msg: 'Documento internacional muito curto. Verifique o número digitado.'});
        }
    }

    // 4. Validação de Telefone (Apenas tira os caracteres especiais)
    const cleanPhone = phone.replace(/[^\d+]/g, ''); // Mantém apenas números e o sinal de '+' se houver
    if (cleanPhone.length < 8) {
        return res.json({success: false, msg: 'Telefone inválido. Verifique o número digitado.'});
    }

    // 5. Validação de Email (Formato básico)
    if (!email.includes('@') || !email.includes('.')) {
        return res.json({success: false, msg: 'E-mail inválido.'});
    }

    // 6. Se passou por tudo, criptografa e salva
    const bcrypt = require('bcrypt');
    // 6. Se passou por tudo, criptografa e salva
    const hash = bcrypt.hashSync(password, 10);
    
    // Salva no banco (usando finalDoc para respeitar a regra do país)
    db.run(`INSERT INTO users (role, name, email, phone, country, document, password) VALUES ('client', ?, ?, ?, ?, ?, ?)`, 
        [name, email, cleanPhone, country, finalDoc, hash], (err) => {
            if (err) {
                console.error(err);
                return res.json({success: false, msg: 'Erro: E-mail ou Documento já cadastrados.'});
            }
            res.json({success: true});
    });
});
// ==========================================
// CONTROLE DE DESPESAS (LUCRO REAL)
// ==========================================

// 1. Adicionar Despesa
app.post('/api/expenses/add', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    const { description, category, amount, date } = req.body;
    
    db.run("INSERT INTO expenses (description, category, amount, date) VALUES (?, ?, ?, ?)", 
        [description, category, amount, date], 
        (err) => res.json({ success: !err })
    );
});

// 2. Listar Despesas
app.get('/api/expenses/list', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    
    db.all("SELECT * FROM expenses ORDER BY date DESC", (err, rows) => {
        res.json(rows || []);
    });
});
// Rota para iniciar o Zap e gerar QR Code
app.get('/api/admin/zap-qr', async (req, res) => {
    if (clientZap && clientZap.info) {
        return res.json({ success: true, msg: "WhatsApp já está conectado!" });
    }

    if (clientZap) {
        return res.json({ success: false, msg: "O WhatsApp já está ligando. Aguarde uns 15 segundos..." });
    }

    console.log("📞 [ZAP] Iniciando o motor do Chrome... Isso leva de 10 a 30 segundos.");

    // 🔥 O EXTERMINADOR DE ZUMBIS E CADEADOS
    try {
        const { execSync } = require('child_process');
        // 1. Mata qualquer processo Chrome/Chromium fantasma que ficou rodando na memória do Render
        execSync('pkill -f chrome', { stdio: 'ignore' });
        execSync('pkill -f chromium', { stdio: 'ignore' });
    } catch (e) { /* Ignora silenciosamente se não tiver processo pra matar */ }

    try {
        const { execSync } = require('child_process');
        // 2. Apaga TODOS os tipos de cadeado (Lock, Cookie, Socket), não apenas o SingletonLock
        execSync(`find ${SESSION_PATH} -name "Singleton*" -delete`, { stdio: 'ignore' });
        console.log("🧹 [ZAP] Processos zumbis e TODOS os cadeados removidos com sucesso!");
    } catch (e) { /* Ignora silenciosamente se falhar */ }

    clientZap = new Client({
        authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
        puppeteer: {
            protocolTimeout: 600000, // <--- ADICIONE ESTA LINHA (Dá até 10 minutos para enviar o vídeo sem dar erro)
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    clientZap.once('qr', async (qr) => {
        console.log("📞 [ZAP] QR Code capturado! Mandando para a tela...");
        const qrImage = await qrcode.toDataURL(qr);
        if (!res.headersSent) {
            res.json({ success: true, qr: qrImage });
        }
    });

    clientZap.once('ready', () => {
        console.log('✅ WhatsApp Pronto!');
        if (!res.headersSent) {
            res.json({ success: true, msg: "Conectado automaticamente pela sessão salva!" });
        }
    });
    
    clientZap.initialize().catch((err) => { 
        console.log("❌ Erro fatal ao abrir o Chrome do Zap:", err);
        clientZap = null; 
        if (!res.headersSent) {
            res.json({ success: false, msg: "Falha ao iniciar o WhatsApp. Verifique os logs." });
        }
    });
});

// Função Auxiliar para pausar (Delay de segurança)
const delay = ms => new Promise(res => setTimeout(res, ms));
// Rota de Envio em Massa
app.post('/api/admin/broadcast-zap', (req, res) => {
    const { subject, message, sendZap } = req.body;

    db.all("SELECT email, name, phone FROM users WHERE role = 'client'", [], async (err, clients) => {
        if (err) return res.json({ success: false, msg: 'Erro no banco.' });

        res.json({ success: true, msg: `Iniciando envio para ${clients.length} clientes...` });

        for (const client of clients) {
            // 1. Enviar E-mail (Normal)
            sendEmailHtml(client.email, `📢 ${subject}`, subject, `Olá ${client.name},<br><br>${message}`);
            
            // 2. Enviar WhatsApp Global
            if (sendZap && typeof clientZap !== 'undefined' && clientZap && clientZap.info && client.phone) {
                // Limpeza: Deixa APENAS números. O número deve estar com DDI no banco (ex: 245..., 55..., 351...)
                let num = client.phone.replace(/\D/g, '');

                try {
                    // Busca o ID oficial no servidor do WhatsApp (Resolve o erro No LID e 9º dígito)
                    const contatoOficial = await clientZap.getNumberId(num);

                    if (contatoOficial) {
                        const textoZap = `*${subject}*\n\nOlá ${client.name},\n${message}`;
                        await clientZap.sendMessage(contatoOficial._serialized, textoZap);
                        console.log(`✓ Zap Global enviado para: ${num}`);
                    } else {
                        console.error(`x Número não encontrado no WhatsApp: ${num}`);
                    }
                    
                    // Delay de 3 segundos para evitar bloqueios por spam
                    await new Promise(resolve => setTimeout(resolve, 3000)); 
                } catch (e) {
                    console.error(`x Erro no número ${num}:`, e.message);
                }
            }
        }
    });
});
app.post('/api/expenses/delete', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    
    const id = req.body.id;

    // Primeiro buscamos o dado para saber o que está sendo apagado (para o log ficar rico)
    db.get("SELECT description, amount FROM expenses WHERE id = ?", [id], (err, row) => {
        if(row) {
            db.run("DELETE FROM expenses WHERE id = ?", [id], (err) => {
                if(!err) {
                    // GRAVA O LOG AQUI
                    logSystemAction(req, 'EXCLUSÃO FINANCEIRA', `Apagou despesa: ${row.description} (R$ ${row.amount})`);
                }
                res.json({ success: !err });
            });
        } else {
            res.json({ success: false });
        }
    });
});

// 4. Relatório Financeiro (Lucro Líquido)
app.get('/api/financial-report', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});

    const sqlRevenue = "SELECT SUM(amount) as total FROM boxes"; // Ganhos (Boxes)
    const sqlExpenses = "SELECT SUM(amount) as total FROM expenses"; // Gastos

    db.get(sqlRevenue, [], (err, rev) => {
        const revenue = rev ? rev.total : 0;
        
        db.get(sqlExpenses, [], (err, exp) => {
            const expenses = exp ? exp.total : 0;
            const profit = revenue - expenses;

            res.json({
                revenue: revenue || 0,
                expenses: expenses || 0,
                profit: profit || 0
            });
        });
    });
});
// ==========================================
// 1. Admin cria janela e NOTIFICA CLIENTES PAGOS VIA WHATSAPP
// ==========================================
app.post('/api/schedule/create-availability', (req, res) => {
    const { date, start_time, end_time, max_slots } = req.body;
    
    db.run("INSERT INTO availability (date, start_time, end_time, max_slots) VALUES (?,?,?,?)",
        [date, start_time, end_time, max_slots], function(err) {
            if (err) return res.json({ success: false });

            // Após criar a vaga, busca clientes com faturas pagas (approved ou paid)
            db.all(`SELECT DISTINCT u.phone, u.name 
                    FROM users u 
                    JOIN invoices i ON u.id = i.client_id 
                    WHERE i.status IN ('approved', 'paid') AND u.phone IS NOT NULL`, [], async (err2, clientesPagos) => {
                
                if(!err2 && clientesPagos.length > 0 && typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                    // Formata a data para a mensagem
                    const [ano, mes, dia] = date.split('-');
                    const dataFormatada = `${dia}/${mes}/${ano}`;

                    for (let cliente of clientesPagos) {
                        try {
                            let cleanPhone = cliente.phone.replace(/\D/g, '');
                            const zapMsg = `Olá, *${cliente.name}*! 📅\n\nA Guineexpress acabou de abrir vagas na agenda para o dia *${dataFormatada}*.\n\nComo o seu pagamento já foi confirmado, acesse o seu painel agora mesmo para garantir o seu horário de agendamento!\n\n🔗 https://guineexpress-f6ab.onrender.com/`;
                            
                            const numberId = await clientZap.getNumberId(cleanPhone);
                            if (numberId) {
                                await clientZap.sendMessage(numberId._serialized, zapMsg);
                                console.log(`✅ [ZAP] Aviso de agenda enviada para ${cliente.name}`);
                            }
                            if (cliente.id) {
                                enviarNotificacaoNaTela(cliente.id, "📅 Novas Vagas de Agendamento!", `Abrimos vagas na agenda para o dia ${dataFormatada}. Corra e garanta o seu horário!`, "/dashboard-client.html");
                            }
                        } catch(e) {
                            console.log(`⚠️ Erro ao avisar ${cliente.name} sobre a agenda.`);
                        }
                    }
                }
            });

            res.json({ success: true });
        });
});
// Rota que faltava: Lista as janelas criadas (para o Admin ver e excluir)
app.get('/api/schedule/availability', (req, res) => {
    db.all("SELECT * FROM availability WHERE date >= date('now') ORDER BY date ASC, start_time ASC", [], (err, rows) => {
        if(err) return res.json([]);
        res.json(rows);
    });
});
// 2. Admin exclui disponibilidade
app.post('/api/schedule/delete-availability', (req, res) => {
    db.serialize(() => {
        db.run("DELETE FROM appointments WHERE availability_id = ?", [req.body.id]);
        db.run("DELETE FROM availability WHERE id = ?", [req.body.id], (err) => res.json({ success: !err }));
     // Garante que a coluna de data existe para os gráficos
db.run("ALTER TABLE orders ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", (err) => {
    // Ignora erro se a coluna já existir
});
    });
});


app.get('/favicon.ico', (req, res) => res.status(204)); // Responde "Sem conteúdo" e para de reclamar
// ==========================================
// 3. Rota INTELIGENTE (BLOQUEADA PARA QUEM NÃO PAGOU)
// ==========================================
app.get('/api/schedule/slots-15min', (req, res) => {
    const userId = req.session.userId;
    const userRole = req.session.role;

    // Apenas clientes precisam da verificação de pagamento. Admin e Func veem tudo.
    if (userRole === 'client') {
        db.get(`SELECT count(*) as qtd FROM invoices WHERE client_id = ? AND status IN ('approved', 'paid')`, [userId], (errUser, rowCount) => {
            if (errUser || !rowCount || rowCount.qtd === 0) {
                // Se o cliente não tem fatura paga, devolvemos um código especial "BLOQUEADO"
                return res.json({ status: "bloqueado", data: [] });
            }
            // Se pagou, segue para carregar as vagas
            carregarVagas(res);
        });
    } else {
        // Se for admin/func, carrega direto
        carregarVagas(res);
    }

    function carregarVagas(resposta) {
        db.all("SELECT * FROM availability WHERE date >= date('now') ORDER BY date ASC, start_time ASC", [], (err, ranges) => {
            if(err) return resposta.json({ status: "ok", data: [] });

            db.all("SELECT availability_id, time_slot, status FROM appointments WHERE status != 'Cancelado'", [], (err2, bookings) => {
                if (err2 || !bookings) bookings = []; 

                let finalSlots = [];
                ranges.forEach(range => {
                    let current = new Date(`2000-01-01T${range.start_time}`);
                    let end = new Date(`2000-01-01T${range.end_time}`);

                    while (current < end) {
                        let timeStr = current.toTimeString().substring(0,5);
                        let taken = bookings.filter(b => b.availability_id === range.id && b.time_slot === timeStr).length;
                        
                        finalSlots.push({
                            availability_id: range.id, date: range.date, time: timeStr,
                            max_slots: range.max_slots, taken: taken, available: range.max_slots - taken
                        });
                        current.setMinutes(current.getMinutes() + 15);
                    }
                });
                resposta.json({ status: "ok", data: finalSlots });
            });
        });
    }
});
// ==========================================
// ROTA NOVA: EXCLUIR AGENDAMENTO DO HISTÓRICO
// ==========================================
app.delete('/api/schedule/delete-appointment/:id', (req, res) => {
    if (req.session.role !== 'admin' && req.session.role !== 'funcionario') {
        return res.status(403).json({ success: false, msg: 'Sem permissão' });
    }
    
    db.run("DELETE FROM appointments WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});
// 4. Reservar (APROVAÇÃO AUTOMÁTICA)
app.post('/api/schedule/book', (req, res) => {
    const { availability_id, date, time } = req.body;
    const client_id = req.session.userId;

    if (!client_id) return res.json({ success: false, msg: 'Sessão expirada. Faça login novamente.' });

    // A. Verifica se o cliente já tem agendamento no dia (Evita duplicidade)
    db.get(`SELECT ap.id FROM appointments ap JOIN availability av ON ap.availability_id = av.id 
            WHERE ap.client_id = ? AND av.date = ? AND ap.status != 'Cancelado'`, 
    [client_id, date], (err, hasBooking) => {
        if (hasBooking) return res.json({ success: false, msg: 'Você já tem um agendamento neste dia.' });

        // B. Verifica lotação do horário
        db.get(`SELECT count(*) as qtd FROM appointments WHERE availability_id = ? AND time_slot = ? AND status != 'Cancelado'`, 
        [availability_id, time], (err, row) => {
            db.get("SELECT max_slots FROM availability WHERE id = ?", [availability_id], (err, avail) => {
                if (!row || !avail) return res.json({success: false, msg: "Erro ao verificar vaga."});
                
                if (row.qtd >= avail.max_slots) return res.json({ success: false, msg: 'Horário esgotado.' });

                // C. Agenda com STATUS DIRETO PARA 'Confirmado'
                // Mudamos de 'Pendente' para 'Confirmado' aqui:
                db.run("INSERT INTO appointments (availability_id, client_id, time_slot, status) VALUES (?,?,?, 'Confirmado')", 
                    [availability_id, client_id, time], function(err) {
                        if (err) {
                            return res.json({success: false, msg: "Erro ao salvar agendamento."});
                        }
                        
                        // Retornamos sucesso e uma mensagem para a Cicí ler
                        res.json({
                            success: true, 
                            msg: 'Agendamento confirmado automaticamente!',
                            appointmentId: this.lastID
                        });
                    }
                );
            });
        });
    });
});

// 5. Lista Agendamentos
app.get('/api/schedule/appointments', (req, res) => {
    let sql = `SELECT ap.id, ap.status, ap.time_slot, av.date, u.name as client_name, u.phone as client_phone FROM appointments ap JOIN availability av ON ap.availability_id = av.id JOIN users u ON ap.client_id = u.id`;
    let params = [];
    if (req.session.role === 'client') { sql += " WHERE ap.client_id = ?"; params.push(req.session.userId); }
    sql += " ORDER BY av.date ASC, ap.time_slot ASC";
    db.all(sql, params, (err, rows) => {
        if(err) { console.log(err); return res.json([]); }
        res.json(rows);
    });
});

// 6. Ações (Status e Cancelar)
app.post('/api/schedule/status', (req, res) => db.run("UPDATE appointments SET status = ? WHERE id = ?", [req.body.status, req.body.id], (err) => res.json({success: !err})));
app.post('/api/schedule/cancel', (req, res) => db.run("UPDATE appointments SET status = 'Cancelado' WHERE id = ? AND client_id = ?", [req.body.id, req.session.userId], (err) => res.json({success: !err})));

// ==========================================
// ROTA: BUSCAR ENCOMENDAS (MOSTRA ATIVAS E NOVAS)
// ==========================================
app.get('/api/orders', (req, res) => {
    let sql = `SELECT 
                o.*, 
                u.name as client_name, 
                u.phone as client_phone, 
                u.email as client_email,
                i.nf_amount,
                i.freight_amount,
                COALESCE(MAX(b.volumes), o.volumes, 1) as volumes_reais
               FROM orders o
               JOIN users u ON o.client_id = u.id
               LEFT JOIN boxes b ON b.order_id = o.id
               LEFT JOIN invoices i ON i.box_id = b.id
               WHERE (o.deleted = 0 OR o.deleted IS NULL)`; // <-- MÁGICA: Aceita 0 ou vazio (NULL)
    
    let params = [];
    
    if(req.session.role === 'client') { 
        sql += " AND o.client_id = ?"; 
        params.push(req.session.userId); 
    }
    
    sql += " GROUP BY o.id ORDER BY o.id DESC"; 

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({error: "Erro no banco de dados"});
        res.json(rows);
    });
});

// ==========================================
// ROTA: BUSCAR BOXES (MOSTRA ATIVAS E NOVAS)
// ==========================================
app.get('/api/boxes', (req, res) => {
    let sql = `SELECT 
            boxes.*, 
            users.name as client_name, 
            orders.code as order_code, 
            orders.status as order_status, 
            orders.weight as order_weight,
            invoices.nf_amount,
            invoices.freight_amount
        FROM boxes 
        JOIN users ON boxes.client_id = users.id 
        LEFT JOIN orders ON boxes.order_id = orders.id
        LEFT JOIN invoices ON boxes.id = invoices.box_id
        WHERE (boxes.deleted = 0 OR boxes.deleted IS NULL)`; // <-- MÁGICA: Aceita 0 ou vazio (NULL)
        
    let params = [];
    
    if(req.session.role === 'client') { 
        sql += " AND boxes.client_id = ?"; 
        params.push(req.session.userId); 
    }
    
    db.all(sql, params, (err, rows) => res.json(rows));
});
// ROTA DO PAINEL FINANCEIRO (Junta Encomendas e Faturas com Lotes)
app.get('/api/finances/all', async (req, res) => {
    const isAdminOrEmployee = req.session.role === 'admin' || req.session.role === 'employee';
    if (!isAdminOrEmployee) return res.json([]);

    try {
        // 1. Busca Encomendas (Agora puxando o lote direto da tabela orders ou boxes)
        const orders = await new Promise((resolve, reject) => {
            const sql = `SELECT 
                            o.code as id_code, 
                            'Encomenda' as type, 
                            u.name as client_name, 
                            o.description, 
                            o.weight, 
                            o.status, 
                            COALESCE(MAX(b.volumes), o.volumes, 1) as volumes,
                            COALESCE(b.lote, o.lote, 'Sem Lote') as lote -- 🚀 CORREÇÃO AQUI
                         FROM orders o 
                         JOIN users u ON o.client_id = u.id 
                         LEFT JOIN boxes b ON b.order_id = o.id
                         GROUP BY o.id
                         ORDER BY o.id DESC`;
            db.all(sql, [], (err, rows) => {
                if (err) reject(err); else resolve(rows);
            });
        });

        // 2. Busca Faturas do Financeiro (Agora puxando o lote direto da tabela boxes ou orders)
        const invoices = await new Promise((resolve, reject) => {
            const sql = `SELECT 
                            o.code as id_code, 
                            'Fatura' as type, 
                            u.name as client_name, 
                            'Caixa ' || b.box_code as description, 
                            NULL as weight, 
                            i.status, 
                            COALESCE(b.volumes, o.volumes, 1) as volumes,
                            COALESCE(b.lote, o.lote, 'Sem Lote') as lote -- 🚀 CORREÇÃO AQUI
                         FROM invoices i 
                         LEFT JOIN users u ON i.client_id = u.id 
                         LEFT JOIN boxes b ON i.box_id = b.id 
                         LEFT JOIN orders o ON b.order_id = o.id
                         ORDER BY i.id DESC`;
            db.all(sql, [], (err, rows) => {
                if (err) reject(err); else resolve(rows);
            });
        });

        const combined = [...orders, ...invoices];
        res.json(combined);

    } catch (err) {
        console.error("Erro na rota /api/finances/all:", err);
        res.status(500).json({ error: "Erro ao gerar relatório financeiro" });
    }
});
// --- ROTA CORRIGIDA: CRIAR ENCOMENDA (COM CAÇA-FANTASMAS DA LIXEIRA ANTIGA) ---
app.post('/api/orders/create', (req, res) => {
const { client_id, code, description, weight, status, lote } = req.body;

    // Removemos espaços vazios que possam ter sido digitados sem querer
    const cleanCode = code.trim();

    // 1. Verifica se o código já existe (agora puxando a coluna 'deleted' também)
    db.get("SELECT id, deleted FROM orders WHERE LOWER(code) = LOWER(?)", [cleanCode], (err, existingOrder) => {
        if (err) return res.json({ success: false, msg: err.message });
        
        // Se achou o código no banco...
        if (existingOrder) {
            // Se ele for um FANTASMA da lixeira antiga (deleted = 1)
            if (existingOrder.deleted === 1) {
                console.log(`Limpando fantasma antigo: Liberando o código ${cleanCode}`);
                // Apaga ele DE VERDADE do banco de dados para liberar espaço!
                db.run("DELETE FROM orders WHERE id = ?", [existingOrder.id], (err) => {
                    if (err) return res.json({ success: false, msg: "Erro ao limpar fantasma." });
                    salvarNovaEncomenda(); // O caminho está livre, salva a nova!
                });
                return; // Pausa aqui para esperar o DELETE terminar
            } 
            // Se ele NÃO for fantasma (estiver ativo na tela), BLOQUEIA!
            else {
                return res.json({ success: false, msg: `❌ O código "${cleanCode}" já existe e está ATIVO no sistema! Digite um código diferente.` });
            }
        }

        // 2. Se o código não existir de jeito nenhum, salva direto
        salvarNovaEncomenda();

        // ---------------------------------------------------------
        // FUNÇÃO INTERNA PARA SALVAR A ENCOMENDA NO BANCO
        // ---------------------------------------------------------
        function salvarNovaEncomenda() {
            db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err, row) => {
                const pricePerKg = row ? parseFloat(row.value) : 0;
                const totalPrice = (parseFloat(weight) * pricePerKg).toFixed(2);
                
                // MÁGICA: Define 'Sem Lote' caso o admin esqueça de selecionar
                const loteFinal = lote || 'Sem Lote';

                console.log(`Criando encomenda: ${weight}kg * R$${pricePerKg} = R$${totalPrice} | Lote: ${loteFinal}`);

                // ADICIONAMOS A COLUNA 'lote' NO INSERT
                const sql = `INSERT INTO orders (client_id, code, description, weight, status, price, lote) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                             
                db.run(sql, [client_id, cleanCode, description, weight, status, totalPrice, loteFinal], function(err) {
                    if (err) {
                        return res.json({ success: false, msg: err.message });
                    }
                    
                    // 🔔 COLE A NOTIFICAÇÃO AQUI:
                    enviarNotificacaoNaTela(client_id, "📦 Nova Encomenda Registrada!", "Sua encomenda foi registrada no sistema. Clique para conferir os detalhes.", "/dashboard-client.html");

                    res.json({ success: true, id: this.lastID });
                });
            });
        }
    });
});
// --- ROTA CORRIGIDA: EDITAR ENCOMENDA ---
app.put('/api/orders/:id', (req, res) => {
    // Bloqueia se for cliente tentando editar
    if (req.session.role === 'client') {
        return res.status(403).json({ success: false, msg: 'Sem permissão' });
    }
    
    // PEGANDO O NOVO CAMPO 'LOTE' NA EDIÇÃO
    const { code, description, weight, status, lote } = req.body;
    const id = req.params.id;

    db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err, row) => {
        const pricePerKg = row ? parseFloat(row.value) : 0;
        const newPrice = (parseFloat(weight) * pricePerKg).toFixed(2);
        
        const loteFinal = lote || 'Sem Lote';

        // ADICIONAMOS O LOTE NO UPDATE
        const sql = `UPDATE orders SET code = ?, description = ?, weight = ?, status = ?, price = ?, lote = ? WHERE id = ?`;
        
        db.run(sql, [code, description, weight, status, newPrice, loteFinal, id], function(err) {
            if (err) return res.json({ success: false, msg: err.message });
            res.json({ success: true });
        });
    });
});
// ==========================================
// ROTA: PUXAR PRODUTOS PARA LISTA DE EMBARQUE
// ==========================================
app.get('/api/manifest', (req, res) => {
    // Busca tudo: products dos Boxes E description das Encomendas!
    const sql = `
        SELECT products as items FROM boxes WHERE deleted = 0 AND products IS NOT NULL AND products != ''
        UNION ALL
        SELECT description as items FROM orders WHERE deleted = 0 AND description IS NOT NULL AND description != ''
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) return res.json({ success: false, msg: "Erro ao buscar itens no banco." });
        res.json({ success: true, data: rows });
    });
});
// ==============================================================
// ROTA: ATUALIZAR STATUS INDIVIDUAL (COM WHATSAPP E PAINEL)
// ==============================================================
app.post('/api/orders/update', (req, res) => {
    // Verifica segurança
    if (!req.session.userId || req.session.role === 'client') {
        return res.status(403).json({ success: false, message: "Acesso Negado." });
    }

    const { id, status } = req.body;

    if (!id || !status) {
        return res.status(400).json({ success: false, message: "Dados incompletos." });
    }

    // 1. Atualiza o status no banco de dados
    db.run("UPDATE orders SET status = ? WHERE id = ?", [status, id], function(err) {
        if (err) {
            console.error("Erro ao atualizar status individual:", err);
            return res.status(500).json({ success: false, message: "Erro no servidor." });
        }

        // 2. Responde rápido para a tela do Admin atualizar a tabela imediatamente
        res.json({ success: true });

        // ==========================================================
        // 3. MOTO DO WHATSAPP & PAINEL DO CLIENTE (Idêntico ao envio em massa)
        // ==========================================================
        const sqlSelect = `
            SELECT o.code, o.description, u.id as client_id, u.name, u.phone 
            FROM orders o
            JOIN users u ON o.client_id = u.id
            WHERE o.id = ?
        `;

        db.get(sqlSelect, [id], async (err, row) => {
            if (err || !row) return console.error("Erro ao buscar dados do cliente para Zap individual:", err);

            const desc = row.description ? row.description : 'Sua encomenda';
            
            // --- A) NOTIFICAÇÃO NO PAINEL DO CLIENTE ---
            const tituloAviso = "Atualização de Encomenda";
            const msgAviso = `Sua encomenda ${row.code} mudou para: ${status}`;
            db.run("INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, ?, ?, 0)", 
                  [row.client_id, tituloAviso, msgAviso], function(err) {});

            // --- B) DISPARO DE WHATSAPP (PADRÃO FATURA) ---
            if (row.phone && typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                try {
                    let cleanPhone = row.phone.replace(/\D/g, '');
                    
                    // Adiciona o 55 se o número parecer ser brasileiro e não tiver o DDI
                    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
                        cleanPhone = '55' + cleanPhone;
                    }
                    
                    // A mensagem com o mesmo padrão visual (emojis e links)
                    const zapMsg = `Olá, *${row.name}*! 👋\n\nUma atualização importante na Guineexpress para o seu envio (*${desc}* / Código: *${row.code}*).\n\n📦 *Novo Status:* ${status}\n\nAcesse o seu painel agora para acompanhar todas as atualizações:\n\n🔗 https://guineexpress-f6ab.onrender.com/`;

                    const numberId = await clientZap.getNumberId(cleanPhone);
                    
                    if (numberId) {
                        await clientZap.sendMessage(numberId._serialized, zapMsg);
                        console.log(`✅ [ZAP INDIVIDUAL] Status enviado por Zap para o cliente ${cleanPhone}`);
                    } else {
                        console.log(`⚠️ [ZAP INDIVIDUAL] Número ${cleanPhone} inválido. Tentando forçar...`);
                        await clientZap.sendMessage(`${cleanPhone}@c.us`, zapMsg);
                    }
                } catch (zapErr) {
                    console.error(`❌ Erro ao enviar Zap individual para ${row.name}:`, zapErr.message);
                }
            } else {
                console.log(`⚠️ [ZAP INDIVIDUAL] Cliente ${row.name} não notificado: Sem telefone ou Robô desconectado.`);
            }
        });
    });
});

app.post('/api/boxes/create', (req, res) => {
    // Agora pegamos o 'lote' também
    const {client_id, order_id, box_code, products, amount, lote} = req.body;
    
    // A MÁGICA AQUI: Transforma em maiúsculo e tira os espaços!
    const cleanBoxCode = box_code ? box_code.trim().toUpperCase() : '';
    const loteFinal = lote || 'Sem Lote'; // Se vier vazio, põe "Sem Lote"

    // Adicionamos a coluna lote no INSERT
    db.run(
        "INSERT INTO boxes (client_id, order_id, box_code, products, amount, lote) VALUES (?,?,?,?,?,?)", 
        [client_id, order_id, cleanBoxCode, products, amount, loteFinal], 
        (err) => res.json({success: !err, msg: err ? err.message : null})
    );
});
// ROTA NOVA: Salvar a quantidade de volumes (Para Encomendas e Caixas)
app.post('/api/update-volumes', (req, res) => {
    const { id, type, volumes } = req.body;
    
    if (type === 'box') {
        db.run("UPDATE boxes SET volumes = ? WHERE id = ?", [volumes, id], (err) => res.json({ success: !err }));
    } else {
        db.run("UPDATE orders SET volumes = ? WHERE id = ?", [volumes, id], (err) => res.json({ success: !err }));
    }
});

// --- ROTA: Atualizar Usuário ---
app.post('/api/user/update', upload.single('profile_pic'), (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Sessão expirada. Faça login novamente." });
    }

    const { name, phone, email, password } = req.body;
    const userId = req.session.user.id; 

    let sql, params;

    if (req.file) {
        const filename = req.file.filename;
        if (password && password.trim() !== "") {
            const hash = bcrypt.hashSync(password, 10);
            sql = "UPDATE users SET name=?, phone=?, email=?, profile_pic=?, password=? WHERE id=?";
            params = [name, phone, email, filename, hash, userId];
        } else {
            sql = "UPDATE users SET name=?, phone=?, email=?, profile_pic=? WHERE id=?";
            params = [name, phone, email, filename, userId];
        }
    } else {
        if (password && password.trim() !== "") {
            const hash = bcrypt.hashSync(password, 10);
            sql = "UPDATE users SET name=?, phone=?, email=?, password=? WHERE id=?";
            params = [name, phone, email, hash, userId];
        } else {
            sql = "UPDATE users SET name=?, phone=?, email=? WHERE id=?";
            params = [name, phone, email, userId];
        }
    }

    db.run(sql, params, function(err) {
        if (err) {
            console.error("Erro ao atualizar:", err);
            return res.json({ success: false, message: "Erro no banco de dados." });
        }

        req.session.user.name = name;
        req.session.user.email = email;
        if (req.file) {
            req.session.user.profile_pic = req.file.filename;
        }

        res.json({ 
            success: true, 
            message: "Perfil atualizado com sucesso!",
            newProfilePic: req.session.user.profile_pic
        });
    });
});
app.post('/api/clients/toggle', (req, res) => db.run("UPDATE users SET active = ? WHERE id = ?", [req.body.active, req.body.id], () => res.json({ success: true })));
// --- ROTA DE PREÇO (CONFIGURAÇÃO) ---
app.get('/api/config/price', (req, res) => {
    db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err, row) => {
        res.json({ price: row ? row.value : 0 });
    });
});

app.post('/api/config/price', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    
    // Use INSERT OR REPLACE para garantir que funcione na primeira vez
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('price_per_kg', ?)", [req.body.price], (err) => {
        if(err) console.error("Erro ao salvar preço:", err);
        res.json({ success: !err });
    });
});
app.post('/api/videos/upload', uploadVideo.single('video'), (req, res) => {
    if(!req.file) return res.status(400).json({success: false, msg: "Nenhum vídeo enviado."});
    
    // 🚀 AQUI: Adicionado o order_code para receber do front-end
    const { client_id, description, order_code } = req.body;
    if(!client_id) return res.status(400).json({success: false, msg: "Cliente não identificado."});

    // 1. Caminhos do arquivo
    const videoOriginalWebm = req.file.path; // Arquivo .webm original que o multer salvou
    const nomeArquivoMp4 = req.file.filename.replace('.webm', '.mp4'); // Troca a extensão no nome
    const videoConvertidoMp4 = path.join(videosFolder, nomeArquivoMp4); // Caminho final do .mp4

    console.log(`⏳ Convertendo vídeo de .webm para .mp4... Aguarde.`);

    // 2. Inicia a conversão com FFmpeg
    ffmpeg(videoOriginalWebm)
        .outputOptions([
            '-preset veryfast', // Converte rápido
            '-c:v libx264',     // Formato de vídeo universal (H.264)
            '-c:a aac'          // Formato de áudio universal
        ])
        .save(videoConvertidoMp4)
        .on('end', () => {
            console.log(`✅ Vídeo convertido com sucesso para MP4!`);

            // Apaga o arquivo .webm antigo para não lotar seu servidor
            fs.unlink(videoOriginalWebm, (err) => {
                if (err) console.error("⚠️ Erro ao apagar arquivo .webm antigo:", err);
            });

            // 3. 🚀 AQUI: Salva no banco de dados com a nova coluna order_code
            db.run("INSERT INTO videos (client_id, order_code, filename, description) VALUES (?, ?, ?, ?)", 
            [client_id, order_code, nomeArquivoMp4, description], function(err) {
                if(err) return res.status(500).json({success: false, msg: "Erro ao salvar no banco."});
                
                console.log(`✅ Vídeo MP4 salvo no banco!`);
                // 🔔 COLE A NOTIFICAÇÃO DE VÍDEO AQUI:
                enviarNotificacaoNaTela(client_id, "🎥 Novo Vídeo Disponível!", "Acabamos de subir um vídeo mostrando os detalhes da sua encomenda.", "/dashboard-client.html");
                
                // 4. Fluxo do WhatsApp
                db.get("SELECT name, phone FROM users WHERE id = ?", [client_id], async (err, user) => {
                    if (err || !user || !user.phone) {
                        return res.json({success: true, msg: "Vídeo salvo, mas cliente sem telefone."});
                    }

                    if (typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                        try {
                            let cleanPhone = user.phone.replace(/\D/g, '');
                            const numberId = await clientZap.getNumberId(cleanPhone);
                            
                            if (numberId) {
                                try {
                                    const message = `Olá *${user.name}*! 📦🎬\n\nSegue o vídeo da sua encomenda na *Guineexpress*:\n\n_(Você também pode ver este e outros vídeos no seu painel de cliente)_`;
                                    await clientZap.sendMessage(numberId._serialized, message);

                                    if (fs.existsSync(videoConvertidoMp4)) {
                                        const media = MessageMedia.fromFilePath(videoConvertidoMp4);
                                        
                                        // 🔥 A MÁGICA ACONTECE AQUI: Tiramos o 'sendMediaAsDocument'
                                        // Agora ele vai como vídeo nativo para tocar na hora!
                                        await clientZap.sendMessage(numberId._serialized, media, { 
                                            caption: `Vídeo: ${description || 'Sua encomenda'}` 
                                        });
                                        console.log(`✅ Vídeo nativo enviado com sucesso para ${cleanPhone}`);
                                    }
                                } catch (err) {
                                    console.error("❌ Erro interno no envio da mídia:", err.message);
                                }
                            }
                        } catch (zapErr) {
                            console.error("❌ Erro no envio do Zap de vídeo:", zapErr.message);
                        }
                    }
                    
                    // Retorna sucesso para liberar a tela do funcionário
                    res.json({success: true});
                });
            });
        })
        .on('error', (err) => {
            console.error("❌ Erro na conversão do vídeo:", err);
            res.status(500).json({success: false, msg: "Erro ao converter vídeo para MP4."});
        });
});
// 2. Listar Vídeos (COM LOTES CORRIGIDOS! 🚀)
app.get('/api/videos/list', (req, res) => {
    if(req.session.role === 'client') {
        db.all("SELECT * FROM videos WHERE client_id = ? ORDER BY id DESC", [req.session.userId], (err, rows) => {
            res.json(rows);
        });
    } else {
        // 🚀 O ADMIN AGORA BUSCA O LOTE FAZENDO A BUSCA NO LUGAR CERTO!
        db.all(`SELECT 
                    videos.*, 
                    users.name as client_name,
                    COALESCE(b.lote, o.lote, 'Sem Lote') as lote -- 🚀 A CORREÇÃO ESTÁ AQUI
                FROM videos 
                LEFT JOIN users ON videos.client_id = users.id 
                LEFT JOIN orders o ON videos.order_code = o.code
                LEFT JOIN boxes b ON b.order_id = o.id
                ORDER BY videos.id DESC`, (err, rows) => {
            if (err) {
                console.error("Erro ao buscar vídeos:", err);
                return res.status(500).json({ error: "Erro ao buscar vídeos" });
            }
            res.json(rows);
        });
    }
});
// 3. Excluir Vídeo
app.post('/api/videos/delete', (req, res) => {
    if(req.session.role === 'client') return res.status(403).json({}); // Cliente não deleta
    const { id, filename } = req.body;
    
    db.run("DELETE FROM videos WHERE id = ?", [id], (err) => {
        if(!err) {
            // Tenta apagar o arquivo físico
            try { fs.unlinkSync(path.join(videosFolder, filename)); } catch(e){ console.log("Erro ao apagar arquivo:", e.message) }
        }
        res.json({success: !err});
    });
});
// ==========================================
// ROTA: VERIFICAR SE O VALOR JÁ EXISTE PENDENTE (ALERTA VERMELHO DA CICÍ)
// ==========================================
app.get('/api/invoices/check_amount', (req, res) => {
    const valor = req.query.amount;

    if (!valor) return res.json({ conflito: false });

    // Procura na tabela de faturas se já existe alguma pendente com este valor exato
    const sql = `SELECT COUNT(*) as total FROM invoices WHERE amount = ? AND status = 'pending'`;
    
    db.get(sql, [valor], (err, row) => {
        if (err) {
            console.error("Erro ao verificar valor da fatura:", err);
            return res.status(500).json({ erro: "Erro interno" });
        }
        
        if (row.total > 0) {
            res.json({ conflito: true }); // Opa, achou conflito!
        } else {
            res.json({ conflito: false }); // Caminho livre!
        }
    });
});
// ==========================================
// ROTA: CRIAR FATURA (PIX MANUAL) E AVISAR CLIENTE
// ==========================================
app.post('/api/invoices/create', async (req, res) => {
    
    // 🔴 APAGUE OU COMENTE ESTA LINHA:
    // if(req.session.role !== 'admin') return res.status(403).json({msg: 'Sem permissão'});

    // 🟢 COLOQUE ESTA LINHA NO LUGAR:
    // Permite se for 'admin' OU 'employee' OU 'funcionario'
    if(req.session.role !== 'admin' && req.session.role !== 'employee' && req.session.role !== 'funcionario') {
        return res.status(403).json({msg: 'Sem permissão para criar faturas'});
    }

    // Adicionamos os novos campos nf_amount e freight_amount aqui
    const { client_id, box_id, amount, description, email, nf_amount, freight_amount } = req.body; 

    try {
        // A. Salva direto no Banco, agora com as colunas novas
        db.run(`INSERT INTO invoices (client_id, box_id, amount, description, status, nf_amount, freight_amount) 
                VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
                [client_id, box_id, amount, description, nf_amount || 0, freight_amount || amount], // Se não vier frete, assume o total
                function(err) {
                    if(err) {
                        console.error("Erro SQL ao criar fatura:", err);
                        return res.json({success: false, msg: 'Erro ao salvar fatura'});
                    }
// 🔔 COLE A NOTIFICAÇÃO DE FATURA AQUI:
            enviarNotificacaoNaTela(client_id, "Nova Fatura Gerada 🧾", "Uma nova fatura acabou de ser disponibilizada no seu painel. Clique para pagar.", "/dashboard-client.html");
                    const novaFaturaId = this.lastID;

                    // B. BUSCA O NOME E O TELEFONE DO CLIENTE NO BANCO PARA AVISAR
                    db.get("SELECT name, phone FROM users WHERE id = ?", [client_id], async (e, u) => {
                        const name = u ? u.name : 'Cliente';
                        const phone = u ? u.phone : null;
                        
                        // 1. ENVIA O EMAIL (Simplificado para PIX Manual)
                        if (email) {
                            const subject = `Nova Fatura Pendente: R$ ${amount}`;
                            const title = "Pagamento Pendente";
                            const msg = `Olá, <strong>${name}</strong>.<br><br>
                                         Uma nova fatura foi gerada para o seu envio: <strong>${description}</strong>.<br>
                                         Valor a pagar: <strong>R$ ${amount}</strong><br><br>
                                         Acesse o seu painel de cliente na Guineexpress para ver as opções de pagamento (PIX ou EcoBank) e anexar o seu comprovante.<br><br>
                                         <a href="https://guineexpress-f6ab.onrender.com/" style="background:#0a1931; color:#fff; padding:12px 25px; text-decoration:none; font-weight:bold; font-size:16px; border-radius:5px;">ACESSAR PAINEL</a>`;
                            
                            sendEmailHtml(email, subject, title, msg);
                        }

                        // 2. ENVIA O WHATSAPP (Avisando para acessar o painel)
                        if (phone && typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                            try {
                                let cleanPhone = phone.replace(/\D/g, '');
                                const numberId = await clientZap.getNumberId(cleanPhone);
                                
                                if (numberId) {
                                    const zapMsg = `Olá, *${name}*! 👋\n\nUma nova fatura foi gerada na Guineexpress para o seu envio (*${description}*).\n\n💰 *Valor Total:* R$ ${amount}\n\nAcesse o seu painel agora para efetuar o pagamento via PIX ou EcoBank e anexar o seu comprovante:\n\n🔗 https://guineexpress-f6ab.onrender.com/`;

                                    await clientZap.sendMessage(numberId._serialized, zapMsg);
                                    console.log(`✅ [ZAP] Fatura enviada por Zap para o cliente ${cleanPhone}`);
                                } else {
                                    console.log(`⚠️ [ZAP] Número ${cleanPhone} inválido. Tentando forçar...`);
                                    await clientZap.sendMessage(`${cleanPhone}@c.us`, zapMsg);
                                }
                            } catch (zapErr) {
                                console.error("❌ Erro ao enviar Zap da fatura:", zapErr.message);
                            }
                        } else {
                            console.log("⚠️ [ZAP] Cliente não notificado: Sem telefone cadastrado ou Robô do WhatsApp desconectado.");
                        }
                    });

                    // Retorna sucesso rápido para o painel do Admin não travar
                    res.json({success: true});
                });

    } catch (error) {
        console.error("Erro interno ao criar fatura:", error);
        res.status(500).json({success: false, msg: 'Erro interno no servidor'});
    }
});
// ==========================================
// ROTA: DAR BAIXA MANUAL NA FATURA (ADMIN)
// ==========================================
app.post('/api/invoices/:id/force-pay', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({success: false, message: 'Sem permissão'});

    const invoiceId = req.params.id;

    // Atualiza o status para 'approved' e limpa qualquer erro anterior
    const sql = "UPDATE invoices SET status = 'approved' WHERE id = ?";
    
    db.run(sql, [invoiceId], function(err) {
        if (err) {
            console.error("Erro ao forçar pagamento:", err);
            return res.json({ success: false, message: 'Erro ao salvar no banco.' });
        }
        res.json({ success: true, message: 'Fatura marcada como paga manualmente.' });
    });
});
// ==========================================
// ROTA PARA LISTAR AS FATURAS COM LOTE (AGORA VAI! 🚀)
// ==========================================
app.get('/api/invoices/list', (req, res) => {
    const sql = `
        SELECT 
            invoices.*,
            users.name as client_name,
            boxes.box_code,
            -- 🚀 A MÁGICA: Ele puxa o texto do Lote que você salvou direto na Caixa, ou da Encomenda!
            COALESCE(boxes.lote, orders.lote, 'Sem Lote') as lote,
            CASE 
                WHEN boxes.volumes > 1 THEN boxes.volumes 
                WHEN orders.volumes > 1 THEN orders.volumes 
                ELSE 1 
            END as volumes
        FROM invoices
        LEFT JOIN users ON invoices.client_id = users.id
        LEFT JOIN boxes ON invoices.box_id = boxes.id
        LEFT JOIN orders ON boxes.order_id = orders.id
        ORDER BY invoices.id DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Erro ao buscar faturas:", err.message);
            return res.status(500).json({ error: "Erro no banco de dados." });
        }
        res.json(rows);
    });
});
// ==================================================================
// SISTEMA DE PAGAMENTO ECOBANK (COMPROVATIVOS)
// ==================================================================

// 1. Atualiza a tabela de faturas para suportar a foto do comprovativo
// Ele tenta adicionar a coluna. Se já existir, ele ignora silenciosamente.
db.run("ALTER TABLE invoices ADD COLUMN receipt_url TEXT", (err) => { /* ignora erro se já existir */ });


// ==========================================
// RADAR DA CICÍ: FILA DE AVISOS
// ==========================================
// 1. Caixinha de avisos global
global.ciciAvisos = [];

// 2. Rota para a Cicí perguntar se tem novidade
app.get('/api/cici/avisos', (req, res) => {
    // Só o Admin (Lelo) recebe esses avisos
    if (req.session.role !== 'admin') return res.json([]);
    
    const avisos = [...global.ciciAvisos];
    global.ciciAvisos = []; // A Cicí já leu, então esvaziamos a caixinha
    res.json(avisos);
});

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

// 3. Rota para o ADMIN aprovar o comprovante
app.post('/api/invoices/:id/approve-receipt', (req, res) => {
    // Segurança: Apenas administradores podem aprovar
    if (req.session.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Sem permissão.' });
    }

    const invoiceId = req.params.id;

    // Muda o status para 'approved' (Pago)
    db.run("UPDATE invoices SET status = 'approved' WHERE id = ?", [invoiceId], function(err) {
        if (err) return res.json({ success: false });
        
        // Aqui o pagamento está aprovado! O sistema já vai ler como ✅ PAGO
        res.json({ success: true, message: 'Pagamento aprovado com sucesso!' });
    });
});
// ==============================================================
// 🌟 ROTA INTELIGENTE: COMPROVANTE DIRETO DO BANCO + ANÁLISE IA DA CICÍ
// ==============================================================
app.post('/receber-comprovante', upload.single('comprovante_banco'), async (req, res) => {
    try {
        if (!req.file) {
            return res.redirect('/dashboard-client.html?erro_share=sem_arquivo');
        }

        const clientId = req.session.userId;
        if (!clientId) {
            return res.redirect('/index.html?erro=precisa_logar');
        }

        const nomeDaFoto = req.file.filename;
        const receiptPath = '/uploads/' + nomeDaFoto;
        const fullFilePath = req.file.path; // Caminho completo para a IA ler

        // 1. Procura faturas pendentes do cliente
        db.all("SELECT id, amount FROM invoices WHERE client_id = ? AND status = 'pending'", [clientId], async (err, faturas) => {
            if (err || faturas.length !== 1) {
                // Se der erro ou se ele tiver mais de 1 fatura, devolve pro painel pra ele escolher.
                return res.redirect(`/dashboard-client.html?shared_file=${nomeDaFoto}`);
            }

            // CENÁRIO A: Auto-Match! Cliente tem SÓ UMA fatura pendente
            const invoiceId = faturas[0].id;
            const expectedAmount = parseFloat(faturas[0].amount);

            // Vincula a foto na fatura certa e muda o status
            db.run("UPDATE invoices SET status = 'in_review', receipt_url = ? WHERE id = ?", [receiptPath, invoiceId], async (err) => {
                if (err) return res.redirect('/dashboard-client.html?erro_share=banco');

                // Busca o nome do cliente para a mensagem
                db.get("SELECT name FROM users WHERE id = ?", [clientId], async (err, row) => {
                    const clientName = row ? row.name : "um cliente";
                    let mensagemCici = "";

                    // ==========================================
                    // 🤖 2. A CICÍ ENTRA EM AÇÃO PARA ANALISAR O COMPROVANTE DO APP DO BANCO
                    // ==========================================
                    try {
                        const arquivoPart = fileToGenerativePart(fullFilePath, req.file.mimetype);
                        const dataHoje = new Date().toLocaleDateString('pt-BR');
                        
                        const prompt = `
                        Você é um auditor financeiro rigoroso. Analise este arquivo.
                        Hoje é dia ${dataHoje}. O valor exato cobrado é R$ ${expectedAmount}.
                        
                        Responda APENAS em formato JSON:
                        {"eh_comprovante": true, "agendado": false, "valor_bate": true, "data_pagamento": "DD/MM/AAAA", "id_transacao": "codigo", "alerta_data": false, "motivo": "..."}
                        
                        Regras:
                        1. "eh_comprovante": É um comprovante bancário real?
                        2. "agendado": É um agendamento futuro?
                        3. "valor_bate": O valor pago é EXATAMENTE R$ ${expectedAmount}?
                        4. "data_pagamento": Extraia a data do pagamento.
                        5. "id_transacao": Extraia o Código de Autenticação/Transação. Se não achar, escreva "Nao_Encontrado".
                        6. "alerta_data": Marque true SE a data for MAIS VELHA que 10 dias de hoje (${dataHoje}).
                        7. "motivo": Explique brevemente.
                        `;

                        const result = await model.generateContent([prompt, arquivoPart]);
                        const iaRespostaText = result.response.text().trim().replace(/```json/g, '').replace(/```/g, '');
                        const analise = JSON.parse(iaRespostaText);

                        // 🛡️ VERIFICAÇÃO ANTI-FRAUDE
                        let comprovanteReciclado = false;
                        let idFaturaAntiga = null;

                        if (analise.id_transacao && analise.id_transacao !== "Nao_Encontrado" && analise.id_transacao.length > 5) {
                            db.run("UPDATE invoices SET transaction_id = ? WHERE id = ?", [analise.id_transacao, invoiceId]);

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

                        // 3. A CICÍ DECIDE O QUE FALAR PARA O LELO (Com o prefixo de Auto-Match)
                        const prefixo = `⚡ **Auto-Match (App do Banco)!** `;
                        
                        if (comprovanteReciclado) {
                            mensagemCici = `${prefixo} 🚨 **GOLPE DETECTADO!** Lelo, o cliente **${clientName}** enviou direto do banco um comprovante para a Fatura #${invoiceId} que **JÁ FOI USADO** antes na Fatura #${idFaturaAntiga}! Não aprove! <br>💳 *ID Reciclado:* ${analise.id_transacao} <br><br> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Ver Prova do Golpe</button>`;
                        
                        } else if (!analise.eh_comprovante) {
                            mensagemCici = `${prefixo} ❌ **ARQUIVO INVÁLIDO!** Lelo, o cliente **${clientName}** compartilhou para a Fatura #${invoiceId}, mas a foto **não é um recibo bancário**. Motivo: ${analise.motivo}. <br><br> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Ver Foto</button>`;
                        
                        } else if (analise.agendado) {
                            mensagemCici = `${prefixo} 🚨 **ALERTA!** Lelo, o cliente **${clientName}** enviou para a Fatura #${invoiceId}, mas a IA detectou que é um **AGENDAMENTO**. Cuidado! <br><br> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Ver Arquivo Suspeito</button>`;
                        
                        } else if (!analise.valor_bate) {
                            mensagemCici = `${prefixo} ⚠️ **VALOR INCORRETO!** Lelo, o cliente **${clientName}** mandou o comprovante (Fatura #${invoiceId}), mas o **valor não bate** com os R$ ${expectedAmount}. Motivo: ${analise.motivo}. <br><br> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#f39c12; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Analisar Manualmente</button>`;
                        
                        } else if (analise.alerta_data) {
                            mensagemCici = `${prefixo} ⏳ **COMPROVANTE ANTIGO!** Lelo, o cliente **${clientName}** mandou o valor certo na Fatura #${invoiceId}, mas a data é antiga (${analise.data_pagamento}). Verifique! <br>💳 *ID:* ${analise.id_transacao} <br><br> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#e67e22; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Analisar Manualmente</button>`;

                        } else {
                            mensagemCici = `${prefixo} ✅ **TUDO CERTO!** Lelo, analisei o comprovante de **${clientName}** (Fatura #${invoiceId}). O valor (R$ ${expectedAmount}) está correto e é novo (${analise.data_pagamento})! Nenhuma fraude. Posso dar baixa? <br>💳 *ID:* ${analise.id_transacao} <br><br> <button onclick="approveInvoice(${invoiceId})" style="background:#28a745; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">👍 Sim, Aprovar Agora</button> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#6c757d; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; margin-left:5px;">Ver Arquivo</button>`;
                        }

                    } catch (iaErr) {
                        console.error("Erro na leitura da Cicí pelo PWA:", iaErr);
                        mensagemCici = `⚡ **Auto-Match!** Lelo, vinculei o comprovante do banco do cliente **${clientName}** à Fatura #${invoiceId}, mas a IA teve dificuldade em ler a foto. Analise manualmente. <br><br> <button onclick="viewReceipt(${invoiceId}, '${receiptPath}')" style="background:#17a2b8; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Ver Comprovante</button>`;
                    }

                    // Envia a notificação da Cicí
                    if (!global.ciciAvisos) global.ciciAvisos = [];
                    global.ciciAvisos.push(mensagemCici);

                    // ==========================================
                    // --- Manda a notificação no Zap do Admin ---
                    // ==========================================
                    if (typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                        try {
                            const msgAdmin = `🚀 *PAGAMENTO EXPRESSO*\n\nComprovante direto do banco vinculado à *Fatura #${invoiceId}*. A Cicí já analisou no painel!`;
                            const idOficial = await clientZap.getNumberId("5585998239207"); // Seu número
                            if (idOficial) await clientZap.sendMessage(idOficial._serialized, msgAdmin);
                            else await clientZap.sendMessage(`5585998239207@c.us`, msgAdmin);
                        } catch (zapErr) { console.error("Erro zap:", zapErr.message); }
                    }

                    // Redireciona o cliente para o painel com aviso de SUCESSO!
                    return res.redirect('/dashboard-client.html?sucesso_share=auto_match');
                });
            });
        });

    } catch (error) {
        console.error("Erro geral na rota receber-comprovante:", error);
        res.redirect('/dashboard-client.html?erro_share=falha');
    }
});

// ==============================================================
// 🌟 ROTA PARA VINCULAR A FOTO DO BANCO COM A FATURA DO CLIENTE
// ==============================================================
app.post('/api/invoices/:id/link-shared-receipt', express.json(), (req, res) => {
    const invoiceId = req.params.id;
    const filename = req.body.filename; // O nome da foto que o painel mandou

    if (!filename) return res.json({ success: false, message: 'Nome da foto ausente.' });

    const receiptPath = '/uploads/' + filename;
    const sql = "UPDATE invoices SET status = 'in_review', receipt_url = ? WHERE id = ?";
    
    db.run(sql, [receiptPath, invoiceId], async function(err) {
        if (err) return res.json({ success: false, message: 'Erro ao salvar no banco.' });

        // --- Notificação no WhatsApp do Admin ---
        if (typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
            try {
                const meuNumeroAdmin = "5585998239207"; // Seu número (pode mudar se precisar)
                const msgAdmin = `🔔 *NOVO PAGAMENTO (DIRETO DO BANCO)*\n\nUm cliente compartilhou o comprovante direto do banco para a *Fatura #${invoiceId}*.`;
                const idOficial = await clientZap.getNumberId(meuNumeroAdmin);
                if (idOficial) await clientZap.sendMessage(idOficial._serialized, msgAdmin);
                else await clientZap.sendMessage(`${meuNumeroAdmin}@c.us`, msgAdmin);
            } catch (zapErr) { console.error("Erro zap:", zapErr.message); }
        }

        // --- Notificação da Cicí ---
        db.get("SELECT users.name FROM invoices JOIN users ON invoices.client_id = users.id WHERE invoices.id = ?", [invoiceId], (err, row) => {
            const clientName = row ? row.name : "um cliente";
            const mensagemCici = `Olá Lelo! O cliente **${clientName}** acabou de enviar o comprovante direto do App do Banco. Fatura: ${invoiceId}.`;
            if (!global.ciciAvisos) global.ciciAvisos = [];
            global.ciciAvisos.push(mensagemCici);
        });

        res.json({ success: true, message: 'Comprovante recebido com sucesso!' });
    });
});
// 3. Excluir Cobrança (Admin)
app.post('/api/invoices/delete', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    db.run("DELETE FROM invoices WHERE id = ?", [req.body.id], (err) => res.json({success: !err}));
});

// 4. Verificar Status (Webhook Simulado)
// O botão "Verificar Pagamento" vai chamar isso para atualizar o status real
app.post('/api/invoices/check-status', async (req, res) => {
    const { mp_payment_id, invoice_id } = req.body;
    
    try {
        // Consulta o status atual no Mercado Pago
        const checkPayment = await new Payment(client).get({ id: mp_payment_id });
        const currentStatus = checkPayment.status; // 'approved', 'pending', etc.

        // Atualiza no banco
        db.run("UPDATE invoices SET status = ? WHERE id = ?", [currentStatus, invoice_id], (err) => {
            res.json({ success: true, status: currentStatus });
        });

    } catch (error) {
        res.json({ success: false });
    }
});
// --- ROTA: PEGAR FATURAS DO CLIENTE LOGADO (CORRIGIDA) ---
app.get('/api/invoices/my_invoices', (req, res) => {
    // 1. Verifica se o ID do usuário está na sessão (Correção aqui)
    if (!req.session.userId) {
        return res.status(401).json({ msg: 'Usuário não autenticado' });
    }

    const clientId = req.session.userId; // Correção: usa userId direto

    // 2. Busca as faturas
    // Nota: Se der erro de 'no such column: mp_payment_link', remova essa coluna do SELECT abaixo
    const sql = `
        SELECT i.id, i.amount, i.status, i.payment_link, b.box_code
        FROM invoices i
        LEFT JOIN boxes b ON i.box_id = b.id
        WHERE i.client_id = ?
        ORDER BY i.id DESC
    `;

    db.all(sql, [clientId], (err, rows) => {
        if (err) {
            console.error("Erro ao buscar faturas:", err);
            return res.status(500).json({ err: err.message });
        }
        res.json(rows);
    });
});
// ==============================================================
// 🧠 MEMÓRIA DE CURTO PRAZO DA CICÍ (Fica fora da rota, lá no topo do código)
// ==============================================================
const pagamentosRecentes = new Set();

// ==============================================================
// 📱 🤖 CICI: OUVINTE DE NOTIFICAÇÕES DO CELULAR E TABLET (MERCADO PAGO via MACRODROID)
// ==============================================================
app.post('/api/cici-macrodroid', express.json(), (req, res) => {
    // 🛡️ Senha secreta para ninguém na internet forjar um pagamento falso
    const tokenSecreto = "senha_guineexpress_secreta_123"; 
    
    console.log("📥 Dados recebidos do aparelho:", req.body);
    
    if (req.body.token !== tokenSecreto) {
        console.log(`⚠️ Acesso negado. A Cicí recebeu a senha: '${req.body.token}'`);
        return res.status(403).json({ erro: 'Token inválido' });
    }

    const textoNotificacao = req.body.texto || "";
    console.log(`📱 Cicí leu a notificação: "${textoNotificacao}"`);
    
    const matchValor = textoNotificacao.match(/R\$\s?([\d\.,]+)/);
    
    if (matchValor) {
        let valorLimpo = matchValor[1].replace(/\.(?=\d{3})/g, '').replace(',', '.'); 
        const valorRecebido = parseFloat(valorLimpo);
        
        // 🛑 ESCUDO ANTI-GRITO DUPLO
        const chavePix = `mp_${valorRecebido}`;
        if (pagamentosRecentes.has(chavePix)) {
            console.log(`🔄 Pix de R$ ${valorRecebido} ignorado. O outro aparelho já avisou agorinha!`);
            return res.json({ success: true, message: 'Já processado pelo outro aparelho' });
        }
        
        pagamentosRecentes.add(chavePix);
        setTimeout(() => { pagamentosRecentes.delete(chavePix); }, 120000);

        console.log(`💰 Valor lido do Mercado Pago: R$ ${valorRecebido}`);

        db.all("SELECT id, client_id, amount FROM invoices WHERE status = 'pending'", [], async (err, todasFaturas) => {
            if (err) {
                pagamentosRecentes.delete(chavePix); 
                return res.status(500).json({ erro: 'Erro no banco de dados' });
            }

            // 🛡️ A MÁGICA DO VALOR EXATO (Mercado Pago)
            const faturas = todasFaturas.filter(f => {
                let valorBancoStr = String(f.amount).replace(/[^\d.,]/g, '');
                let valorBanco = 0;
                
                if (valorBancoStr.includes(',')) {
                    valorBanco = parseFloat(valorBancoStr.replace(/\./g, '').replace(',', '.'));
                } else {
                    valorBanco = parseFloat(valorBancoStr);
                }
                
                // 🎯 EXIGE VALOR EXATO! Sem margem de erro.
                return valorBanco === valorRecebido; 
            });

            // CENÁRIO A: Uma fatura exata
            if (faturas.length === 1) {
                const invoiceId = faturas[0].id;
                const clientId = faturas[0].client_id;

                db.run("UPDATE invoices SET status = 'approved' WHERE id = ?", [invoiceId], async (updateErr) => {
                    if (updateErr) return console.error('Erro ao aprovar fatura pelo celular:', updateErr);

                    db.get("SELECT name FROM users WHERE id = ?", [clientId], async (userErr, row) => {
                        const clientName = row ? row.name : "um cliente";
                        if (typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                            try {
                                const msgZap = `📱 *MERCADO PAGO (AUTO)*\n\nLelo, o Mercado Pago apitou no aparelho e a Cicí já deu baixa! Pix de R$ ${valorRecebido} aprovado na *Fatura #${invoiceId}* de *${clientName}*! ✅`;
                                const idOficial = await clientZap.getNumberId("5585998239207"); 
                                if (idOficial) await clientZap.sendMessage(idOficial._serialized, msgZap);
                                else await clientZap.sendMessage(`5585998239207@c.us`, msgZap);
                            } catch (zapErr) { console.error("Erro zap MacroDroid:", zapErr.message); }
                        }
                    });
                });
            } 
            // CENÁRIO B: Pede ajuda
            else {
                pagamentosRecentes.delete(chavePix); 
                if (typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                    try {
                        const msgZap = faturas.length > 1 
                            ? `📱 *CICI PRECISA DE AJUDA!*\n\nLelo, o Mercado Pago avisou no celular de um Pix EXATO de *R$ ${valorRecebido}*, mas o sistema falhou e gerou ${faturas.length} faturas com esse mesmo valor. Aprovação manual necessária no painel!`
                            : `📱 *PIX SEM DONO (Mercado Pago)!*\n\nLelo, notificação de *R$ ${valorRecebido}* recebida, mas não achei nenhuma fatura com esse valor exato. Verifique o app!`;
                        
                        const idOficial = await clientZap.getNumberId("5585998239207"); 
                        if (idOficial) await clientZap.sendMessage(idOficial._serialized, msgZap);
                        else await clientZap.sendMessage(`5585998239207@c.us`, msgZap);
                    } catch (zapErr) { console.error("Erro zap MacroDroid ajuda:", zapErr.message); }
                }
            }
        });
    } else {
        res.json({ success: true, message: 'Nenhum valor encontrado na notificação' });
    }
});

// ==============================================================
// 🏦 🤖 CICI: MONITORAMENTO DE E-MAIL DO NUBANK (AUTO-APROVAÇÃO)
// ==============================================================
const { ImapFlow } = require('imapflow');
const simpleParser = require('mailparser').simpleParser;

const EMAIL_USER = 'Comercialguineexpress245@gmail.com'; 
const EMAIL_PASS = 'pzbqkufiwqyppovw'; 

const clientImap = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    },
    logger: false 
});
// ==========================================
// 🛡️ AIRBAG DA CICÍ: IMPEDE O SERVIDOR DE CAIR
// ==========================================
clientImap.on('error', err => {
    console.log("⚠️ Cicí: A conexão com o Gmail oscilou (Timeout). O servidor está protegido e continua rodando!");
});

clientImap.on('close', () => {
    console.log("🔄 Cicí: A conexão com o Gmail fechou. Tentando reconectar sozinha em 15 segundos...");
    
    // Faz a Cicí tentar ligar a vigilância de novo automaticamente!
    setTimeout(() => {
        startEmailMonitor();
    }, 15000); 
});

const startEmailMonitor = async () => {
    try {
        await clientImap.connect();
        console.log('🤖 Cicí: Conectada ao Gmail com sucesso. Vigiando Pix do Nubank...');

        let lock = await clientImap.getMailboxLock('INBOX');
        try {
            clientImap.on('exists', async (data) => {
                console.log(`📥 Novo e-mail recebido! Total na caixa: ${data.count}`);
                
                let message = await clientImap.fetchOne('*', { source: true });
                if (!message) return;

                let parsed = await simpleParser(message.source);
                const remetente = parsed.from.value[0].address;
                const assunto = parsed.subject;
                const corpo = parsed.text || parsed.html || '';

                if (remetente.includes('nubank.com.br') && (assunto.includes('Pix') || assunto.includes('transferência'))) {
                    console.log('👀 Cicí: E-mail do Nubank detectado! Analisando...');

                    const matchValor = corpo.match(/R\$\s?(\d{1,3}(?:\.\d{3})*,\d{2})/);
                    if (matchValor) {
                        let valorString = matchValor[1].replace('.', '').replace(',', '.'); 
                        const valorRecebido = parseFloat(valorString);
                        console.log(`💰 Valor do Pix lido: R$ ${valorRecebido}`);

                        db.all("SELECT id, client_id, amount FROM invoices WHERE status = 'pending'", [], async (err, todasFaturas) => {
                            if (err) return console.error('Erro ao buscar faturas por valor:', err);

                            // 🛡️ A MÁGICA DO VALOR EXATO (Nubank)
                            const faturas = todasFaturas.filter(f => {
                                let valorBancoStr = String(f.amount).replace(/[^\d.,]/g, '');
                                let valorBanco = 0;
                                if (valorBancoStr.includes(',')) {
                                    valorBanco = parseFloat(valorBancoStr.replace(/\./g, '').replace(',', '.'));
                                } else {
                                    valorBanco = parseFloat(valorBancoStr);
                                }
                                
                                // 🎯 EXIGE VALOR EXATO! Sem margem de erro.
                                return valorBanco === valorRecebido; 
                            });

                            if (faturas.length === 1) {
                                const invoiceId = faturas[0].id;
                                const clientId = faturas[0].client_id;

                                db.run("UPDATE invoices SET status = 'approved' WHERE id = ?", [invoiceId], async (updateErr) => {
                                    if (updateErr) return console.error('Erro ao aprovar fatura pelo email:', updateErr);

                                    db.get("SELECT name FROM users WHERE id = ?", [clientId], async (userErr, row) => {
                                        const clientName = row ? row.name : "um cliente";
                                        
                                        if (typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                                            try {
                                                const msgZap = `🤖 *CICÍ APROVOU SOZINHA!*\n\nLelo, o Pix de R$ ${valorRecebido} do Nubank acabou de cair. Como eu achei a fatura com o valor EXATO, já dei baixa na *Fatura #${invoiceId}* do cliente *${clientName}*! ✅`;
                                                const idOficial = await clientZap.getNumberId("5585998239207"); 
                                                if (idOficial) await clientZap.sendMessage(idOficial._serialized, msgZap);
                                                else await clientZap.sendMessage(`5585998239207@c.us`, msgZap);
                                            } catch (zapErr) { console.error("Erro zap da Cicí Email:", zapErr.message); }
                                        }
                                        console.log(`✅ Cicí aprovou a Fatura #${invoiceId} via e-mail do Nubank!`);
                                    });
                                });
                            } 
                            else {
                                console.log(`⚠️ Alerta: Existem ${faturas.length} faturas com o valor exato de R$ ${valorRecebido}. Aprovação manual necessária.`);
                                if (typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                                    try {
                                        let msgErro = '';
                                        if (faturas.length > 1) {
                                            msgErro = `🤖 *CICI PRECISA DE AJUDA!*\n\nLelo, caiu um Pix do Nubank de *R$ ${valorRecebido}*. Mas existem ${faturas.length} clientes devendo EXATAMENTE esse mesmo valor (o sistema de centavos falhou!). Por segurança, não dei baixa. Confira no extrato de quem foi e aprove no painel.`;
                                        } else {
                                            msgErro = `🤖 *PIX SEM DONO!*\n\nLelo, caiu um Pix do Nubank de *R$ ${valorRecebido}*, mas não encontrei *nenhuma* fatura pendente com esse valor EXATO no sistema. Verifique o app do Nubank!`;
                                        }
                                        const idOficial = await clientZap.getNumberId("5585998239207"); 
                                        if (idOficial) await clientZap.sendMessage(idOficial._serialized, msgErro);
                                        else await clientZap.sendMessage(`5585998239207@c.us`, msgErro);
                                    } catch (zapErr) { console.error("Erro zap da Cicí Email (Ajuda):", zapErr.message); }
                                }
                            }
                        });
                    }
                }
            });
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error('Erro na conexão do IMAP da Cicí:', err);
    }
};

startEmailMonitor();

// --- ROTA: RECUPERAR SENHA (CORRIGIDA) ---
app.post('/api/recover-password', (req, res) => {
    // Pegamos apenas o email. Não importa a 'role' que veio do front,
    // nós vamos forçar a busca apenas por CLIENTES no banco de dados.
    const { email } = req.body;

    if (!email) return res.json({ success: false, msg: "E-mail é obrigatório." });

    // --- REMOVI O BLOCO "IF" QUE BLOQUEAVA ADMIN/EMPLOYEE AQUI ---
    // Motivo: A consulta SQL abaixo já filtra "AND role = 'client'". 
    // Se um Admin tentar, o banco simplesmente não vai achar nada e retornará "Cliente não encontrado",
    // o que é mais seguro e evita o erro de usabilidade.

    // 2. Busca APENAS se for role='client'
    const sqlFind = `SELECT * FROM users WHERE (email = ? OR phone = ?) AND role = 'client'`;
    
    db.get(sqlFind, [email, email], (err, user) => {
        if (err || !user) {
            // Se for um Admin tentando, vai cair aqui (User not found), o que é perfeito.
            return res.json({ success: false, msg: "Cliente não encontrado com este e-mail." });
        }

        // 3. Gera nova senha e envia
        const newPassword = Math.random().toString(36).slice(-6).toUpperCase(); 
        const newHash = bcrypt.hashSync(newPassword, 10);

        db.run("UPDATE users SET password = ? WHERE id = ?", [newHash, user.id], (errUpdate) => {
            if (errUpdate) {
                return res.status(500).json({ success: false, msg: "Erro ao atualizar senha." });
            }

            const mailOptions = {
                from: '"Guineexpress" <seu_email_aqui@gmail.com>', 
                to: user.email,
                subject: 'Sua Nova Senha - Guineexpress',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2>Olá, ${user.name}</h2>
                        <p>Recebemos seu pedido de recuperação de senha.</p>
                        <p>Sua nova senha temporária é:</p>
                        <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 5px;">${newPassword}</h1>
                        <p>Acesse sua conta e altere para uma senha de sua preferência.</p>
                    </div>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("Erro email:", error);
                    return res.json({ success: false, msg: "Erro técnico ao enviar e-mail. A senha foi alterada, contate o suporte." });
                }
                res.json({ success: true, msg: "Verifique seu e-mail (e a caixa de SPAM) para pegar a nova senha." });
            });
        });
    });
});
// --- ROTA: ADMIN REDEFINIR SENHA DE CLIENTE ---
app.post('/api/admin-reset-password', (req, res) => {
    // Verificação de Segurança Opcional: Aqui você pode verificar se req.session.user.role === 'admin' ou 'employee'
    
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
        return res.json({ success: false, msg: "Dados incompletos." });
    }

    if (newPassword.length < 6) {
        return res.json({ success: false, msg: "A senha deve ter pelo menos 6 caracteres." });
    }

    // Criptografa a nova senha digitada pelo admin
    const newHash = bcrypt.hashSync(newPassword, 10);

    // Atualiza apenas a senha do usuário especificado
    db.run("UPDATE users SET password = ? WHERE id = ? AND role = 'client'", [newHash, userId], function(err) {
        if (err) {
            console.error("Erro ao redefinir senha:", err);
            return res.status(500).json({ success: false, msg: "Erro no banco de dados." });
        }
        
        if (this.changes === 0) {
            return res.json({ success: false, msg: "Cliente não encontrado ou não autorizado." });
        }

        res.json({ success: true, msg: "Senha atualizada com sucesso." });
    });
});
// --- ROTA: HISTÓRICO DE ENVIOS ---
app.get('/api/history', (req, res) => {
    // Base da Query: Pega dados da encomenda e o nome do dono
    let sql = `SELECT orders.*, users.name as client_name 
               FROM orders 
               JOIN users ON orders.client_id = users.id`;
    
    let params = [];

    // Se for CLIENTE, filtra para ver só os dele
    if (req.session.role === 'client') {
        sql += " WHERE orders.client_id = ?";
        params.push(req.session.userId);
    }
    // Se for Admin/Employee, não tem WHERE, vê tudo.

    // Ordena do mais recente para o mais antigo
    sql += " ORDER BY orders.created_at DESC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.json([]);
        }
        res.json(rows);
    });
});
// =======================================================
// ROTA DE IMPRESSÃO INTELIGENTE (RECIBO COMPLETO)
// =======================================================
app.get('/api/print-receipt/:boxId', (req, res) => {
    const boxId = req.params.boxId;

    // 1. Pega a Box selecionada
    db.get("SELECT * FROM boxes WHERE id = ?", [boxId], (err, currentBox) => {
        if (err || !currentBox) {
            return res.json({ success: false, msg: "Box não encontrado." });
        }

        // 2. Busca dados da Encomenda vinculada e do Cliente
        // Se a box não tiver encomenda (order_id null), busca só o cliente
        let sqlData = "";
        let params = [];

        if (currentBox.order_id) {
            // Tem encomenda: Traz dados da Ordem + Cliente
            sqlData = `
                SELECT orders.code as order_code, orders.status as order_status, orders.created_at as order_date,
                       users.name as client_name, users.phone, users.document, users.email, users.country
                FROM orders
                JOIN users ON orders.client_id = users.id
                WHERE orders.id = ?
            `;
            params = [currentBox.order_id];
        } else {
            // Box Avulsa: Traz só dados do Cliente
            sqlData = `SELECT name as client_name, phone, document, email, country FROM users WHERE id = ?`;
            params = [currentBox.client_id];
        }

        db.get(sqlData, params, (err, dataInfo) => {
            if (err) return res.json({ success: false, msg: "Erro ao buscar dados." });

            // 3. Busca TODAS as boxes que pertencem à mesma encomenda (para listar tudo junto no recibo)
            // Se for box avulsa, traz só ela mesma.
            let sqlAllBoxes = "";
            let paramsBoxes = [];

            if (currentBox.order_id) {
                sqlAllBoxes = "SELECT * FROM boxes WHERE order_id = ?";
                paramsBoxes = [currentBox.order_id];
            } else {
                sqlAllBoxes = "SELECT * FROM boxes WHERE id = ?";
                paramsBoxes = [boxId];
            }

            db.all(sqlAllBoxes, paramsBoxes, (err, allBoxes) => {
                // Retorna o pacote completo para o Javascript montar o PDF
                res.json({ 
                    success: true, 
                    info: dataInfo || {}, // Dados do Cliente/Ordem
                    boxes: allBoxes,       // Lista de Caixas
                    currentBox: currentBox // A caixa que foi clicada
                });
            });
        });
    });
});
// ==========================================
// ROTA DASHBOARD BI (ESTATÍSTICAS)
// ==========================================
// --- ROTA: DADOS DO DASHBOARD (GRÁFICOS REAIS E SEM LIXO) ---
app.get('/api/dashboard-stats', (req, res) => {
    
    // 1. Totais Gerais (Cards do Topo) - Agora ignorando os deletados!
    const sqlTotals = `
        SELECT 
            (SELECT SUM(price) FROM orders WHERE deleted = 0 OR deleted IS NULL) as revenue,
            (SELECT SUM(weight) FROM orders WHERE deleted = 0 OR deleted IS NULL) as weight,
            (SELECT COUNT(*) FROM orders WHERE deleted = 0 OR deleted IS NULL) as totalOrders,
            (SELECT COUNT(*) FROM users WHERE role = 'client') as totalClients
    `;

    // 2. Distribuição de Status (Gráfico de Rosca) - Sem lixo!
    const sqlStatus = `
        SELECT status, COUNT(*) as count 
        FROM orders 
        WHERE deleted = 0 OR deleted IS NULL 
        GROUP BY status
    `;

    // 3. Faturamento Mensal - Últimos 6 Meses (Gráfico de Barras) - Só lucro real!
    const sqlMonthly = `
        SELECT strftime('%m/%Y', created_at) as month, SUM(price) as total 
        FROM orders 
        WHERE created_at >= date('now', '-6 months') AND (deleted = 0 OR deleted IS NULL)
        GROUP BY month 
        ORDER BY created_at ASC
    `;

    db.get(sqlTotals, [], (err, totals) => {
        if (err) return res.json({ success: false });

        db.all(sqlStatus, [], (err, statusRows) => {
            
            db.all(sqlMonthly, [], (err, monthlyRows) => {
                
                // Prepara os meses e envia os dados limpos
                res.json({
                    success: true,
                    data: {
                        revenue: totals.revenue || 0,
                        weight: totals.weight || 0,
                        totalOrders: totals.totalOrders || 0,
                        totalClients: totals.totalClients || 0,
                        statusDistribution: statusRows || [],
                        revenueHistory: monthlyRows || []
                    }
                });
            });
        });
    });
});
// ==========================================
// ROTA DO RECIBO PRO (COM STATUS DE PAGAMENTO E NOTA FISCAL)
// ==========================================
app.get('/api/receipt-data/:boxId', (req, res) => {
    const boxId = req.params.boxId;

    const sqlBox = `
        SELECT 
            boxes.id, boxes.box_code, boxes.amount, boxes.products, boxes.created_at, 
            boxes.receiver_name, boxes.receiver_doc,
            CASE 
                WHEN boxes.volumes > 1 THEN boxes.volumes 
                WHEN orders.volumes > 1 THEN orders.volumes 
                ELSE 1 
            END as volumes,
            orders.weight as weight, 
            orders.code as order_code,
            users.name as client_name, users.phone, users.document, users.country, users.email,
            invoices.status as payment_status, 
            invoices.nf_amount,                
            invoices.freight_amount            
        FROM boxes
        LEFT JOIN users ON boxes.client_id = users.id
        LEFT JOIN orders ON boxes.order_id = orders.id
        LEFT JOIN invoices ON boxes.id = invoices.box_id
        WHERE boxes.id = ?
    `;

    db.get(sqlBox, [boxId], (err, box) => {
        if (err) return res.json({ success: false, msg: "Erro no banco." });
        if (!box) return res.json({ success: false, msg: "Box não encontrada." });

        db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err2, setting) => {
            let pricePerKg = setting ? parseFloat(setting.value) : 0;
            let currentAmount = parseFloat(box.amount) || 0;
            let weight = parseFloat(box.weight) || 0;

            if (currentAmount === 0 && weight > 0 && pricePerKg > 0) {
                currentAmount = weight * pricePerKg;
            }

            box.amount = currentAmount.toFixed(2);
            box.weight = weight.toFixed(2);
            box.nf_amount = parseFloat(box.nf_amount || 0).toFixed(2);
            box.freight_amount = parseFloat(box.freight_amount || currentAmount).toFixed(2);
            box.volumes = box.volumes || 1;
            box.is_paid = (box.payment_status === 'approved' || box.payment_status === 'paid'); 

            res.json({ success: true, data: box });
        });
    });
});
// ==========================================
// ROTA NOVA: CLIENTE INFORMA QUEM VAI RECEBER
// ==========================================
app.post('/api/boxes/set-receiver', (req, res) => {
    if(!req.session.userId) return res.status(401).json({success: false, msg: 'Não logado'});
    
    const { box_id, receiver_name, receiver_doc } = req.body;
    
    db.run(`UPDATE boxes SET receiver_name = ?, receiver_doc = ? WHERE id = ?`, 
        [receiver_name, receiver_doc, box_id], 
        (err) => {
            if(err) return res.json({success: false, msg: 'Erro ao salvar'});
            res.json({success: true});
        }
    );
});
// ==========================================
// SISTEMA DE BACKUP AUTOMÁTICO
// ==========================================

// Função que executa a cópia do arquivo
function performBackup() {
    const backupDir = './backups';
    const dbFile = './guineexpress_v4.db';
    
    // 1. Cria a pasta 'backups' se não existir
    if (!fs.existsSync(backupDir)){
        fs.mkdirSync(backupDir);
    }

    // 2. Gera nome do arquivo com Data e Hora (ex: backup-2023-10-25-1430.db)
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 16); // Formata data
    const destFile = path.join(backupDir, `backup-${timestamp}.db`);

    // 3. Copia o arquivo
    fs.copyFile(dbFile, destFile, (err) => {
        if (err) {
            console.error('❌ Erro no Backup:', err);
        } else {
            console.log(`✅ Backup realizado com sucesso: ${destFile}`);
            
            // (Opcional) Limpeza: Mantém apenas os últimos 7 backups para não encher o disco
            fs.readdir(backupDir, (err, files) => {
                if (files.length > 30) {
                    // Lógica simples para remover os mais antigos se tiver muitos
                    const oldFile = path.join(backupDir, files[0]);
                    fs.unlink(oldFile, () => console.log("Backup antigo removido."));
                }
            });
        }
    });
}

// AGENDAMENTO: Roda todo dia à 00:00 (Meia-noite)
cron.schedule('0 0 * * *', () => {
    console.log('⏳ Iniciando backup automático...');
    performBackup();
});

// ROTA MANUAL: Para chamar via botão no Painel
app.get('/api/admin/force-backup', (req, res) => {
    // Verifica se é admin (opcional, mas recomendado)
    // if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({});

    try {
        performBackup();
        res.json({ success: true, msg: "Backup realizado e salvo na pasta /backups!" });
    } catch (e) {
        res.json({ success: false, msg: "Erro ao fazer backup." });
    }
});
// ==========================================
// LOGÍSTICA DE EMBARQUES (MANIFESTO)
// ==========================================

// 1. Criar Novo Embarque
app.post('/api/shipments/create', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    const { code, type, departure_date } = req.body;
    
    db.run("INSERT INTO shipments (code, type, status, departure_date) VALUES (?, ?, 'Aberto', ?)", 
        [code, type, departure_date], 
        (err) => res.json({ success: !err })
    );
});

// 2. Listar Embarques
app.get('/api/shipments/list', (req, res) => {
    // Traz o embarque e CONTA quantas caixas tem dentro
    const sql = `SELECT s.*, COUNT(b.id) as box_count 
                 FROM shipments s 
                 LEFT JOIN boxes b ON b.shipment_id = s.id 
                 GROUP BY s.id ORDER BY s.id DESC`;
    db.all(sql, (err, rows) => res.json(rows || []));
});

// 3. Listar Caixas "Órfãs" (Sem embarque)
app.get('/api/shipments/pending-boxes', (req, res) => {
    // Só mostra caixas que NÃO têm shipment_id
    const sql = `SELECT b.id, b.box_code, u.name as client_name 
                 FROM boxes b 
                 JOIN users u ON b.client_id = u.id 
                 WHERE b.shipment_id IS NULL OR b.shipment_id = 0`;
    db.all(sql, (err, rows) => res.json(rows || []));
});

// 4. Adicionar Caixa ao Embarque
app.post('/api/shipments/add-box', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    const { shipment_id, box_id } = req.body;
    
    db.run("UPDATE boxes SET shipment_id = ? WHERE id = ?", [shipment_id, box_id], (err) => {
        res.json({ success: !err });
    });
});

// 5. Dados para o Manifesto (Impressão)
app.get('/api/shipments/manifest/:id', (req, res) => {
    const shipId = req.params.id;
    
    // Dados do Embarque
    db.get("SELECT * FROM shipments WHERE id = ?", [shipId], (err, shipment) => {
        if(!shipment) return res.json({ success: false });

        // Itens do Embarque (Caixas + Clientes + Encomendas)
        const sqlItems = `
            SELECT b.box_code, b.products, u.name as client_name, u.document, u.country, o.weight 
            FROM boxes b
            JOIN users u ON b.client_id = u.id
            LEFT JOIN orders o ON b.order_id = o.id
            WHERE b.shipment_id = ?
        `;
        
        db.all(sqlItems, [shipId], (err, items) => {
            res.json({ success: true, shipment, items });
        });
    });
});
// --- ROTA: Pegar UMA encomenda pelo ID (Para preencher o modal de edição) ---
app.get('/api/orders/:id', (req, res) => {
    db.get("SELECT * FROM orders WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json(null);
        res.json(row);
    });
});
// ==============================================================
// ROTA RECRIADA: BUSCAR ENCOMENDAS POR CLIENTE (PARA O NOVO BOX)
// ==============================================================
app.get('/api/orders/by-client/:clientId', (req, res) => {
    const clientId = req.params.clientId;
    
    // MÁGICA: Adicionamos ORDER BY id DESC para pegar a mais nova primeiro!
    const sql = `
        SELECT id, code, description, lote 
        FROM orders 
        WHERE client_id = ? AND (deleted = 0 OR deleted IS NULL)
        ORDER BY id DESC
    `;
    
    db.all(sql, [clientId], (err, rows) => {
        if (err) {
            console.error("Erro ao buscar encomendas do cliente:", err);
            return res.json([]); 
        }
        res.json(rows || []);
    });
});
// ==========================================================
// ROTA: ATUALIZAÇÃO EM MASSA (COM RASTREADOR DE ERRO)
// ==========================================================
app.put('/api/orders/bulk-status', express.json(), (req, res) => {
    console.log("🚨 [SISTEMA] O servidor RECEBEU o pedido de alteração em massa!");
    console.log("🚨 [SISTEMA] Dados recebidos do painel:", req.body);

    // Verifica segurança
    if (!req.session.userId || req.session.role === 'client') {
        console.log("❌ [SISTEMA] Pedido barrado: Usuário sem permissão ou não logado.");
        return res.status(403).json({ success: false, message: "Acesso Negado." });
    }

    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        console.log("❌ [SISTEMA] Pedido barrado: Nenhum ID de encomenda chegou no servidor.");
        return res.status(400).json({ success: false, message: "Nenhum ID fornecido." });
    }
    if (!status) {
        console.log("❌ [SISTEMA] Pedido barrado: Nenhum Status chegou no servidor.");
        return res.status(400).json({ success: false, message: "Status não fornecido." });
    }

    // 1. Atualiza no banco de dados
    const placeholders = ids.map(() => '?').join(',');
    const sqlUpdate = `UPDATE orders SET status = ? WHERE id IN (${placeholders})`;
    
    db.run(sqlUpdate, [status, ...ids], function(err) {
        if (err) {
            console.error("❌ [SISTEMA] Erro no Banco de Dados:", err);
            return res.status(500).json({ success: false, message: "Erro interno no banco de dados." });
        }
        
        const updatedCount = this.changes;
        console.log(`✅ [AÇÃO EM MASSA] Status de ${updatedCount} encomendas alterado para '${status}' no banco.`);

        // 2. Responde rápido para a tela não travar
        res.json({ success: true, updated: updatedCount });

        // 3. MOTO DO WHATSAPP & PAINEL DO CLIENTE
        const sqlSelect = `
            SELECT o.code, o.description, u.id as client_id, u.name, u.phone 
            FROM orders o
            JOIN users u ON o.client_id = u.id
            WHERE o.id IN (${placeholders})
        `;

        db.all(sqlSelect, ids, async (err, rows) => {
            if (err) return console.error("❌ Erro ao buscar contatos:", err);
            
            if (rows && rows.length > 0) {
                console.log(`📡 Iniciando disparos de Zap para ${rows.length} clientes...`);

                for (const row of rows) {
                    const desc = row.description ? row.description : 'Sua encomenda';
                    
                    // Aviso no painel (Silencioso)
                    const tituloAviso = "Atualização de Encomenda";
                    const msgAviso = `Sua encomenda ${row.code} mudou para: ${status}`;
                    db.run("INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, ?, ?, 0)", 
                          [row.client_id, tituloAviso, msgAviso], function(err) {});
          // 🔔 COLE A NOTIFICAÇÃO DE TELA (VIBRA O CELULAR) AQUI:
            enviarNotificacaoNaTela(row.client_id, tituloAviso, msgAviso, "/dashboard-client.html");
                    // Disparo Zap
                    if (row.phone && typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                        try {
                            let cleanPhone = row.phone.replace(/\D/g, '');
                            if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = '55' + cleanPhone;
                            
                            const zapMsg = `Olá, *${row.name}*! 👋\n\nUma atualização importante na Guineexpress para o seu envio (*${desc}* / Código: *${row.code}*).\n\n📦 *Novo Status:* ${status}\n\nAcesse o seu painel agora para acompanhar:\n\n🔗 https://guineexpress-f6ab.onrender.com/`;

                            const numberId = await clientZap.getNumberId(cleanPhone);
                            if (numberId) {
                                await clientZap.sendMessage(numberId._serialized, zapMsg);
                                console.log(`✅ [ZAP EM MASSA] Enviado para ${row.name} (${cleanPhone})`);
                            } else {
                                console.log(`⚠️ [ZAP EM MASSA] Número ${cleanPhone} inválido. Forçando...`);
                                await clientZap.sendMessage(`${cleanPhone}@c.us`, zapMsg);
                            }
                            await new Promise(resolve => setTimeout(resolve, 2000)); // Trava 2 seg
                        } catch (zapErr) {
                            console.error(`❌ Erro Zap p/ ${row.name}:`, zapErr.message);
                        }
                    } else {
                        console.log(`⚠️ [ZAP EM MASSA] ${row.name} ignorado: Sem telefone ou Robô off.`);
                    }
                }
                console.log(`✅ Disparo em massa 100% finalizado!`);
            }
        });
    });
});
app.delete('/api/orders/:id', (req, res) => {
    if (!req.session.userId || req.session.role === 'client') {
        return res.status(403).json({ success: false, message: 'Sem permissão' });
    }

    const id = req.params.id;
    db.get("SELECT code FROM orders WHERE id = ?", [id], (err, row) => {
        const orderCode = row ? row.code : 'Desconhecido';

        // MÁGICA: Em vez de atualizar, nós APAGAMOS o registro de verdade!
        // Isso libera o código no banco de dados automaticamente.
        db.run("DELETE FROM orders WHERE id = ?", [id], function(err) {
            if (err) return res.json({ success: false, message: "Erro ao excluir." });

            const reason = `🗑️ Apagou Definitivamente a Encomenda: ${orderCode} (ID: ${id})`;
            if (typeof logSystemAction === 'function') logSystemAction(req, 'Exclusão de Encomenda', reason);

            res.json({ success: true });
        });
    });
});

// ==========================================
// ROTA: DELETAR BOX (MANDA PARA A LIXEIRA)
// ==========================================
app.post('/api/boxes/delete', (req, res) => {
    const boxId = req.body.id;

    if (!boxId) {
        return res.json({ success: false, msg: "ID da caixa não fornecido." });
    }

    // Faz o "Soft Delete" (esconde a caixa marcando deleted = 1)
    db.run("UPDATE boxes SET deleted = 1 WHERE id = ?", [boxId], function(err) {
        if (err) {
            console.error("Erro ao deletar box:", err);
            return res.json({ success: false, msg: "Erro ao deletar a caixa." });
        }
        res.json({ success: true, msg: "Caixa deletada com sucesso!" });
    });
});
// Certifique-se que a rota está assim:
app.get('/api/users-all', (req, res) => {
    // Permite ADMIN e EMPLOYEE. Só bloqueia se não estiver logado ou se for CLIENTE.
    if(!req.session.role || req.session.role === 'client') {
        return res.status(403).json([]);
    }
    
    db.all("SELECT id, name, email, role FROM users", (err, rows) => {
        res.json(rows || []);
    });
});
// --- ROTA: Listar Funcionários (Para o Admin) ---
app.get('/api/admin/employees', (req, res) => {
    // Verifica se é admin
    if (!req.session.role || req.session.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Sem permissão' });
    }

    // Busca apenas usuários com cargo 'employee'
    db.all("SELECT id, name, email, active, phone FROM users WHERE role = 'employee'", (err, rows) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, employees: [] });
        }
        res.json({ success: true, employees: rows });
    });
});

// --- ROTA: Ativar/Desativar Funcionário ---
app.post('/api/admin/toggle-employee', (req, res) => {
    if (!req.session.role || req.session.role !== 'admin') return res.status(403).json({});

    const { id, active } = req.body;
    db.run("UPDATE users SET active = ? WHERE id = ?", [active, id], (err) => {
        res.json({ success: !err });
    });
});
// --- ROTA: Pegar dados do Usuário Logado (Para o Painel) ---
app.get('/api/user/me', (req, res) => {
    if (req.session.user) {
        res.json({ 
            success: true, 
            name: req.session.user.name,
            profile_pic: req.session.user.profile_pic 
        });
    } else {
        res.json({ success: false });
    }
});
// Função auxiliar para o servidor Node.js "esperar" o banco de dados responder
const queryDB = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};
app.post('/api/cici/chat', async (req, res) => {
    try {
        const { text, userContext, image, isFirstMessage, lang, history } = req.body;
        const userId = req.session.userId; 
        const userRole = req.session.role; 

        let dadosExtras = "";
        if (userId) {
            const orders = await new Promise((resolve) => {
                db.all("SELECT code, status FROM orders WHERE client_id = ? AND (deleted = 0 OR deleted IS NULL) ORDER BY id DESC LIMIT 3", [userId], (err, rows) => {
                    resolve(rows || []);
                });
            });
            if (orders.length > 0) {
                dadosExtras = "\nENCOMENDAS ATUAIS DO USUÁRIO:\n" + orders.map(o => `- ${o.code}: ${o.status}`).join('\n');
            }
        }

        let ferramentasCici = [];
        
        if (userRole !== 'client') {
            ferramentasCici = [{
                functionDeclarations: [
                    {
                        name: "buscarCliente",
                        description: "Busca clientes pelo nome. Retorna dados do cliente e da última encomenda dele.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                nomeBusca: { type: "STRING", description: "Nome ou parte do nome do cliente" }
                            },
                            required: ["nomeBusca"]
                        }
                    },
                    {
                        name: "criarEncomenda",
                        description: "Cria uma nova encomenda no sistema.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                client_id: { type: "INTEGER" },
                                code: { type: "STRING" },
                                description: { type: "STRING" },
                                weight: { type: "NUMBER" },
                                status: { type: "STRING" },
                                lote: { type: "STRING" }
                            },
                            required: ["client_id", "code", "weight", "status"]
                        }
                    },
                    {
                        name: "criarBox",
                        description: "Cria um box/caixa para uma encomenda.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                client_id: { type: "INTEGER" },
                                order_id: { type: "INTEGER" },
                                box_code: { type: "STRING", description: "O número do box (ex: Box 1, Box 2)" },
                                products: { type: "STRING" },
                                amount: { type: "NUMBER" },
                                lote: { type: "STRING" }
                            },
                            required: ["client_id", "order_id", "box_code"]
                        }
                    },
                    // 👇 1. AQUI ENTROU A NOVA FERRAMENTA DE FATURAS!
                    {
                        name: "criarFatura",
                        description: "Cria faturas financeiras separadas para boxes específicos de um cliente.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                client_id: { type: "INTEGER" },
                                boxes: { 
                                    type: "ARRAY", 
                                    description: "Lista com os códigos dos boxes solicitados (Ex: ['BOX 1', 'BOX 2'])",
                                    items: { type: "STRING" }
                                },
                                nf_amount: { 
                                    type: "NUMBER", 
                                    description: "Valor da Nota Fiscal dos produtos, se o usuário informar." 
                                }
                            },
                            required: ["client_id", "boxes"]
                        }
                    }
                ]
            }];
        }

        // 🧠 O CÉREBRO DA CICÍ REFORMULADO - VERSÃO SUPER INTELIGENTE
        const systemPrompt = `Você é a Cicí 18.0, a IA suprema e Agente Autônoma da Guineexpress. 
        Usuário atual: ${userContext.name || 'Desconhecido'} (Nível: ${userRole}). Tela: ${userContext.currentPage}.
        ${dadosExtras}
        Idioma: ${lang || 'pt-BR'}

        🛑 MODO ANTI-FALHAS (À PROVA DE ERROS E IMPREVISTOS):
        - NUNCA ADIVINHE DADOS: Se o usuário pedir para criar um box, encomenda ou fatura e NÃO informar detalhes obrigatórios (como Peso, Valor, Produtos ou Número do Box), PARE E PERGUNTE. Exemplo: "Claro! Mas qual é o peso da encomenda?" ou "Qual o número desse box?".
        - BUSCA INTELIGENTE: Se você usar a ferramenta 'buscarCliente' e não retornar nada, não invente dados. Diga: "Puxa, não encontrei ninguém com esse nome. Pode conferir como está escrito?"
        - CONFIANÇA CEGA NO BANCO: Você não tem memória própria de clientes. Toda vez que citarem um nome, use 'buscarCliente' ANTES de qualquer outra coisa.

        REGRAS DE BANCO DE DADOS (FERRAMENTAS):
        1. CRIAR ENCOMENDA: Use 'buscarCliente' para achar o ID. Se tiver todos os dados (peso, status, etc), chame 'criarEncomenda'. Se faltar algo, pergunte.
        2. CRIAR BOX: Use 'buscarCliente'. Confirme com o usuário o número do box e os produtos. Só depois chame 'criarBox'.
        3. CRIAR FATURAS: Use 'buscarCliente' para pegar o ID. Se o usuário pedir boxes específicos, chame 'criarFatura' mandando a lista exata (Ex: ['BOX 1', 'BOX 2']).
        ⚠️ IMPORTANTE: Se o banco de dados retornar um "erro" na ferramenta, AVISE o usuário qual foi o problema imediatamente. Nunca diga que deu certo se a ferramenta retornar erro.

        ⚡ PODERES DE CONTROLE DE TELA E IMPRESSÃO (OBRIGATÓRIO):
        As palavras sozinhas não funcionam no sistema visual. Você DEVE escrever as TAGS ocultas no final da sua frase para a mágica acontecer.
        - Abrir Aba Etiquetas: [ACTION:nav:labels-view]
        - Abrir Aba Faturas: [ACTION:nav:billing-view]
        - Imprimir: [ACTION:print:CODIGO:QUANTIDADE]
        
        ⚠️ COMO IMPRIMIR ETIQUETAS PERFEITAMENTE (SIGA A ORDEM RIGOROSAMENTE):
        1º PASSO: Use 'buscarCliente' para encontrar o "code" da encomenda (Ex: GX-5555).
        2º PASSO: Se o usuário NÃO disser a quantidade, pergunte a quantidade primeiro. NUNCA imprima sem saber a quantidade.
        3º PASSO: Com CÓDIGO e QUANTIDADE em mãos, sua resposta final DEVE ter a confirmação e as tags juntas.
        Exemplo Exato: "Com certeza! Imprimindo 1 etiqueta para o Mamadu agora mesmo. [ACTION:nav:labels-view] [ACTION:print:GX-5555:1]"

        IMPORTANTE: Nunca explique essas tags de ACTION para o usuário. Apenas aja.`;

        let messageParts = [{ text: text || "Olá!" }];
        if (image) {
            messageParts.push({ 
                inlineData: { 
                    data: image.split(',')[1], 
                    mimeType: image.split(';')[0].split(':')[1] 
                } 
            });
        }

        let historicoCompleto = [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Entendido. Serei estrita com as tags de ACTION." }] }
        ];

        if (history && Array.isArray(history)) {
            historicoCompleto = historicoCompleto.concat(history);
        }

        const chatParams = { history: historicoCompleto };
        if (ferramentasCici.length > 0) chatParams.tools = ferramentasCici;

        const chat = model.startChat(chatParams);
        // 🚀 Início da conversa
        let result = await chat.sendMessage(messageParts);
        let response = result.response;

        // 🔄 LOOP MÁGICO: Enquanto a Cicí quiser chamar ferramentas, a gente executa
        while (response.functionCalls() && response.functionCalls().length > 0) {
            const functionCalls = response.functionCalls();
            const functionResponses = [];

            for (const call of functionCalls) {
                let functionResult = {};
                console.log(`🤖 [CICÍ] Acionou a ferramenta: ${call.name}`, call.args);

                if (call.name === "buscarCliente") {
                    const clientesInfo = await new Promise((resolve) => {
                        const sql = `
                            SELECT u.id as client_id, u.name, o.id as order_id, o.code, o.description as products, o.price as amount, o.lote 
                            FROM users u 
                            LEFT JOIN orders o ON u.id = o.client_id AND (o.deleted = 0 OR o.deleted IS NULL)
                            WHERE u.role = 'client' AND u.name LIKE ? 
                            ORDER BY o.id DESC LIMIT 1
                        `;
                        db.all(sql, [`%${call.args.nomeBusca}%`], (err, rows) => {
                            resolve(rows || []);
                        });
                    });
                    functionResult = { resultado: clientesInfo.length > 0 ? clientesInfo : "Nenhum cliente encontrado." };
                } 
                
                else if (call.name === "criarEncomenda") {
                    const args = call.args;
                    functionResult = await new Promise((resolve) => {
                        db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err, row) => {
                            const pricePerKg = row ? parseFloat(row.value) : 0;
                            const totalPrice = (parseFloat(args.weight) * pricePerKg).toFixed(2);
                            const sql = `INSERT INTO orders (client_id, code, description, weight, status, price, lote) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                            db.run(sql, [args.client_id, args.code, args.description, args.weight, args.status, totalPrice, args.lote || 'Sem Lote'], function(err) {
                                if (err) resolve({ erro: err.message });
                                else resolve({ sucesso: true, mensagem: `Encomenda criada!` });
                            });
                        });
                    });
                }

                else if (call.name === "criarBox") {
                    const args = call.args;
                    functionResult = await new Promise((resolve) => {
                        db.run(
                            "INSERT INTO boxes (client_id, order_id, box_code, products, amount, lote) VALUES (?,?,?,?,?,?)",
                            [args.client_id, args.order_id, args.box_code.toUpperCase(), args.products || 'Diversos', args.amount || 0, args.lote || 'Sem Lote'],
                            function(err) {
                                if (err) resolve({ erro: err.message });
                                else resolve({ sucesso: true, mensagem: `Box criado!` });
                            }
                        );
                    });
                }

                else if (call.name === "criarFatura") {
                    const args = call.args;
                    functionResult = await new Promise((resolve) => {
                        db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (errPrice, rowPrice) => {
                            const pricePerKg = rowPrice && rowPrice.value ? parseFloat(rowPrice.value) : 0;
                            const placeholders = args.boxes.map(() => '?').join(',');

                            const queryBoxes = `
                                SELECT b.id as box_id, b.box_code, b.amount as box_amount, 
                                       u.id as client_id, u.name, u.email, u.phone,
                                       o.weight as order_weight, o.price as order_price
                                FROM boxes b
                                LEFT JOIN orders o ON b.order_id = o.id
                                LEFT JOIN users u ON b.client_id = u.id
                                WHERE b.client_id = ? AND UPPER(TRIM(b.box_code)) IN (${placeholders})
                            `;
                            
                            const boxParams = args.boxes.map(b => b.trim().toUpperCase());

                            db.all(queryBoxes, [args.client_id, ...boxParams], async (err, rows) => {
                                if (err) {
                                    return resolve({ erro: `Erro interno no banco de dados: ${err.message}` });
                                }
                                
                                const boxesEncontrados = [];
                                for (const reqBox of boxParams) {
                                    const matches = rows.filter(r => r.box_code.trim().toUpperCase() === reqBox);
                                    if (matches.length > 0) {
                                        matches.sort((a, b) => {
                                            const weightA = parseFloat(a.order_weight) || 0;
                                            const weightB = parseFloat(b.order_weight) || 0;
                                            if (weightA !== weightB) return weightB - weightA;
                                            
                                            const amtA = parseFloat(a.box_amount) || parseFloat(a.order_price) || 0;
                                            const amtB = parseFloat(b.box_amount) || parseFloat(b.order_price) || 0;
                                            return amtB - amtA;
                                        });
                                        boxesEncontrados.push(matches[0]);
                                    }
                                }

                                if (boxesEncontrados.length === 0) {
                                    return resolve({ erro: "Boxes não encontrados para este cliente." });
                                }

                                for (const box of boxesEncontrados) {
                                    // 3. MATEMÁTICA E NOTA FISCAL
                                    const individualWeight = parseFloat(box.order_weight) || 0;
                                    const freightValue = individualWeight * pricePerKg;
                                    
                                    // Pega o valor da NF se a Cicí mandar, senão é 0
                                    const nfValue = args.nf_amount ? parseFloat(args.nf_amount) : 0; 
                                    
                                    let baseTotal = freightValue;
                                    if (baseTotal === 0) {
                                         baseTotal = parseFloat(box.box_amount) || parseFloat(box.order_price) || 0;
                                    }

                                    // 🔥 TRUQUE DE 1 CENTAVO ANTI-PIX CLONADO 🔥
                                    let finalTotal = baseTotal;
                                    let isUnique = false;
                                    let maxAttempts = 0;

                                    while (!isUnique && maxAttempts < 50) {
                                        // Verifica no banco se já existe esse exato valor PENDENTE
                                        const existe = await new Promise((resCheck) => {
                                            db.get("SELECT id FROM invoices WHERE status = 'pending' AND amount = ?", [finalTotal], (errC, rowC) => {
                                                resCheck(rowC);
                                            });
                                        });

                                        if (existe) {
                                            // Se existir, soma 1 centavo e arredonda para evitar dízimas infinitas do Javascript
                                            finalTotal = Math.round((finalTotal + 0.01) * 100) / 100;
                                            maxAttempts++;
                                        } else {
                                            isUnique = true; // Achou um valor único! Pode sair do loop.
                                        }
                                    }

                                    const description = `Fatura ${box.box_code}`;

                                    // 4. SALVA A FATURA NO BANCO
                                    await new Promise((resInsert) => {
                                        db.run(
                                            `INSERT INTO invoices (client_id, box_id, amount, description, status, nf_amount, freight_amount) 
                                             VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
                                            [box.client_id, box.box_id, finalTotal, description, nfValue, freightValue],
                                            function(errI) { resInsert(); }
                                        );
                                    });

                                    // 5. 🔔 NOTIFICAÇÃO NA TELA
                                    if (typeof enviarNotificacaoNaTela === 'function') {
                                        try { enviarNotificacaoNaTela(box.client_id, "Nova Fatura Gerada 🧾", "Sua fatura já está no painel.", "/dashboard-client.html"); } catch (e) {}
                                    }

                                    // 6. 📧 ENVIA EMAIL
                                    if (box.email && typeof sendEmailHtml === 'function') {
                                        const subject = `Nova Fatura Pendente: R$ ${finalTotal.toFixed(2)}`;
                                        const msgEmail = `Olá, <strong>${box.name}</strong>.<br><br>Fatura gerada para: <strong>${description}</strong>.<br>Valor a pagar: <strong>R$ ${finalTotal.toFixed(2)}</strong><br><br>Acesse seu painel para pagar.`;
                                        sendEmailHtml(box.email, subject, "Pagamento Pendente", msgEmail);
                                    }

                                    // 7. 🟢 ENVIA WHATSAPP
                                    const roboZap = (typeof clientZap !== 'undefined' ? clientZap : (typeof client !== 'undefined' ? client : null));
                                    
                                    if (box.phone && roboZap && roboZap.info) {
                                        try {
                                            let cleanPhone = box.phone.replace(/\D/g, '');
                                            const zapMsg = `Olá, *${box.name}*! 👋\n\nUma nova fatura foi gerada na Guineexpress (*${description}*).\n\n💰 *Valor Total:* R$ ${finalTotal.toFixed(2)}\n\nAcesse o seu painel agora para efetuar o pagamento:\n🔗 https://guineexpress-f6ab.onrender.com/`;
                                            
                                            const numberId = await roboZap.getNumberId(cleanPhone);
                                            if (numberId) {
                                                await roboZap.sendMessage(numberId._serialized, zapMsg);
                                            } else {
                                                await roboZap.sendMessage(`${cleanPhone}@c.us`, zapMsg);
                                            }
                                        } catch (zErr) {
                                            console.error("❌ Erro ZAP:", zErr.message);
                                        }
                                    } else {
                                        console.log("⚠️ [ZAP/CICÍ] Cliente não notificado: Sem telefone ou Robô off.");
                                    }
                                }
                                resolve({ sucesso: true, msg: "Fatura gerada com sucesso! A matemática de 1 centavo e NF foram aplicadas." });
                            });
                        });
                    });
                }

                functionResponses.push({
                    functionResponse: { name: call.name, response: functionResult }
                });
            }

            // Envia os resultados das funções de volta para a Cicí e vê o que ela diz agora
            result = await chat.sendMessage(functionResponses);
            response = result.response;
        }

        // 🗣️ Agora sim, pegamos o texto final (depois de todas as ferramentas rodarem)
        const replyText = response.text();
        console.log("🗣️ TEXTO FINAL DA CICÍ:", replyText);
        res.json({ reply: replyText, lang: lang || 'pt-BR' });

    } catch (error) {
        console.error("❌ Erro Cicí:", error.message);
        if (error.status === 429 || error.message.includes('429')) {
            return res.status(429).json({ reply: "Estou superaquecida com muitos pedidos ao mesmo tempo! 😅 Espere 1 minutinho e me fale de novo.", isQuotaError: true });
        }
        res.status(500).json({ reply: "Tive um soluço técnico aqui no meu servidor." });
    }
});
async function notifyUser(userId, title, message) {
    db.get("SELECT push_subscription FROM users WHERE id = ?", [userId], (err, row) => {
        if (row && row.push_subscription) {
            const subscription = JSON.parse(row.push_subscription);
            const payload = JSON.stringify({
                title: title,
                body: message,
                icon: '/logo.png',
                badge: '/logo.png'
            });

            console.log(`🚀 Tentando enviar push para o usuário ${userId}...`);

            webpush.sendNotification(subscription, payload)
                .then(result => {
                    console.log("✅ Resposta do Servidor Push (Google/Apple):", result.statusCode);
                })
                .catch(error => {
                    console.error("❌ Erro Real no envio:", error.statusCode, error.body);
                });
        } else {
            console.log(`⚠️ Usuário ${userId} não tem um celular registrado no banco.`);
        }
    });
}

app.post('/api/notifications/subscribe', (req, res) => {
    const subscription = req.body;
    const userId = req.session.userId;
    
    // Se o usuário não estiver logado no momento da inscrição, 
    // nós retornamos 200 (sucesso "silencioso"), mas não salvamos ainda.
    // O pulo do gato está em salvar assim que ele fizer o login.
    if (!userId) {
        return res.status(200).json({ success: true, msg: "Inscrição recebida, aguardando login para vincular." });
    }

    const subString = JSON.stringify(subscription);

    // Salva ou Atualiza a permissão na conta do cliente
    db.run("UPDATE users SET push_subscription = ? WHERE id = ?", [subString, userId], (err) => {
        if (err) {
            console.error("❌ Erro ao vincular Push ao User ID:", userId, err);
            return res.status(500).json({ success: false });
        }
        console.log(`🔔 Notificação vinculada permanentemente ao User ID: ${userId}`);
        res.status(201).json({ success: true });
    });
});
// Exemplo dentro da rota de atualização de pacotes:
app.post('/api/update-package', (req, res) => {
    const { code, newStatus, clientId } = req.body;
    
    db.run("UPDATE orders SET status = ? WHERE code = ?", [newStatus, code], function(err) {
        if (!err) {
            // DISPARA A NOTIFICAÇÃO ESTILO SHEIN!
            notifyUser(clientId, "📦 Guineexpress: Status Atualizado", `Sua encomenda ${code} agora está: ${newStatus}`);
        }
        res.json({ success: true });
    });
});

app.get('/disparar-meu-push', (req, res) => {
    const userId = req.session.userId; // Pega o ID de quem está logado navegando
    if (!userId) return res.send("Erro: Você precisa estar logado no navegador para testar!");

    // Chama a função que criamos antes
    notifyUser(userId, "Guineexpress", "Sua encomenda chegou! 📦🚀");
    
    res.send("<h1>Comando enviado!</h1><p>Verifique a tela do seu celular agora.</p>");
});
// ==================================================================
// ROTA DA ROLETA: SALVAR PONTOS GANHOS
// ==================================================================
app.post('/api/save-points', (req, res) => {
    // Verifica se o utilizador está logado na sessão
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: "Não autorizado" });
    }

    const userId = req.session.userId;
    const pontosGanhos = 1; // Por enquanto a roleta dá sempre 1 ponto

    const query = "UPDATE users SET express_points = express_points + ? WHERE id = ?";
    
    db.run(query, [pontosGanhos, userId], function(err) {
        if (err) {
            console.error("❌ Erro ao salvar pontos:", err.message);
            return res.status(500).json({ success: false });
        }
        console.log(`🎁 Pontos adicionados ao utilizador ${userId}`);
        res.json({ success: true, newTotal: "Atualizado" });
    });
});
// ==================================================================
// ROTA DO JOGO: SALVAR PONTOS POR RECORDE (50 PONTOS)
// ==================================================================
app.post('/api/save-game-points', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });

    const userId = req.session.userId;
    const pontosPremio = 5; // Prémio por ser um craque no jogo!

    const query = "UPDATE users SET express_points = express_points + ? WHERE id = ?";
    
    db.run(query, [pontosPremio, userId], function(err) {
        if (err) return res.status(500).json({ success: false });
        console.log(`🎮 Recorde batido! 5 pontos para o utilizador ${userId}`);
        res.json({ success: true });
    });
});

// Rota para marcar a encomenda como impressa no banco de dados
app.post('/api/orders/mark-printed', (req, res) => {
    const { orderId } = req.body;

    if (!orderId) {
        return res.status(400).json({ error: "ID da encomenda não fornecido." });
    }

    const query = "UPDATE orders SET is_printed = 1 WHERE id = ?";

    db.run(query, [orderId], function(err) {
        if (err) {
            console.error("❌ Erro ao atualizar status de impressão:", err.message);
            return res.status(500).json({ error: "Erro interno ao atualizar banco." });
        }
        
        res.json({ 
            success: true, 
            message: `Encomenda ${orderId} marcada como impressa.` 
        });
    });
});
// ==========================================
// ROTA PARA LISTAR AS FATURAS COM OS VOLUMES
// ==========================================
app.get('/api/invoices', (req, res) => {
    const sql = `
        SELECT 
            invoices.*,
            users.name as client_name,
            boxes.box_code,
            CASE 
                WHEN boxes.volumes > 1 THEN boxes.volumes 
                WHEN orders.volumes > 1 THEN orders.volumes 
                ELSE 1 
            END as volumes
        FROM invoices
        LEFT JOIN users ON invoices.client_id = users.id
        LEFT JOIN boxes ON invoices.box_id = boxes.id
        LEFT JOIN orders ON boxes.order_id = orders.id
        ORDER BY invoices.id DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Erro ao buscar faturas:", err.message);
            return res.status(500).json({ error: "Erro no banco de dados." });
        }
        res.json(rows);
    });
});
// --- CONFIRMAR ENTREGA E SALVAR FOTO NO BANCO + ENVIO ZAP AUTOMÁTICO ---
app.post('/api/orders/:code/deliver', (req, res) => {
    const orderCode = req.params.code;
    const proofImage = req.body.proofImage || null; // Pega a foto que veio do celular
    
    // 1. Atualiza o status e salva a imagem
    const sqlUpdate = `UPDATE orders SET status = 'Entregue', proof_image = ? WHERE code = ?`;
    
    db.run(sqlUpdate, [proofImage, orderCode], function(err) {
        if (err) return res.status(500).json({ error: "Erro no banco ao salvar entrega" });
        if (this.changes === 0) return res.status(404).json({ error: "Código não encontrado" });
        
        console.log(`\n📦 [ENTREGA] Encomenda ${orderCode} marcada como Entregue no banco.`);

        // 2. CORREÇÃO: Busca o nome e telefone do dono usando APENAS a tabela users (u.name, u.phone)
        const sqlUser = `
            SELECT u.name as user_name, u.phone as user_phone 
            FROM orders o 
            JOIN users u ON o.client_id = u.id 
            WHERE o.code = ?
        `;
        
        db.get(sqlUser, [orderCode], async (errUser, row) => {
            if (errUser) {
                console.error("❌ [ZAP] Erro ao buscar dados do cliente:", errUser.message);
                return res.json({ success: true, message: "Entrega registrada, mas erro ao buscar cliente para o Zap." });
            }

            if (!row) {
                console.log(`⚠️ [ZAP] Cliente não encontrado no banco para a encomenda ${orderCode}.`);
                return res.json({ success: true, message: "Entrega salva! (Sem Zap: cliente não encontrado)" });
            }

            // Pega os dados direto do usuário encontrado
            const finalName = row.user_name || 'Cliente';
            const finalPhone = row.user_phone;

            if (!finalPhone) {
                console.log(`⚠️ [ZAP] Cliente ${finalName} da encomenda ${orderCode} não tem telefone cadastrado. Foto não enviada.`);
                return res.json({ success: true, message: "Entrega salva! (Sem Zap: cliente sem telefone)" });
            }

            // 3. Inicia o envio do Zap se o bot estiver conectado
            if (typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                try {
                    let cleanPhone = finalPhone.replace(/\D/g, ''); // Limpa traços e espaços
                    const numberId = await clientZap.getNumberId(cleanPhone); 
                    
                    if (numberId) {
                        const { MessageMedia } = require('whatsapp-web.js');
                        
                        if (proofImage) {
                            // O Base64 vem com "data:image/jpeg;base64,...", separando para o Zap ler
                            const base64Data = proofImage.split(',')[1]; 
                            const media = new MessageMedia('image/jpeg', base64Data, 'comprovante.jpg');
                            
                            const msg = `Olá *${finalName}*! 🎉\n\nSua encomenda *${orderCode}* acaba de ser entregue com sucesso pela Guineexpress!\n\nSegue a foto do comprovante de entrega:`;
                            
                            await clientZap.sendMessage(numberId._serialized, media, { caption: msg });
                            console.log(`✅ [ZAP] Foto de Comprovante enviada com sucesso para ${cleanPhone}`);
                        } else {
                            const msgText = `Olá *${finalName}*! 🎉\n\nSua encomenda *${orderCode}* acaba de ser entregue com sucesso pela Guineexpress!`;
                            await clientZap.sendMessage(numberId._serialized, msgText);
                            console.log(`✅ [ZAP] Aviso de entrega enviado (sem foto) para ${cleanPhone}`);
                        }
                    } else {
                        console.log(`⚠️ [ZAP] O número ${cleanPhone} não possui WhatsApp ativo ou não foi reconhecido.`);
                    }
                } catch (zapErr) {
                    console.error("❌ [ZAP] Erro ao enviar comprovante no Zap:", zapErr.message);
                }
            } else {
                console.log("❌ [ZAP] WhatsApp desconectado. A foto foi salva no painel, mas o Zap não foi enviado.");
            }
            
            // Retorna o sucesso para o frontend (fecha a tela na hora pro entregador)
            res.json({ success: true, message: "Entrega registrada com sucesso!" });
        });
    });
});
// --- DESFAZER ENTREGA E APAGAR FOTO (NOVO) ---
app.post('/api/orders/:code/undo-delivery', (req, res) => {
    const orderCode = req.params.code;
    
    // Atualiza o status de volta para 'Pendente' e limpa (apaga) a foto de comprovante
    const sqlUpdate = `UPDATE orders SET status = 'Pendente', proof_image = NULL WHERE code = ?`;
    
    db.run(sqlUpdate, [orderCode], function(err) {
        if (err) return res.status(500).json({ success: false, message: "Erro no banco ao desfazer entrega" });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Código não encontrado" });
        
        console.log(`🔄 [ENTREGA] Entrega desfeita para a encomenda ${orderCode}. Status voltou para Pendente e foto foi apagada.`);
        
        // Como o Zap já foi enviado para o cliente, não mandamos outra mensagem de "erro", 
        // apenas deixamos o entregador corrigir a foto no sistema e enviar a nova entrega depois.
        res.json({ success: true, message: "Entrega desfeita com sucesso!" });
    });
});
// ==========================================
// ROTA: EXCLUIR CLIENTE (Apenas Admin)
// ==========================================
app.delete('/api/admin/clients/:id', (req, res) => {
    // 1. Verifica se quem está tentando excluir é realmente o Administrador
    if (!req.session.role || req.session.role !== 'admin') {
        return res.status(403).json({ success: false, msg: 'Acesso negado. Apenas administradores podem excluir clientes.' });
    }

    const clientId = req.params.id;

    // 2. Apaga o usuário do banco de dados (Garante que só apaga se for 'client')
    db.run("DELETE FROM users WHERE id = ? AND role = 'client'", [clientId], function(err) {
        if (err) {
            console.error("Erro ao excluir cliente:", err);
            return res.status(500).json({ success: false, msg: 'Erro interno ao excluir cliente do banco de dados.' });
        }
        
        // Verifica se realmente apagou alguém
        if (this.changes > 0) {
            logSystemAction(req, "EXCLUIR CLIENTE", `Cliente ID: ${clientId} foi excluído do sistema.`);
            res.json({ success: true, msg: 'Cliente excluído com sucesso!' });
        } else {
            res.status(404).json({ success: false, msg: 'Cliente não encontrado ou já excluído.' });
        }
    });
});
// ==============================================================
// 🌟 NOVA ROTA MESTRE: AÇÃO EM MASSA COM WHATSAPP (PADRÃO INDIVIDUAL)
// ==============================================================
app.post('/api/orders/bulk-update-status', (req, res) => {
    // 1. Segurança
    if (!req.session.userId || req.session.role === 'client') {
        return res.status(403).json({ success: false, message: "Acesso Negado." });
    }

    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: "Nenhum ID fornecido." });
    }

    // 2. Atualiza no Banco de Dados
    const placeholders = ids.map(() => '?').join(',');
    const sqlUpdate = `UPDATE orders SET status = ? WHERE id IN (${placeholders})`;
    
    db.run(sqlUpdate, [status, ...ids], function(err) {
        if (err) {
            console.error("❌ Erro BD Ação em Massa:", err);
            return res.status(500).json({ success: false, message: "Erro no banco de dados." });
        }
        
        const updatedCount = this.changes; // Conta quantas foram atualizadas
        console.log(`\n✅ [AÇÃO EM MASSA] Iniciando ${updatedCount} atualizações para o status: '${status}'`);

        // 3. Responde pro painel não travar e mostrar a mensagem de Sucesso (Fim do "undefined")
        res.json({ success: true, updated: updatedCount });

        // ==========================================================
        // 4. MOTOR DO WHATSAPP E PAINEL (Sincronizado)
        // ==========================================================
        const sqlSelect = `
            SELECT o.code, o.description, u.id as client_id, u.name, u.phone 
            FROM orders o
            JOIN users u ON o.client_id = u.id
            WHERE o.id IN (${placeholders})
        `;

        db.all(sqlSelect, ids, async (err, rows) => {
            if (err) return console.error("Erro ao buscar clientes do disparo em massa:", err);
            
            if (rows && rows.length > 0) {
                for (const row of rows) {
                    const desc = row.description ? row.description : 'Sua encomenda';
                    
                    // -- Painel de Notificação Interno --
                    const tituloAviso = "Atualização de Encomenda";
                    const msgAviso = `Sua encomenda ${row.code} mudou para: ${status}`;
                    db.run("INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, ?, ?, 0)", 
                          [row.client_id, tituloAviso, msgAviso], function(e) {});

                    // -- Motor WhatsApp --
                    if (row.phone && typeof clientZap !== 'undefined' && clientZap && clientZap.info) {
                        try {
                            let cleanPhone = row.phone.replace(/\D/g, '');
                            
                            // Padroniza DDI Brasileiro se estiver faltando
                            if (cleanPhone.length === 10 || cleanPhone.length === 11) {
                                cleanPhone = '55' + cleanPhone;
                            }
                            
                            const zapMsg = `Olá, *${row.name}*! 👋\n\nUma atualização importante na Guineexpress para o seu envio (*${desc}* / Código: *${row.code}*).\n\n📦 *Novo Status:* ${status}\n\nAcesse o seu painel agora para acompanhar todas as atualizações:\n\n🔗 https://guineexpress-f6ab.onrender.com/`;

                            const numberId = await clientZap.getNumberId(cleanPhone);
                            
                            if (numberId) {
                                await clientZap.sendMessage(numberId._serialized, zapMsg);
                                console.log(`  🟢 [ZAP ENVIADO] ${row.name} (${row.code})`);
                            } else {
                                await clientZap.sendMessage(`${cleanPhone}@c.us`, zapMsg);
                                console.log(`  🟡 [ZAP FORÇADO] ${row.name} (${row.code})`);
                            }

                            // Trava Antibolqueio: 2 Segundos entre cada mensagem!
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        } catch (zapErr) {
                            console.error(`  ❌ [ERRO ZAP] ${row.name}:`, zapErr.message);
                        }
                    } else {
                        console.log(`  ⚠️ [SEM ZAP] ${row.name} não possui número válido ou robô offline.`);
                    }
                }
                console.log(`✅ [AÇÃO EM MASSA] Todos os disparos concluídos!\n`);
            }
        });
    });
});
// ==========================================
// ROTA: ENTREGAR OS AVISOS DA CICÍ PARA O LELO
// ==========================================
app.get('/api/cici-avisos', (req, res) => {
    // Se o usuário não for admin, não mostra nada
    if (req.session.role !== 'admin') {
        return res.json({ avisos: [] });
    }

    if (!global.ciciAvisos || global.ciciAvisos.length === 0) {
        return res.json({ avisos: [] });
    }

    // Pega os avisos para mandar pro Lelo e esvazia a caixinha (para não repetir)
    const mensagens = [...global.ciciAvisos];
    global.ciciAvisos = []; 
    
    res.json({ avisos: mensagens });
});
// ==============================================================
// 🏦 ROTA PARA GERAR PIX (NUBANK OU MERCADO PAGO)
// ==============================================================
app.get('/api/gerar-pix/:banco/:id_fatura', (req, res) => {
    const { banco, id_fatura } = req.params;

    // Busca o valor da fatura no banco de dados
    db.get("SELECT amount FROM invoices WHERE id = ?", [id_fatura], (err, fatura) => {
        if (err || !fatura) {
            return res.status(404).json({ erro: 'Fatura não encontrada' });
        }

        let chavePix, nomeTitular;

        // Verifica qual banco o botão enviou
        if (banco === 'mp') {
            chavePix = "49356085000134"; // Mercado Pago
            nomeTitular = "LELO JOSE GOMES";
        } else {
            chavePix = "comercialguineexpress245@gmail.com"; // Nubank
            nomeTitular = "GUINE EXPRESS LTDA";
        }

        const valorFatura = fatura.amount; 
        const cidadeTitular = "FORTALEZA";

        // Fabrica o código mágico na hora!
        const codigoPronto = gerarPixCopiaECola(chavePix, nomeTitular, cidadeTitular, valorFatura, `FAT${id_fatura}`);

        // Devolve pro cliente
        res.json({ 
            sucesso: true, 
            pix_copia_cola: codigoPronto,
            valor: valorFatura,
            banco_escolhido: banco
        });
    });
});

app.post('/api/notifications/subscribe', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false, msg: 'Não logado' });
    
    const subscription = req.body;
    const subString = JSON.stringify(subscription);

    // Salva a permissão diretamente na conta do cliente
    db.run("UPDATE users SET push_subscription = ? WHERE id = ?", [subString, req.session.userId], (err) => {
        if (err) {
            console.error("Erro ao salvar inscrição de notificação:", err);
            return res.status(500).json({ success: false });
        }
        console.log(`📱 Celular do cliente ID ${req.session.userId} cadastrado para notificações!`);
        res.status(201).json({ success: true, msg: "Celular cadastrado com sucesso!" });
    });
});

// ==================================================================
// 🔔 2. FUNÇÃO MÁGICA PARA DISPARAR A NOTIFICAÇÃO NA TELA
// ==================================================================
async function enviarNotificacaoNaTela(userId, titulo, mensagem, linkDestino = '/dashboard-client.html') {
    db.get("SELECT push_subscription FROM users WHERE id = ?", [userId], async (err, user) => {
        // Se o cliente não ativou as notificações ou não achou o usuário, apenas ignora
        if (err || !user || !user.push_subscription) return; 

        try {
            const subscription = JSON.parse(user.push_subscription);
            
            // Monta como a notificação vai aparecer na tela do cliente
            const payload = JSON.stringify({
                title: titulo,
                body: mensagem,
                url: linkDestino,
                icon: '/logo.png', // Aparece a logo da Guineexpress na notificação
                badge: '/logo.png' // Ícone pequeno da barra de tarefas
            });

            // Dispara via Google/Apple direto pro celular!
            await webpush.sendNotification(subscription, payload);
            console.log(`🔔 Notificação de tela enviada com sucesso para o User ID: ${userId}`);
            
        } catch (error) {
            console.error(`❌ Erro ao enviar notificação para o User ID ${userId}:`, error.message);
            
            // Se o erro for 410, significa que o cliente desinstalou o app ou bloqueou. Limpamos do banco.
            if (error.statusCode === 410) {
                db.run("UPDATE users SET push_subscription = NULL WHERE id = ?", [userId]);
                console.log(`🗑️ Permissão de notificação removida (Cliente ID ${userId} bloqueou/revogou).`);
            }
        }
    });
}
// ==========================================
// ROTA TRATOR 2.0: CRIANDO A COLUNA DE LOTE
// ==========================================
app.get('/api/add-lote', (req, res) => {
    db.run("ALTER TABLE orders ADD COLUMN lote TEXT DEFAULT 'Sem Lote'", (err) => {
        if (err) return res.json({ status: "Erro", mensagem: err.message });
        res.json({ status: "Feito!", mensagem: "A coluna de Lote foi criada com sucesso nas encomendas." });
    });
});
// ==========================================
// ROTA TRATOR 3.0: CRIANDO A COLUNA DE LOTE NAS CAIXAS
// ==========================================
app.get('/api/add-lote-box', (req, res) => {
    db.run("ALTER TABLE boxes ADD COLUMN lote TEXT DEFAULT 'Sem Lote'", (err) => {
        if (err) return res.json({ status: "Erro", mensagem: err.message });
        res.json({ status: "Feito!", mensagem: "A coluna de Lote foi criada com sucesso nas CAIXAS (boxes)." });
    });
});
// ==========================================
// ROTA: APAGAR VÍDEO (BANCO E ARQUIVO FÍSICO)
// ==========================================
app.delete('/api/videos/:id', (req, res) => {
    const videoId = req.params.id;
    const fs = require('fs');
    const path = require('path');

    // 1. Primeiro, buscamos o nome do arquivo no banco
    db.get(`SELECT filename FROM videos WHERE id = ?`, [videoId], (err, row) => {
        if (err) {
            console.error("Erro ao buscar vídeo:", err);
            return res.status(500).json({ error: "Erro no banco de dados." });
        }
        
        if (!row) {
            return res.status(404).json({ error: "Vídeo não encontrado no banco." });
        }

        // 2. Apagamos o registro do banco de dados
        db.run(`DELETE FROM videos WHERE id = ?`, [videoId], function(err) {
            if (err) {
                console.error("Erro ao deletar vídeo do banco:", err);
                return res.status(500).json({ error: "Erro ao excluir do banco." });
            }

            // 3. Apagamos o arquivo de vídeo real da pasta
            const videoPath = path.join(__dirname, 'uploads/videos', row.filename);
            
            try {
                if (fs.existsSync(videoPath)) {
                    fs.unlinkSync(videoPath); // Deleta o arquivo
                }
            } catch (fsErr) {
                console.error("Erro ao apagar o arquivo de vídeo do HD:", fsErr);
                // Não paramos o processo aqui porque o banco já foi apagado
            }

            // 4. Avisamos o painel que deu tudo certo!
            res.json({ success: true, message: "Vídeo excluído com sucesso!" });
        });
    });
});
// =====================================================
// INICIALIZAÇÃO DO SERVIDOR (CORRIGIDO PARA O RENDER)
// =====================================================
const PORT = process.env.PORT || 3000;

// O segredo está no '0.0.0.0' adicionado aqui embaixo 👇
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor Guineexpress rodando na porta ${PORT}`);
    console.log(`📡 Modo: ${process.env.NODE_ENV || 'Desenvolvimento'}`);
});
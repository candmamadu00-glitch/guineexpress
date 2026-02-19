require('dotenv').config(); // Lê o arquivo .env
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const helmet = require('helmet'); // Instale: npm install helmet
const compression = require('compression'); // Instale: npm install compression
const MercadoPagoConfig = require('mercadopago').MercadoPagoConfig;
const Payment = require('mercadopago').Payment;
const Preference = require('mercadopago').Preference;
const cron = require('node-cron'); // Agendador de tarefas
const path = require('path');      // Para lidar com caminhos de pastas
const SQLiteStore = require('connect-sqlite3')(session);
const app = express();
const db = require('./database'); 
const webpush = require('web-push');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const whatsappClient = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/data/session-whatsapp' 
    }),
    puppeteer: {
        headless: true,
        // Caminho exato baseado no erro gerado pelo Render
        executablePath: '/opt/render/project/src/.puppeteer_cache/chrome/linux-145.0.7632.77/chrome-linux64/chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ],
    }
});

whatsappClient.on('qr', (qr) => {
    qrcode.generate(qr, { small: false });
    console.log('👉 SCANNEIE O QR CODE ACIMA PARA CONECTAR O WHATSAPP DA CICÍ');
});

whatsappClient.on('ready', () => {
    console.log('Cicí está conectada ao WhatsApp! ✅');
});

whatsappClient.initialize();

// 2. FUNÇÃO DE ENVIO CORRIGIDA
async function sendWhatsAppMessage(phone, message) {
    try {
        // 1. Limpa tudo que não é número
        let cleanPhone = phone.replace(/\D/g, ''); 

        // 2. Garante o DDI da Guiné-Bissau (245)
        // Se o número começar com 9 ou 7 e tiver 9 dígitos, adicionamos 245
        if (cleanPhone.length === 9 && (cleanPhone.startsWith('9') || cleanPhone.startsWith('7'))) {
            cleanPhone = '245' + cleanPhone;
        }

        // 3. Obtém o ID correto do número no WhatsApp (O tal do LID)
        // Isso resolve o erro "No LID for user"
        const numberDetails = await whatsappClient.getNumberId(cleanPhone);

        if (numberDetails) {
            // O getNumberId retorna o ID formatado corretamente (ex: 24596... @c.us)
            await whatsappClient.sendMessage(numberDetails._serialized, message);
            console.log(`✅ Zap enviado com sucesso para: ${cleanPhone}`);
            return true;
        } else {
            console.error(`⚠️ O número ${cleanPhone} não foi encontrado no WhatsApp. Verifique se o número está correto.`);
            return false;
        }
    } catch (err) {
        console.error("❌ Erro técnico ao enviar Zap:", err.message);
        return false;
    }
}
webpush.setVapidDetails(
    'mailto:candemamadu00@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);
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

// Função para gravar logs automaticamente
function logSystemAction(req, action, details) {
    const user = req.session.userName || 'Admin/Sistema';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    db.run("INSERT INTO system_logs (user_name, action, details, ip_address) VALUES (?, ?, ?, ?)", 
        [user, action, details, ip], 
        (err) => {
            if(err) console.error("Erro ao salvar log:", err);
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
    store: new SQLiteStore({ db: 'sessions.db', dir: '.' }), 
    secret: process.env.SESSION_SECRET || 'segredo_padrao',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 7, 
        secure: false 
    } 
}));

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

        // 2. Se não achou o usuário
        if (!user) {
            logAccess(req, login, 'Falha', 'Usuário não encontrado');
            return res.status(400).json({ success: false, msg: 'Usuário não encontrado.' });
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
    if (req.session.userId) {
        res.json({ 
            loggedIn: true, 
            user: { 
                id: req.session.userId,
                name: req.session.userName,
                role: req.session.role
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
// --- ROTA QUE ESTAVA FALTANDO ---
app.get('/api/clients', (req, res) => {
    // Busca todos os usuários que são 'client'
    db.all("SELECT * FROM users WHERE role = 'client'", (err, rows) => {
        if(err) {
            console.error(err);
            return res.json([]);
        }
        res.json(rows);
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
// --- ROTA DE CADASTRO (COM VALIDAÇÃO DE SEGURANÇA) ---
app.post('/api/register', (req, res) => {
    const {name, email, phone, country, document, password} = req.body;

    // 1. Validação de Campos Vazios
    if (!name || !email || !password || !phone || !document) {
        return res.json({success: false, msg: 'Preencha todos os campos obrigatórios.'});
    }

    // 2. Validação de Senha (Mínimo 6 caracteres)
    if (password.length < 6) {
        return res.json({success: false, msg: 'A senha deve ter no mínimo 6 caracteres.'});
    }

    // 3. Validação e Limpeza do Documento (CPF/CNPJ)
    // Remove tudo que não for número (pontos, traços)
    const cleanDoc = document.replace(/\D/g, '');
    
    // Verifica se tem 11 dígitos (CPF) ou 14 (CNPJ)
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
        return res.json({success: false, msg: 'Documento inválido. Digite um CPF (11) ou CNPJ (14) válido.'});
    }

    // 4. Validação de Telefone (Mínimo 10 dígitos com DDD)
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
        return res.json({success: false, msg: 'Telefone inválido. Inclua o DDD.'});
    }

    // 5. Validação de Email (Formato básico)
    if (!email.includes('@') || !email.includes('.')) {
        return res.json({success: false, msg: 'E-mail inválido.'});
    }

    // 6. Se passou por tudo, criptografa e salva
    const hash = bcrypt.hashSync(password, 10);
    
    // Salvamos 'cleanDoc' e 'cleanPhone' para manter o banco limpo (opcional, mas recomendado)
    db.run(`INSERT INTO users (role, name, email, phone, country, document, password) VALUES ('client', ?, ?, ?, ?, ?, ?)`, 
        [name, email, phone, country, document, hash], (err) => {
            if (err) {
                // Se der erro, geralmente é porque o email ou CPF já existe (UNIQUE no banco)
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
// --- SISTEMA DE AGENDAMENTO (CORRIGIDO) ---

// 1. Admin cria janela de disponibilidade
app.post('/api/schedule/create-availability', (req, res) => {
    const { date, start_time, end_time, max_slots } = req.body;
    db.run("INSERT INTO availability (date, start_time, end_time, max_slots) VALUES (?,?,?,?)",
        [date, start_time, end_time, max_slots], (err) => res.json({ success: !err }));
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
app.post('/api/admin/broadcast', (req, res) => {
    const isAdmin = (req.session.role === 'admin') || (req.session.user && req.session.user.role === 'admin');
    if (!isAdmin) return res.status(403).json({ success: false, msg: 'Sem permissão.' });

    const { subject, message, sendEmail, sendWA } = req.body;

    db.all("SELECT email, name, phone FROM users WHERE role = 'client'", [], async (err, clients) => {
        if (err) return res.json({ success: false, msg: 'Erro no banco.' });
        if (!clients || clients.length === 0) return res.json({ success: false, msg: 'Nenhum cliente encontrado.' });

        console.log(`Iniciando broadcast para ${clients.length} clientes...`);

        // Usamos um loop for...of para poder usar o 'await' e dar o delay
        for (const client of clients) {
            // 1. Envio por E-mail
            if (sendEmail && client.email) {
                sendEmailHtml(client.email, `📢 ${subject}`, subject, `Olá ${client.name},<br><br>${message}`);
            }

            // 2. Envio por WhatsApp
            if (sendWA && client.phone) {
                const textWA = `*📢 ${subject}*\n\nOlá ${client.name},\n${message}`;
                await sendWhatsAppMessage(client.phone, textWA);
                
                // ESPERA 3 SEGUNDOS entre cada envio para evitar ser banido pelo WhatsApp
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        res.json({ success: true, msg: `Processo de envio finalizado para ${clients.length} clientes!` });
    });
});
app.get('/favicon.ico', (req, res) => res.status(204)); // Responde "Sem conteúdo" e para de reclamar
// 3. Rota INTELIGENTE: Quebra os horários em 15 min (CORREÇÃO DO ERRO AQUI)
app.get('/api/schedule/slots-15min', (req, res) => {
    // Busca todas as janelas
    db.all("SELECT * FROM availability WHERE date >= date('now') ORDER BY date ASC, start_time ASC", [], (err, ranges) => {
        if(err) return res.json([]);

        // Busca todos os agendamentos
        db.all("SELECT availability_id, time_slot, status FROM appointments WHERE status != 'Cancelado'", [], (err2, bookings) => {
            
            // --- PROTEÇÃO CONTRA O ERRO ---
            // Se der erro no SQL ou bookings for undefined, define como array vazio para não travar
            if (err2 || !bookings) {
                console.log("Aviso: Tabela appointments vazia ou com erro de coluna.", err2);
                bookings = []; 
            }

            let finalSlots = [];

            ranges.forEach(range => {
                let current = new Date(`2000-01-01T${range.start_time}`);
                let end = new Date(`2000-01-01T${range.end_time}`);

                while (current < end) {
                    let timeStr = current.toTimeString().substring(0,5);
                    
                    // Agora é seguro usar .filter porque bookings é garantido ser um array
                    let taken = bookings.filter(b => b.availability_id === range.id && b.time_slot === timeStr).length;
                    
                    finalSlots.push({
                        availability_id: range.id,
                        date: range.date,
                        time: timeStr,
                        max_slots: range.max_slots,
                        taken: taken,
                        available: range.max_slots - taken
                    });

                    current.setMinutes(current.getMinutes() + 15);
                }
            });

            res.json(finalSlots);
        });
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

// --- OUTROS (Mantidos) ---
// Rota de Pedidos (Atualizada para trazer Telefone e Email)
app.get('/api/orders', (req, res) => {
    // AQUI ESTÁ A MUDANÇA: Adicionamos client_phone e client_email no SELECT
    let sql = `SELECT 
                orders.*, 
                users.name as client_name, 
                users.phone as client_phone, 
                users.email as client_email 
               FROM orders 
               JOIN users ON orders.client_id = users.id`;
    
    let params = [];
    
    // Se for cliente, filtra apenas os dele. Se for admin, vê tudo.
    if(req.session.role === 'client') { 
        sql += " WHERE client_id = ?"; 
        params.push(req.session.userId); 
    }
    
    // Ordenar pelo mais recente fica mais organizado
    sql += " ORDER BY orders.id DESC"; 

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({error: "Erro no banco de dados"});
        }
        res.json(rows);
    });
});

app.get('/api/orders/by-client/:id', (req, res) => db.all("SELECT * FROM orders WHERE client_id = ?", [req.params.id], (err, rows) => res.json(rows)));
// --- ROTA CORRIGIDA: CRIAR ENCOMENDA (COM CÁLCULO DE PREÇO) ---
app.post('/api/orders/create', (req, res) => {
    const { client_id, code, description, weight, status } = req.body;

    db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err, row) => {
        const pricePerKg = row ? parseFloat(row.value) : 0;
        const totalPrice = (parseFloat(weight) * pricePerKg).toFixed(2);

        console.log(`Criando encomenda: ${weight}kg * R$${pricePerKg} = R$${totalPrice}`);

        const sql = `INSERT INTO orders (client_id, code, description, weight, status, price) VALUES (?, ?, ?, ?, ?, ?)`;
                     
        db.run(sql, [client_id, code, description, weight, status, totalPrice], function(err) {
            if (err) {
                if(err.message.includes('UNIQUE')) return res.json({ success: false, msg: "Código já existe." });
                return res.json({ success: false, msg: err.message });
            }
            res.json({ success: true, id: this.lastID });
        });
    });
});
// --- ATUALIZAR STATUS E ENVIAR EMAIL AUTOMÁTICO (COM FOTO) ---
app.post('/api/orders/update', (req, res) => {
    const { id, status, location, delivery_proof } = req.body;

    db.get(`SELECT orders.code, orders.description, users.email, users.name 
            FROM orders JOIN users ON orders.client_id = users.id 
            WHERE orders.id = ?`, [id], (err, row) => {
        
        if (err || !row) {
            return res.json({ success: false, msg: "Encomenda não encontrada" });
        }

        let sql, params;

        if (delivery_proof) {
            sql = "UPDATE orders SET status = ?, delivery_proof = ?, delivery_location = ? WHERE id = ?";
            params = [status, delivery_proof, location || 'Local não informado', id];
        } else {
            sql = "UPDATE orders SET status = ? WHERE id = ?";
            params = [status, id];
        }

        db.run(sql, params, (errUpdate) => {
            if (errUpdate) {
                console.error(errUpdate);
                return res.json({ success: false, msg: "Erro ao atualizar banco" });
            }

            if (row.email) {
                const subject = `Atualização: Encomenda ${row.code} - ${status}`;
                let msg = `Olá, <strong>${row.name}</strong>.<br><br>
                           O status da encomenda <strong>${row.code}</strong> mudou para: <br>
                           <h3 style="color:#0a1931; background:#eee; padding:10px;">${status}</h3>`;
                
                if (delivery_proof) {
                    msg += `<br>📦 <strong>Entrega confirmada com foto/assinatura digital.</strong><br>Acesse seu painel para visualizar o comprovante.`;
                }
                
                if (typeof sendEmailHtml === 'function') {
                    sendEmailHtml(row.email, subject, `Status: ${status}`, msg);
                }
            }

            res.json({ success: true });
        });
    });
});
app.get('/api/boxes', (req, res) => {
    let sql = `SELECT boxes.*, users.name as client_name, orders.code as order_code, orders.status as order_status, orders.weight as order_weight FROM boxes JOIN users ON boxes.client_id = users.id LEFT JOIN orders ON boxes.order_id = orders.id`;
    let params = [];
    if(req.session.role === 'client') { sql += " WHERE boxes.client_id = ?"; params.push(req.session.userId); }
    db.all(sql, params, (err, rows) => res.json(rows));
});
app.post('/api/boxes/create', (req, res) => {
    const {client_id, order_id, box_code, products, amount} = req.body;
    db.run("INSERT INTO boxes (client_id, order_id, box_code, products, amount) VALUES (?,?,?,?,?)", [client_id, order_id, box_code, products, amount], (err) => res.json({success: !err}));
});
app.post('/api/boxes/delete', (req, res) => db.run("DELETE FROM boxes WHERE id = ?", [req.body.id], (err) => res.json({success: !err})));
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
// --- CORREÇÃO DA ROTA DE UPLOAD DE VÍDEO ---
app.post('/api/videos/upload', uploadVideo.single('video'), (req, res) => {
    // 1. Verifica se o arquivo chegou
    if(!req.file) {
        console.error("❌ Upload falhou: Nenhum arquivo recebido.");
        return res.status(400).json({success: false, msg: "Nenhum vídeo enviado."});
    }
    
    // 2. Verifica dados do corpo
    const { client_id, description } = req.body;
    if(!client_id) {
        console.error("❌ Upload falhou: ID do cliente faltando.");
        return res.status(400).json({success: false, msg: "Cliente não identificado."});
    }

    // 3. Salva no Banco
    db.run("INSERT INTO videos (client_id, filename, description) VALUES (?, ?, ?)", 
    [client_id, req.file.filename, description], (err) => {
        if(err) {
            console.error("❌ Erro no Banco ao salvar vídeo:", err.message);
            return res.status(500).json({success: false, msg: "Erro ao salvar no banco.", err: err.message});
        }
        
        console.log(`✅ Vídeo salvo com sucesso! Arquivo: ${req.file.filename}`);
        res.json({success: true});
    });
});

// 2. Listar Vídeos
app.get('/api/videos/list', (req, res) => {
    // Se for admin, vê tudo (ou filtra por cliente se quiser). Se for cliente, vê só os dele.
    if(req.session.role === 'client') {
        db.all("SELECT * FROM videos WHERE client_id = ? ORDER BY id DESC", [req.session.userId], (err, rows) => {
            res.json(rows);
        });
    } else {
        // Admin vê vídeos com nome do cliente
        db.all(`SELECT videos.*, users.name as client_name 
                FROM videos LEFT JOIN users ON videos.client_id = users.id 
                ORDER BY videos.id DESC`, (err, rows) => {
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
            try { fs.unlinkSync(`uploads/videos/${filename}`); } catch(e){}
        }
        res.json({success: !err});
    });
});
// CRIAR FATURA E ENVIAR EMAIL DE COBRANÇA
app.post('/api/invoices/create', async (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({msg: 'Sem permissão'});

    const { client_id, box_id, amount, description, email } = req.body; // O email vem do front

    try {
        // A. Mercado Pago (Mantém igual)
        const paymentData = {
            transaction_amount: parseFloat(amount),
            description: description,
            payment_method_id: 'pix',
            payer: { email: email || 'cliente@guineexpress.com' }
        };
        const result = await payment.create({ body: paymentData });
        const mp_id = result.id;
        const qr_code = result.point_of_interaction.transaction_data.qr_code;
        const qr_base64 = result.point_of_interaction.transaction_data.qr_code_base64;
        const ticket_url = result.point_of_interaction.transaction_data.ticket_url;

        // B. Salva no Banco
        db.run(`INSERT INTO invoices (client_id, box_id, amount, description, status, mp_payment_id, qr_code, qr_code_base64, payment_link) 
                VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
                [client_id, box_id, amount, description, mp_id, qr_code, qr_base64, ticket_url],
                function(err) {
                    if(err) return res.json({success: false, msg: 'Erro ao salvar fatura'});

                    // C. ENVIA O EMAIL AUTOMÁTICO
                    if (email) {
                        // Busca nome do cliente rapidinho
                        db.get("SELECT name FROM users WHERE id = ?", [client_id], (e, u) => {
                            const name = u ? u.name : 'Cliente';
                            
                            const subject = `Fatura Disponível: R$ ${amount}`;
                            const title = "Pagamento Pendente";
                            const msg = `Olá, <strong>${name}</strong>.<br><br>
                                         Uma nova fatura foi gerada para o envio <strong>${description}</strong>.<br>
                                         Valor: <strong>R$ ${amount}</strong><br><br>
                                         Clique abaixo para pagar via Pix ou Cartão:<br><br>
                                         <a href="${ticket_url}" style="background:#d4af37; color:#000; padding:12px 25px; text-decoration:none; font-weight:bold; font-size:16px; border-radius:5px;">PAGAR AGORA</a>`;
                            
                            sendEmailHtml(email, subject, title, msg);
                        });
                    }

                    res.json({success: true});
                });

    } catch (error) {
        console.error(error);
        res.json({success: false, msg: 'Erro na comunicação com Mercado Pago'});
    }
});

// 2. Listar Faturas
app.get('/api/invoices/list', (req, res) => {
    let sql = `SELECT invoices.*, users.name as client_name, boxes.box_code 
               FROM invoices 
               LEFT JOIN users ON invoices.client_id = users.id 
               LEFT JOIN boxes ON invoices.box_id = boxes.id`;
    
    let params = [];

    // Se for cliente, vê só as dele
    if(req.session.role === 'client') {
        sql += " WHERE invoices.client_id = ?";
        params.push(req.session.userId);
    } 
    // Se for funcionário ou admin, vê tudo (pode adicionar filtros se quiser)

    sql += " ORDER BY invoices.id DESC";
    
    db.all(sql, params, (err, rows) => {
        if(err) return res.json([]);
        res.json(rows);
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
// ======================================================
// 🚀 INÍCIO DAS ROTAS DE PAGAMENTO (PIX E CARTÃO)
// ======================================================

// ======================================================
// 1. ROTA DE PIX (ATUALIZADA)
// ======================================================
app.post('/api/create-pix', async (req, res) => {
    try {
        const { amount, description, email, firstName } = req.body;

        const payment = new Payment(client);

        const body = {
            transaction_amount: parseFloat(amount),
            description: description || 'Pagamento Guineexpress',
            payment_method_id: 'pix',
            payer: {
                email: email || 'email@cliente.com',
                first_name: firstName || 'Cliente'
            },
            date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        };

        const result = await payment.create({ body });

        // RETORNA O ID DO PAGAMENTO PARA O FRONTEND MONITORAR
        res.json({
            payment_id: result.id, // O frontend precisa disso para o Robô
            qr_code: result.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64
        });

    } catch (error) {
        console.error("Erro ao gerar Pix:", error);
        res.status(500).json({ error: 'Erro ao conectar com Mercado Pago' });
    }
});

// ======================================================
// 2. NOVA ROTA: CHECAR STATUS (O ROBÔ USA ESSA)
// ======================================================
app.post('/api/check-payment-status', async (req, res) => {
    try {
        // Recebe o ID do pagamento (MP) e o ID da fatura (Banco de dados)
        const { payment_id, invoice_id } = req.body;

        const payment = new Payment(client);
        
        // Pergunta ao Mercado Pago: "E aí, esse ID já pagou?"
        const result = await payment.get({ id: payment_id });

        const status = result.status; // 'pending', 'approved', 'rejected'

        if (status === 'approved') {
            // SE O DINHEIRO CAIU, ATUALIZA O BANCO SOZINHO!
            
            // 1. Atualiza a fatura para 'approved'
            db.run("UPDATE invoices SET status = 'approved', mp_payment_id = ? WHERE id = ?", 
                [payment_id, invoice_id], 
                (err) => {
                    if (err) console.error("Erro ao atualizar fatura:", err);
                    else console.log(`✅ Fatura #${invoice_id} paga via PIX Automático!`);
                }
            );

            // 2. (Opcional) Se a fatura for de um Box, acha o Box e a Encomenda e marca como Pago
            // Isso garante que a encomenda mude de cor na tabela
            db.get("SELECT box_id FROM invoices WHERE id = ?", [invoice_id], (err, row) => {
                if(row && row.box_id) {
                    db.run("UPDATE orders SET status = 'Pago' WHERE id IN (SELECT order_id FROM boxes WHERE id = ?)", [row.box_id]);
                }
            });
        }

        // Responde para o frontend (o robô vai ler isso)
        res.json({ status: status });

    } catch (error) {
        console.error("Erro ao verificar status:", error);
        res.status(500).json({ error: "Erro na verificação" });
    }
});
// 2. Rota para gerar Link de Cartão (Checkout Pro)
app.post('/api/create-preference', async (req, res) => {
    try {
        const { title, price, quantity } = req.body;

        const preference = new Preference(client);

        const body = {
            items: [
                {
                    title: title,
                    quantity: Number(quantity),
                    unit_price: Number(price),
                    currency_id: 'BRL',
                },
            ],
            // Configure para onde o cliente volta depois de pagar
            back_urls: {
                success: 'https://seusite.com/dashboard-client.html', // Mude para seu domínio real
                failure: 'https://seusite.com/dashboard-client.html',
                pending: 'https://seusite.com/dashboard-client.html',
            },
            auto_return: 'approved',
        };

        const result = await preference.create({ body });

        // Devolve o link para redirecionar o cliente
        res.json({ init_point: result.init_point });

    } catch (error) {
        console.error("Erro ao criar preferência:", error);
        res.status(500).json({ error: 'Erro ao criar checkout' });
    }
});

// ======================================================
// 🏁 FIM DAS ROTAS DE PAGAMENTO
// ======================================================
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
// --- ROTA: DADOS DO DASHBOARD (GRÁFICOS REAIS) ---
app.get('/api/dashboard-stats', (req, res) => {
    
    // 1. Totais Gerais (Cards do Topo)
    const sqlTotals = `
        SELECT 
            (SELECT SUM(price) FROM orders) as revenue,
            (SELECT SUM(weight) FROM orders) as weight,
            (SELECT COUNT(*) FROM orders) as totalOrders,
            (SELECT COUNT(*) FROM users WHERE role = 'client') as totalClients
    `;

    // 2. Distribuição de Status (Gráfico de Rosca)
    const sqlStatus = "SELECT status, COUNT(*) as count FROM orders GROUP BY status";

    // 3. Faturamento Mensal - Últimos 6 Meses (Gráfico de Barras)
    // Nota: strftime é função do SQLite para formatar datas
    const sqlMonthly = `
        SELECT strftime('%m/%Y', created_at) as month, SUM(price) as total 
        FROM orders 
        WHERE created_at >= date('now', '-6 months') 
        GROUP BY month 
        ORDER BY created_at ASC
    `;

    db.get(sqlTotals, [], (err, totals) => {
        if (err) return res.json({ success: false });

        db.all(sqlStatus, [], (err, statusRows) => {
            
            db.all(sqlMonthly, [], (err, monthlyRows) => {
                
                // Prepara os meses (caso não tenha vendas em algum mês, o gráfico mostra o que tem)
                res.json({
                    success: true,
                    data: {
                        revenue: totals.revenue || 0,
                        weight: totals.weight || 0,
                        totalOrders: totals.totalOrders || 0,
                        totalClients: totals.totalClients || 0,
                        statusDistribution: statusRows || [],
                        revenueHistory: monthlyRows || [] // Envia o histórico real
                    }
                });
            });
        });
    });
});
// ==========================================
// ROTA DO RECIBO PRO (COM STATUS DE PAGAMENTO)
// ==========================================
app.get('/api/receipt-data/:boxId', (req, res) => {
    const boxId = req.params.boxId;

    const sqlBox = `
        SELECT 
            boxes.id, boxes.box_code, boxes.amount, boxes.products, boxes.created_at,
            orders.weight as weight, 
            orders.code as order_code,
            users.name as client_name, users.phone, users.document, users.country, users.email,
            invoices.status as payment_status -- Pega o status do pagamento (approved/pending)
        FROM boxes
        LEFT JOIN users ON boxes.client_id = users.id
        LEFT JOIN orders ON boxes.order_id = orders.id
        LEFT JOIN invoices ON boxes.id = invoices.box_id
        WHERE boxes.id = ?
    `;

    db.get(sqlBox, [boxId], (err, box) => {
        if (err) return res.json({ success: false, msg: "Erro no banco." });
        if (!box) return res.json({ success: false, msg: "Box não encontrada." });

        // Busca preço por Kg para cálculo automático
        db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err2, setting) => {
            let pricePerKg = setting ? parseFloat(setting.value) : 0;
            let currentAmount = parseFloat(box.amount) || 0;
            let weight = parseFloat(box.weight) || 0;

            // Se valor for 0, calcula automático (Peso x Preço)
            if (currentAmount === 0 && weight > 0 && pricePerKg > 0) {
                currentAmount = weight * pricePerKg;
            }

            box.amount = currentAmount.toFixed(2);
            box.weight = weight.toFixed(2);
            
            // Define status legível para o recibo
            box.is_paid = (box.payment_status === 'approved'); 

            res.json({ success: true, data: box });
        });
    });
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

// --- ROTA: Atualizar Encomenda (CORRIGIDA) ---
app.put('/api/orders/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });

    const { client_id, code, description, weight, status } = req.body;
    const id = req.params.id;

    // 1. Busca o preço atual no banco para recalcular
    db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err, row) => {
        // Se não achar, usa 0
        const pricePerKg = row ? parseFloat(row.value) : 0;
        
        // 2. Recalcula o preço novo (Peso Editado * Preço Atual)
        const newPrice = (parseFloat(weight) * pricePerKg).toFixed(2);

        const sql = `
            UPDATE orders 
            SET client_id = ?, code = ?, description = ?, weight = ?, status = ?, price = ?
            WHERE id = ?
        `;

        // 3. Salva com o preço correto
        db.run(sql, [client_id, code, description, weight, status, newPrice, id], function(err) {
            if (err) {
                console.error(err);
                return res.json({ success: false, message: "Erro ao atualizar no banco." });
            }
            res.json({ success: true });
        });
    });
});
// --- ROTA: Excluir Encomenda (CORRIGIDA) ---
app.delete('/api/orders/:id', (req, res) => {
    if (!req.session.userId || req.session.role === 'client') {
        return res.status(403).json({ success: false, message: 'Sem permissão' });
    }

    const id = req.params.id;
    const userName = req.session.userName || 'Staff'; // Nome de quem apagou
    const ip = req.ip || req.connection.remoteAddress;

    // 1. Pega o código da encomenda antes de apagar
    db.get("SELECT code FROM orders WHERE id = ?", [id], (err, row) => {
        const orderCode = row ? row.code : 'Desconhecido';

        // 2. Apaga a encomenda
        db.run("DELETE FROM orders WHERE id = ?", [id], function(err) {
            if (err) return res.json({ success: false, message: "Erro ao excluir." });

            // 3. SALVA O LOG NA TABELA CERTA (system_logs)
            const action = "EXCLUSÃO";
            const details = `Apagou a encomenda ${orderCode} (ID: ${id})`;

            db.run(`INSERT INTO system_logs (user_name, action, details, ip_address) 
                    VALUES (?, ?, ?, ?)`, 
                [userName, action, details, ip], (logErr) => {
                    if (logErr) console.error("Erro ao gravar log:", logErr.message);
            });

            res.json({ success: true });
        });
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
        const { text, userContext, image, lang } = req.body;

        const systemPrompt = `Você é a Cicí Pro Max 20.0 da Guineexpress.
        Contexto do Usuário: Nome: ${userContext.name}, Cargo: ${userContext.role}, Aparelho: ${userContext.deviceInfo}.
        Idioma de resposta: ${lang}.

        HABILIDADES ESPECIAIS:
        1. ANALISAR DOCUMENTOS/IMAGENS: Se o usuário enviar uma foto de documento ou fatura, descreva os dados e ajude-o.
        2. APOIO AO CADASTRO: Se o usuário der informações como "Meu nome é João, moro na rua X", você deve responder com o comando: [ACTION:fillForm:{"nome":"João", "endereco":"rua X"}] e confirmar que preencheu.
        3. MULTILÍNGUE: Fale fluentemente qualquer idioma solicitado.
        4. INSTALAÇÃO: Sugira [ACTION:install] se ele quiser o app.

        Personalidade: Útil, rápida e super inteligente.`;

        let messageParts = [{ text: text || "Análise este arquivo/imagem." }];
        if (image) {
            // Suporte para análise de OCR/Documentos via Gemini Vision
            messageParts.push({ 
                inlineData: { data: image.split(',')[1], mimeType: "image/jpeg" } 
            });
        }

        const result = await model.generateContent([systemPrompt, ...messageParts]);
        const response = await result.response;
        res.json({ reply: response.text(), lang });

    } catch (error) {
        console.error(error);
        res.status(500).json({ reply: "Erro no processamento da Cicí." });
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

// ROTA PARA O CELULAR SE INSCREVER
app.post('/api/notifications/subscribe', (req, res) => {
    console.log("Recebi uma tentativa de inscrição push!");
    const subscription = req.body;
    const userId = req.session.userId;
    
    if (!userId) return res.status(401).json({ error: "Não logado" });

    // Armazenamos a string da inscrição no banco de dados
    db.run("UPDATE users SET push_subscription = ? WHERE id = ?", [JSON.stringify(subscription), userId], (err) => {
        if (err) {
            console.error("Erro banco ao salvar push:", err);
            return res.status(500).json({ error: "Erro ao salvar inscrição" });
        }
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
// =====================================================
// INICIALIZAÇÃO DO SERVIDOR (CORRIGIDO PARA O RENDER)
// =====================================================
const PORT = process.env.PORT || 3000;

// O segredo está no '0.0.0.0' adicionado aqui embaixo 👇
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor Guineexpress rodando na porta ${PORT}`);
    console.log(`📡 Modo: ${process.env.NODE_ENV || 'Desenvolvimento'}`);
});
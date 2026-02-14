require('dotenv').config(); // Lê as variáveis de ambiente
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// ==================================================================
// 1. CONFIGURAÇÃO DO DISCO PERMANENTE (RENDER)
// ==================================================================
// Verifica se o disco do Render (pasta '/data') existe. 
// Se existir, usa ela. Se não (no seu computador), usa a pasta atual ('.').
const dataFolder = fs.existsSync('/data') ? '/data' : '.';
const dbPath = path.join(dataFolder, 'guineexpress_v4.db');

// Conecta ao banco de dados no local correto
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log(`✅ Conectado ao banco de dados SQLite em: ${dbPath}`);
    }
});

// 2. Executa a criação e atualização das tabelas em sequência
db.serialize(() => {
    console.log("🔄 Verificando e atualizando estrutura do banco...");

    // --- TABELAS PRINCIPAIS ---

    // Tabela de Usuários
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT, 
        name TEXT, 
        email TEXT UNIQUE, 
        phone TEXT, 
        country TEXT, 
        document TEXT, 
        password TEXT,
        profile_pic TEXT DEFAULT 'default.png', 
        active INTEGER DEFAULT 1
    )`);
    // --- TABELA DE HISTÓRICO DE LOGINS ---
    db.run(`CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_input TEXT,    -- O email ou telefone que a pessoa digitou
        status TEXT,        -- 'Sucesso' ou 'Falha'
        reason TEXT,        -- Motivo (ex: Senha Incorreta)
        device TEXT,        -- 'Celular' ou 'Computador'
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    // Tabela de Encomendas
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        client_id INTEGER,
        description TEXT,
        weight REAL,
        status TEXT,
        price REAL DEFAULT 0,
        delivery_proof TEXT,      
        proof_image TEXT,         
        delivery_location TEXT,   
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id)
    )`);

    // Tabela de Box
    db.run(`CREATE TABLE IF NOT EXISTS boxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        order_id INTEGER, 
        box_code TEXT,
        products TEXT,
        amount REAL,
        shipment_id INTEGER,      
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id),
        FOREIGN KEY(order_id) REFERENCES orders(id),
        FOREIGN KEY(shipment_id) REFERENCES shipments(id)
    )`);

    // Tabela de Despesas
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT,
        category TEXT, 
        amount REAL,
        date DATE DEFAULT CURRENT_DATE
    )`);

    // Garante que a tabela de logs existe
    db.run(`CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT,
        action TEXT,      
        details TEXT,    
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de Embarques (Shipments)
    db.run(`CREATE TABLE IF NOT EXISTS shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,   
        type TEXT,            
        status TEXT,          
        departure_date DATE,
        arrival_forecast DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de Faturas (Financeiro)
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        box_id INTEGER,
        amount REAL,
        description TEXT,
        status TEXT DEFAULT 'pending', 
        mp_payment_id TEXT, 
        qr_code TEXT, 
        qr_code_base64 TEXT, 
        payment_link TEXT, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id),
        FOREIGN KEY(box_id) REFERENCES boxes(id)
    )`);

    // Agendamento - Vagas
    db.run(`CREATE TABLE IF NOT EXISTS availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT, 
        start_time TEXT, 
        end_time TEXT, 
        max_slots INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Configurações Globais
    db.run("CREATE TABLE IF NOT EXISTS settings (key TEXT UNIQUE, value REAL)");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('price_per_kg', 0.00)");

    // Agendamento - Pedidos
    db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        availability_id INTEGER, 
        client_id INTEGER, 
        time_slot TEXT,  
        status TEXT DEFAULT 'Pendente',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(availability_id) REFERENCES availability(id),
        FOREIGN KEY(client_id) REFERENCES users(id)
    )`);

    // Tabela de Vídeos
    db.run(`CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        filename TEXT,
        description TEXT, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id)
    )`);

    // --- PATCH DE CORREÇÃO (ALTER TABLE) ---
    db.run("ALTER TABLE orders ADD COLUMN delivery_proof TEXT", () => {}); 
    db.run("ALTER TABLE orders ADD COLUMN proof_image TEXT", () => {});      
    db.run("ALTER TABLE orders ADD COLUMN delivery_location TEXT", () => {}); 
    db.run("ALTER TABLE invoices ADD COLUMN mp_payment_id TEXT", () => {});
    db.run("ALTER TABLE boxes ADD COLUMN shipment_id INTEGER REFERENCES shipments(id)", () => {});

    console.log("✅ Tabelas sincronizadas e colunas verificadas.");

    // =======================================================
    // 3. SEGURANÇA: CRIAÇÃO DE USUÁRIOS (ADMIN/FUNCIONÁRIOS)
    // =======================================================
    const createUser = (role, name, email, password) => {
        if (!password) return; // Não cria se não tiver senha no .env

        db.get("SELECT email FROM users WHERE email = ?", [email], (err, row) => {
            if (!row) {
                const hash = bcrypt.hashSync(password, 10);
                db.run(`INSERT INTO users (role, name, email, password, country) VALUES (?, ?, ?, ?, ?)`, 
                    [role, name, email, hash, 'Guiné-Bissau']);
                console.log(`[SEGURANÇA] Usuário inicial criado: ${name}`);
            }
        });
    };

    // Lê do arquivo .env
    createUser('admin', 'Lelo (Admin)', 'lelo@guineexpress.com', process.env.PASS_ADMIN);
    createUser('employee', 'Cala', 'cala@guineexpress.com', process.env.PASS_CALA);
    createUser('employee', 'Guto', 'guto@guineexpress.com', process.env.PASS_GUTO);
    createUser('employee', 'Pedro', 'pedro@guineexpress.com', process.env.PASS_PEDRO);
    createUser('employee', 'Neu', 'neu@guineexpress.com', process.env.PASS_NEU);
});

// Exporta a conexão para ser usada no server.js
module.exports = db;
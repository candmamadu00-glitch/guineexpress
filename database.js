require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// ==================================================================
// 1. CONFIGURAÇÃO DO DISCO PERMANENTE (RENDER / LOCAL)
// ==================================================================
const dataFolder = fs.existsSync('/data') ? '/data' : '.';
const dbPath = path.join(dataFolder, 'guineexpress_v4.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log(`✅ Conectado ao banco de dados SQLite em: ${dbPath}`);
    }
});

// 🔒 BLINDAGEM DE CONCORRÊNCIA E PERFORMANCE (WAL MODE)
db.exec(`
    PRAGMA busy_timeout = 15000;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
`);

// Helper seguro para adicionar colunas em tabelas existentes sem estourar erro
function addColumn(table, column, definition) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (err) => {
        // Silencia erro de coluna duplicada
    });
}

// ==================================================================
// 2. CRIAÇÃO E ATUALIZAÇÃO DA ESTRUTURA DO BANCO
// ==================================================================
db.serialize(() => {
    console.log("🔄 Verificando e atualizando estrutura do banco...");

    // --- TABELAS BASE ---
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
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS zap_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT,
        tipo TEXT,
        conteudo TEXT,
        opcoes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_input TEXT,
        status TEXT,
        reason TEXT,
        device TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

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

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        title TEXT,
        message TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id)
    )`);

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

    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT,
        category TEXT, 
        amount REAL,
        date DATE DEFAULT CURRENT_DATE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT,
        action TEXT, 
        details TEXT, 
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE, 
        type TEXT, 
        status TEXT, 
        departure_date DATE,
        arrival_forecast DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

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

    // --- TABELAS DA LOJA ---
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        category TEXT,
        price_brl REAL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        product_id INTEGER,
        quantity INTEGER DEFAULT 1,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS store_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        total_brl REAL DEFAULT 0,
        total_cfa REAL DEFAULT 0,
        total_eur REAL DEFAULT 0,
        currency_chosen TEXT,
        status TEXT DEFAULT 'pending',
        payment_receipt TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS store_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        price_brl REAL,
        FOREIGN KEY(order_id) REFERENCES store_orders(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT, 
        start_time TEXT, 
        end_time TEXT, 
        max_slots INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run("CREATE TABLE IF NOT EXISTS settings (key TEXT UNIQUE, value REAL)");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('price_per_kg', 0.00)");

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

    db.run(`CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        order_code TEXT,
        filename TEXT,
        description TEXT, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id)
    )`);

    // --- PATCHES DE COLUNAS ADICIONAIS (MIGRAÇÕES SEGURAS) ---
    addColumn("users", "push_subscription", "TEXT");
    addColumn("users", "webauthn_id", "TEXT");
    addColumn("users", "webauthn_public_key", "TEXT");
    addColumn("users", "webauthn_counter", "INTEGER DEFAULT 0");
    addColumn("users", "express_points", "INTEGER DEFAULT 0");
    addColumn("users", "passport_stamps", "TEXT DEFAULT ''");

    addColumn("orders", "delivery_proof", "TEXT");
    addColumn("orders", "proof_image", "TEXT");
    addColumn("orders", "delivery_location", "TEXT");
    addColumn("orders", "destino", "TEXT");
    addColumn("orders", "label_printed", "INTEGER DEFAULT 0");
    addColumn("orders", "deleted", "INTEGER DEFAULT 0");

    addColumn("boxes", "shipment_id", "INTEGER REFERENCES shipments(id)");
    addColumn("boxes", "label_printed", "INTEGER DEFAULT 0");
    addColumn("boxes", "volumes", "INTEGER DEFAULT 1");
    addColumn("boxes", "deleted", "INTEGER DEFAULT 0");
    addColumn("boxes", "receiver_name", "TEXT");
    addColumn("boxes", "receiver_doc", "TEXT");
    addColumn("boxes", "gross_weight", "REAL DEFAULT 0");

    addColumn("invoices", "mp_payment_id", "TEXT");
    addColumn("invoices", "transaction_id", "TEXT");
    addColumn("invoices", "nf_amount", "REAL DEFAULT 0");
    addColumn("invoices", "freight_amount", "REAL DEFAULT 0");

    addColumn("store_orders", "client_name", "TEXT");
    addColumn("store_orders", "client_phone", "TEXT");
    addColumn("store_orders", "delivery_address", "TEXT");
    addColumn("store_orders", "currency_used", "TEXT");
    addColumn("store_orders", "payment_method", "TEXT");

    addColumn("store_order_items", "product_name", "TEXT");
    addColumn("store_order_items", "image_url", "TEXT");

    addColumn("availability", "lote", "TEXT");
    addColumn("videos", "order_code", "TEXT");

    console.log("✅ Tabelas e colunas sincronizadas com sucesso.");

    // =======================================================
    // 3. SEGURANÇA: CRIAÇÃO DE USUÁRIOS PADRÃO
    // =======================================================
    const createUser = (role, name, email, password) => {
        if (!password) return;

        db.get("SELECT email FROM users WHERE email = ?", [email], (err, row) => {
            if (!row) {
                const hash = bcrypt.hashSync(password, 10);
                db.run(`INSERT INTO users (role, name, email, password, country) VALUES (?, ?, ?, ?, ?)`, 
                    [role, name, email, hash, 'Guiné-Bissau']);
                console.log(`[SEGURANÇA] Usuário inicial criado: ${name}`);
            }
        });
    };

    createUser('admin', 'Lelo (Admin)', 'lelo@guineexpress.com', process.env.PASS_ADMIN);
    createUser('employee', 'Cala', 'cala@guineexpress.com', process.env.PASS_CALA);
    createUser('employee', 'Guto', 'guto@guineexpress.com', process.env.PASS_GUTO);
    createUser('employee', 'Pedro', 'pedro@guineexpress.com', process.env.PASS_PEDRO);
    createUser('employee', 'Neu', 'neu@guineexpress.com', process.env.PASS_NEU);
});

module.exports = db;
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// ====================================================
// 1. CONFIGURAÇÃO DA CONEXÃO (INTELIGENTE)
// ====================================================
// Detecta se está no Render (Produção) ou no PC (Local)
const isProduction = process.env.RENDER || process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false // Usa SSL só se necessário
});

// ====================================================
// 2. CAMADA DE COMPATIBILIDADE (SQLite -> Postgres)
// ====================================================
// Transforma os comandos do SQLite (?, db.run) para PostgreSQL ($1, pool.query)

const adaptSql = (sql, params = []) => {
    let i = 0;
    const convertedSql = sql.replace(/\?/g, () => '$' + (++i));
    return { text: convertedSql, values: params };
};

const db = {
    // Simula db.run (INSERT, UPDATE, DELETE)
    run: (sql, params, callback) => {
        if (typeof params === 'function') { callback = params; params = []; }
        const { text, values } = adaptSql(sql, params);
        
        pool.query(text, values)
            .then(res => {
                // Simula o objeto "this" do SQLite
                if (callback) callback.call({ lastID: 0, changes: res.rowCount }, null);
            })
            .catch(err => {
                console.error("Erro no DB (RUN):", err.message);
                if (callback) callback(err);
            });
    },
    // Simula db.all (SELECT lista)
    all: (sql, params, callback) => {
        if (typeof params === 'function') { callback = params; params = []; }
        const { text, values } = adaptSql(sql, params);

        pool.query(text, values)
            .then(res => {
                if (callback) callback(null, res.rows);
            })
            .catch(err => {
                console.error("Erro no DB (ALL):", err.message);
                if (callback) callback(err, []);
            });
    },
    // Simula db.get (SELECT único)
    get: (sql, params, callback) => {
        if (typeof params === 'function') { callback = params; params = []; }
        const { text, values } = adaptSql(sql, params);

        pool.query(text, values)
            .then(res => {
                if (callback) callback(null, res.rows[0]);
            })
            .catch(err => {
                console.error("Erro no DB (GET):", err.message);
                if (callback) callback(err, null);
            });
    },
    // Simula db.serialize (Apenas executa)
    serialize: (callback) => callback()
};

// ====================================================
// 3. INICIALIZAÇÃO E TABELAS
// ====================================================
const initDb = async () => {
    try {
        console.log("🔄 Conectando ao PostgreSQL e verificando tabelas...");
        const client = await pool.connect();

        // Users
        await client.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            role VARCHAR(50), 
            name VARCHAR(255), 
            email VARCHAR(255) UNIQUE, 
            phone VARCHAR(50), 
            country VARCHAR(100), 
            document VARCHAR(50), 
            password TEXT,
            profile_pic TEXT DEFAULT 'default.png', 
            active INTEGER DEFAULT 1
        )`);

        // Access Logs
        await client.query(`CREATE TABLE IF NOT EXISTS access_logs (
            id SERIAL PRIMARY KEY,
            user_input TEXT,
            status VARCHAR(50),
            reason TEXT,
            device VARCHAR(50),
            ip_address VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Orders
        await client.query(`CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            code VARCHAR(100) UNIQUE,
            client_id INTEGER REFERENCES users(id),
            description TEXT,
            weight REAL,
            status VARCHAR(50),
            price REAL DEFAULT 0,
            delivery_proof TEXT,      
            proof_image TEXT,         
            delivery_location TEXT,   
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Shipments
        await client.query(`CREATE TABLE IF NOT EXISTS shipments (
            id SERIAL PRIMARY KEY,
            code VARCHAR(100) UNIQUE,   
            type VARCHAR(50),            
            status VARCHAR(50),          
            departure_date DATE,
            arrival_forecast DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Boxes
        await client.query(`CREATE TABLE IF NOT EXISTS boxes (
            id SERIAL PRIMARY KEY,
            client_id INTEGER REFERENCES users(id),
            order_id INTEGER REFERENCES orders(id), 
            box_code VARCHAR(100),
            products TEXT,
            amount REAL,
            shipment_id INTEGER REFERENCES shipments(id),      
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Expenses
        await client.query(`CREATE TABLE IF NOT EXISTS expenses (
            id SERIAL PRIMARY KEY,
            description TEXT,
            category VARCHAR(100), 
            amount REAL,
            date DATE DEFAULT CURRENT_DATE
        )`);

        // Invoices
        await client.query(`CREATE TABLE IF NOT EXISTS invoices (
            id SERIAL PRIMARY KEY,
            client_id INTEGER REFERENCES users(id),
            box_id INTEGER REFERENCES boxes(id),
            amount REAL,
            description TEXT,
            status VARCHAR(50) DEFAULT 'pending', 
            mp_payment_id VARCHAR(100), 
            qr_code TEXT, 
            qr_code_base64 TEXT, 
            payment_link TEXT, 
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Availability & Appointments
        await client.query(`CREATE TABLE IF NOT EXISTS availability (
            id SERIAL PRIMARY KEY,
            date VARCHAR(20), 
            start_time VARCHAR(20), 
            end_time VARCHAR(20), 
            max_slots INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS appointments (
            id SERIAL PRIMARY KEY,
            availability_id INTEGER REFERENCES availability(id), 
            client_id INTEGER REFERENCES users(id), 
            time_slot VARCHAR(20),  
            status VARCHAR(50) DEFAULT 'Pendente',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Videos
        await client.query(`CREATE TABLE IF NOT EXISTS videos (
            id SERIAL PRIMARY KEY,
            client_id INTEGER REFERENCES users(id),
            filename TEXT,
            description TEXT, 
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Settings
        await client.query(`CREATE TABLE IF NOT EXISTS settings (key VARCHAR(100) UNIQUE, value REAL)`);
        await client.query(`INSERT INTO settings (key, value) VALUES ('price_per_kg', 0.00) ON CONFLICT DO NOTHING`);

        // Adicionar colunas se faltarem (Migration simples)
        const addCol = async (table, col, type) => {
            try {
                await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`);
            } catch (e) { /* Coluna já existe */ }
        };
        await addCol('orders', 'delivery_proof', 'TEXT');
        await addCol('orders', 'proof_image', 'TEXT');
        await addCol('orders', 'delivery_location', 'TEXT');
        await addCol('invoices', 'mp_payment_id', 'VARCHAR(100)');
        await addCol('boxes', 'shipment_id', 'INTEGER');

        console.log("✅ Tabelas PostgreSQL sincronizadas.");
        client.release();

        // Cria usuários padrão após as tabelas existirem
        createInitialUsers();

    } catch (err) {
        console.error("❌ Erro fatal ao iniciar PostgreSQL:", err);
    }
};

const createInitialUsers = () => {
    const users = [
        { r: 'admin', n: 'Lelo (Admin)', e: 'lelo@guineexpress.com', p: process.env.PASS_ADMIN },
        { r: 'employee', n: 'Cala', e: 'cala@guineexpress.com', p: process.env.PASS_CALA },
        { r: 'employee', n: 'Guto', e: 'guto@guineexpress.com', p: process.env.PASS_GUTO },
        { r: 'employee', n: 'Pedro', e: 'pedro@guineexpress.com', p: process.env.PASS_PEDRO },
        { r: 'employee', n: 'Neu', e: 'neu@guineexpress.com', p: process.env.PASS_NEU }
    ];

    users.forEach(u => {
        if (!u.p) return;
        // Verifica se usuário existe
        db.get("SELECT email FROM users WHERE email = ?", [u.e], (err, row) => {
            if (!row) {
                const hash = bcrypt.hashSync(u.p, 10);
                db.run(`INSERT INTO users (role, name, email, password, country) VALUES (?, ?, ?, ?, ?)`, 
                    [u.r, u.n, u.e, hash, 'Guiné-Bissau']);
                console.log(`[SEGURANÇA] Usuário criado: ${u.n}`);
            }
        });
    });
};

initDb();

module.exports = db;
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Encontra o banco de dados
const dataFolder = fs.existsSync('/data') ? '/data' : '.';
const dbPath = path.join(dataFolder, 'guineexpress_v4.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao ligar:', err.message);
        return;
    }
    console.log(`✅ Conectado a: ${dbPath}`);
    
    // Força a injeção da coluna created_at
    db.run("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('⚠️ A coluna created_at JÁ EXISTE! Tudo pronto.');
            } else {
                console.error('❌ Erro ao criar a coluna:', err.message);
            }
        } else {
            console.log('✅ SUCESSO! A coluna created_at foi adicionada à tabela users.');
        }
        
        // Fecha o banco de dados
        db.close(() => {
            console.log('Pode fechar este script e iniciar o server.js novamente.');
        });
    });
});
const sqlite3 = require('sqlite3').verbose();
// AQUI: Usando o nome correto do seu banco de dados
const db = new sqlite3.Database('./guineexpress_v4.db');

db.serialize(() => {
  // Vamos adicionar a coluna na tabela ORDERS (Encomendas), que é onde fica o status de entrega
  db.run("ALTER TABLE orders ADD COLUMN delivery_proof TEXT", (err) => {
    if (err) {
      console.log("Mensagem (pode ignorar se disser que já existe): " + err.message);
    } else {
      console.log("✅ SUCESSO! Coluna 'delivery_proof' criada na tabela 'orders'.");
    }
  });
});

db.close();
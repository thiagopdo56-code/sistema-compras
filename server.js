// server.js
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors()); 
app.use(express.json()); 
app.use(express.static(__dirname));

const db = new sqlite3.Database('./mercado.db', (err) => {
    if (err) {
        console.error("Erro ao conectar no banco:", err.message);
    } else {
        console.log("Conectado ao banco SQLite com sucesso!");

        db.serialize(() => {
            // 1. Configurações da Impressora
            db.run(`CREATE TABLE IF NOT EXISTS configuracoes_impressora (
                id INTEGER PRIMARY KEY AUTOINCREMENT, nome_estabelecimento TEXT,
                cnpj TEXT, endereco TEXT, frase_rodape TEXT
            )`);
            db.get(`SELECT id FROM configuracoes_impressora WHERE id = 1`, (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO configuracoes_impressora (id, nome_estabelecimento, cnpj, endereco, frase_rodape) 
                            VALUES (1, 'Meu Mercado', '00.000.000/0000-00', 'Endereço Padrão', 'Obrigado pela preferência!')`);
                }
            });

            // 2. Produtos
            db.run(`CREATE TABLE IF NOT EXISTS produtos (
                id INTEGER PRIMARY KEY AUTOINCREMENT, codigo_barras TEXT, nome TEXT,
                categoria TEXT, preco REAL, estoque INTEGER, marca TEXT, unidade TEXT, variacoes TEXT
            )`);

            // 3. Vendas (Colunas cliente_cpf e cliente_nome para o histórico)
            db.run(`CREATE TABLE IF NOT EXISTS vendas (
                id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, hora TEXT, totalBruto REAL,
                desconto REAL, totalLiquido REAL, custoTaxas REAL, pagamento TEXT,
                detalhesPagamento TEXT, itens TEXT, valorParaRelatorio REAL, cliente_cpf TEXT, cliente_nome TEXT
            )`);
            
            // Atualizações seguras para bancos antigos:
            db.run(`ALTER TABLE vendas ADD COLUMN cliente_cpf TEXT`, (err) => {}); 
            db.run(`ALTER TABLE vendas ADD COLUMN cliente_nome TEXT`, (err) => {}); 

            // 4. Fiados/Clientes (Coluna aniversario)
            db.run(`CREATE TABLE IF NOT EXISTS fiados (
                id INTEGER PRIMARY KEY AUTOINCREMENT, cliente TEXT, cpf TEXT, telefone TEXT,
                endereco TEXT, dataCompra TEXT, dataPagamento TEXT, total REAL,
                valorPago REAL, itens TEXT, aniversario TEXT
            )`);
            
            db.run(`ALTER TABLE fiados ADD COLUMN aniversario TEXT`, (err) => {});

            // 5. Produtos por Peso
            db.run(`CREATE TABLE IF NOT EXISTS produtos_peso (
                id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, precoKg REAL
            )`);
            
            console.log("Todas as tabelas foram verificadas/criadas com sucesso!");
        });
    }
});

// ================= ROTAS DE PRODUTOS =================
app.get('/api/produtos', (req, res) => {
    db.all("SELECT * FROM produtos", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows.map(p => ({ ...p, variacoes: JSON.parse(p.variacoes || "[]") })));
    });
});
app.post('/api/produtos', (req, res) => {
    const { codigo_barras, nome, categoria, preco, estoque, marca, unidade, variacoes } = req.body;
    db.run(`INSERT INTO produtos (codigo_barras, nome, categoria, preco, estoque, marca, unidade, variacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    [codigo_barras, nome, categoria, preco, estoque, marca, unidade, JSON.stringify(variacoes || [])], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Produto cadastrado!", id: this.lastID });
    });
});
app.put('/api/produtos/:id', (req, res) => {
    const { codigo_barras, nome, categoria, preco, estoque, marca, unidade, variacoes } = req.body;
    db.run(`UPDATE produtos SET codigo_barras=?, nome=?, categoria=?, preco=?, estoque=?, marca=?, unidade=?, variacoes=? WHERE id=?`, 
    [codigo_barras, nome, categoria, preco, estoque, marca, unidade, JSON.stringify(variacoes || []), req.params.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Produto atualizado!" });
    });
});
app.delete('/api/produtos/:id', (req, res) => {
    db.run(`DELETE FROM produtos WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ erro: err.message }); res.json({ mensagem: "Produto excluído!" });
    });
});

// ================= ROTAS DE PRODUTOS POR PESO =================
app.get('/api/produtos_peso', (req, res) => {
    db.all("SELECT * FROM produtos_peso", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message }); res.json(rows);
    });
});
app.post('/api/produtos_peso', (req, res) => {
    db.run(`INSERT INTO produtos_peso (nome, precoKg) VALUES (?, ?)`, [req.body.nome, req.body.precoKg], function(err) {
        if (err) return res.status(500).json({ erro: err.message }); res.json({ id: this.lastID });
    });
});
app.put('/api/produtos_peso/:id', (req, res) => {
    db.run(`UPDATE produtos_peso SET nome=?, precoKg=? WHERE id=?`, [req.body.nome, req.body.precoKg, req.params.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message }); res.json({ mensagem: "Atualizado" });
    });
});
app.delete('/api/produtos_peso/:id', (req, res) => {
    db.run(`DELETE FROM produtos_peso WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ erro: err.message }); res.json({ mensagem: "Excluído" });
    });
});

// ================= ROTAS DE VENDAS & HISTÓRICO =================
app.get('/api/vendas', (req, res) => {
    db.all("SELECT * FROM vendas ORDER BY id ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows.map(v => ({ ...v, detalhesPagamento: JSON.parse(v.detalhesPagamento || "[]"), itens: JSON.parse(v.itens || "[]") })));
    });
});

app.get('/api/vendas/cliente/:cpf', (req, res) => {
    db.all("SELECT * FROM vendas WHERE cliente_cpf = ? ORDER BY id DESC", [req.params.cpf], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows.map(v => ({ ...v, detalhesPagamento: JSON.parse(v.detalhesPagamento || "[]"), itens: JSON.parse(v.itens || "[]") })));
    });
});

app.post('/api/vendas', (req, res) => {
    const { data, hora, totalBruto, desconto, totalLiquido, custoTaxas, pagamento, detalhesPagamento, itens, valorParaRelatorio, cliente_cpf, cliente_nome } = req.body;
    const sql = `INSERT INTO vendas (data, hora, totalBruto, desconto, totalLiquido, custoTaxas, pagamento, detalhesPagamento, itens, valorParaRelatorio, cliente_cpf, cliente_nome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [data, hora, totalBruto, desconto, totalLiquido, custoTaxas, pagamento, JSON.stringify(detalhesPagamento || []), JSON.stringify(itens || []), valorParaRelatorio, cliente_cpf || "", cliente_nome || ""], function(err) {
        if (err) return res.status(500).json({ erro: err.message }); res.json({ id: this.lastID });
    });
});

// ================= ROTAS DE FIADOS (CLIENTES) =================
app.get('/api/fiados', (req, res) => {
    db.all("SELECT * FROM fiados ORDER BY id ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows.map(f => ({ ...f, itens: JSON.parse(f.itens || "[]") })));
    });
});
app.post('/api/fiados', (req, res) => {
    const { cliente, cpf, telefone, endereco, dataCompra, dataPagamento, total, valorPago, itens, aniversario } = req.body;
    db.run(`INSERT INTO fiados (cliente, cpf, telefone, endereco, dataCompra, dataPagamento, total, valorPago, itens, aniversario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [cliente, cpf, telefone, endereco, dataCompra, dataPagamento, total, valorPago, JSON.stringify(itens || []), aniversario || ""], function(err) {
        if (err) return res.status(500).json({ erro: err.message }); res.status(201).json({ id: this.lastID });
    });
});
app.put('/api/fiados/:id', (req, res) => {
    const { cliente, cpf, telefone, endereco, dataCompra, dataPagamento, total, valorPago, itens, aniversario } = req.body;
    db.run(`UPDATE fiados SET cliente=?, cpf=?, telefone=?, endereco=?, dataCompra=?, dataPagamento=?, total=?, valorPago=?, itens=?, aniversario=? WHERE id=?`, 
    [cliente, cpf, telefone, endereco, dataCompra, dataPagamento, total, valorPago, JSON.stringify(itens || []), aniversario || "", req.params.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message }); res.json({ mensagem: "Atualizado!" });
    });
});
app.delete('/api/fiados/:id', (req, res) => {
    db.run(`DELETE FROM fiados WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ erro: err.message }); res.status(204).send();
    });
});

// ================= CONFIGURAÇÕES =================
app.get('/api/configuracoes_impressora', (req, res) => {
    db.get("SELECT * FROM configuracoes_impressora WHERE id = 1", [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message }); res.json(row || {}); 
    });
});
app.put('/api/configuracoes_impressora', (req, res) => {
    db.run(`UPDATE configuracoes_impressora SET nome_estabelecimento=?, cnpj=?, endereco=?, frase_rodape=? WHERE id=1`, 
    [req.body.nome, req.body.cnpj, req.body.endereco, req.body.rodape], function(err) {
        if (err) return res.status(500).json({ error: err.message }); res.json({ message: "Atualizado!" });
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`=========================================`);
});
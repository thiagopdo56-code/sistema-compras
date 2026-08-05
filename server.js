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

        db.run(`CREATE TABLE IF NOT EXISTS configuracoes_impressora (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_estabelecimento TEXT,
            cnpj TEXT,
            endereco TEXT,
            frase_rodape TEXT
        )`);

        db.get(`SELECT id FROM configuracoes_impressora WHERE id = 1`, (err, row) => {
            if (!row) {
                db.run(`INSERT INTO configuracoes_impressora (id, nome_estabelecimento, cnpj, endereco, frase_rodape) 
                        VALUES (1, 'Meu Mercado', '00.000.000/0000-00', 'Endereço Padrão', 'Obrigado pela preferência!')`);
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_barras TEXT,
            nome TEXT,
            categoria TEXT,
            preco REAL,
            estoque INTEGER,
            marca TEXT,
            unidade TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            hora TEXT,
            totalBruto REAL,
            desconto REAL,
            totalLiquido REAL,
            custoTaxas REAL,
            pagamento TEXT,
            detalhesPagamento TEXT,
            itens TEXT,
            valorParaRelatorio REAL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS fiados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente TEXT,
            cpf TEXT,
            telefone TEXT,
            endereco TEXT,
            dataCompra TEXT,
            dataPagamento TEXT,
            total REAL,
            valorPago REAL,
            itens TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS produtos_peso (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            codigo INTEGER,
            precoKg REAL
        )`, () => {
            db.run(`ALTER TABLE produtos_peso ADD COLUMN codigo INTEGER`, (err) => {});
            db.run(`ALTER TABLE produtos_peso ADD COLUMN precoKg REAL`, (err) => {});
        });
    }
});

app.get('/api/produtos', (req, res) => {
    db.all("SELECT * FROM produtos", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

app.post('/api/produtos', (req, res) => {
    const { codigo_barras, nome, categoria, preco, estoque, marca, unidade } = req.body;
    const sql = `INSERT INTO produtos (codigo_barras, nome, categoria, preco, estoque, marca, unidade) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [codigo_barras, nome, categoria, preco, estoque, marca, unidade], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Produto cadastrado!", id: this.lastID });
    });
});

app.put('/api/produtos/:id', (req, res) => {
    const { codigo_barras, nome, categoria, preco, estoque, marca, unidade } = req.body;
    const sql = `UPDATE produtos SET codigo_barras = ?, nome = ?, categoria = ?, preco = ?, estoque = ?, marca = ?, unidade = ? WHERE id = ?`;
    db.run(sql, [codigo_barras, nome, categoria, preco, estoque, marca, unidade, req.params.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Produto atualizado!" });
    });
});

app.delete('/api/produtos/:id', (req, res) => {
    db.run(`DELETE FROM produtos WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Produto excluído!" });
    });
});

app.get('/api/produtos/:id', (req, res) => {
    db.get("SELECT * FROM produtos WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.get('/api/produtos_peso', (req, res) => {
    db.all("SELECT * FROM produtos_peso", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

app.post('/api/produtos_peso', (req, res) => {
    const { nome, codigo, precoKg } = req.body;
    db.run(`INSERT INTO produtos_peso (nome, codigo, precoKg) VALUES (?, ?, ?)`, [nome, codigo, precoKg], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Produto de balança cadastrado!", id: this.lastID });
    });
});

app.put('/api/produtos_peso/:id', (req, res) => {
    const { nome, codigo, precoKg } = req.body;
    db.run(`UPDATE produtos_peso SET nome = ?, codigo = ?, precoKg = ? WHERE id = ?`, [nome, codigo, precoKg, req.params.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Produto de balança atualizado!" });
    });
});

app.delete('/api/produtos_peso/:id', (req, res) => {
    db.run(`DELETE FROM produtos_peso WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Produto por peso excluído!" });
    });
});

app.get('/api/vendas', (req, res) => {
    db.all("SELECT * FROM vendas ORDER BY id ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        try {
            const vendasFormatadas = rows.map(v => ({
                ...v,
                detalhesPagamento: JSON.parse(v.detalhesPagamento || "[]"),
                itens: JSON.parse(v.itens || "[]")
            }));
            res.json(vendasFormatadas);
        } catch (erroDeParse) {
            res.status(500).json({ erro: "Erro ao ler as vendas." });
        }
    });
});

app.get('/api/vendas/:id', (req, res) => {
    db.get("SELECT * FROM vendas WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ erro: err.message });
        if (!row) return res.status(404).json({ erro: "Venda não encontrada" });
        try {
            row.detalhesPagamento = JSON.parse(row.detalhesPagamento || "[]");
            row.itens = JSON.parse(row.itens || "[]");
            res.json(row);
        } catch (e) { res.status(500).json({ erro: "Erro ao parsear dados da venda." }); }
    });
});

app.post('/api/vendas', (req, res) => {
    const { data, hora, totalBruto, desconto, totalLiquido, custoTaxas, pagamento, detalhesPagamento, itens, valorParaRelatorio } = req.body;
    const sql = `INSERT INTO vendas (data, hora, totalBruto, desconto, totalLiquido, custoTaxas, pagamento, detalhesPagamento, itens, valorParaRelatorio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [data, hora, totalBruto, desconto, totalLiquido, custoTaxas, pagamento, JSON.stringify(detalhesPagamento || []), JSON.stringify(itens || []), valorParaRelatorio], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Venda registrada!", id: this.lastID });
    });
});

app.put('/api/vendas/:id', (req, res) => {
    const { data, hora, totalBruto, desconto, totalLiquido, custoTaxas, pagamento, detalhesPagamento, itens, valorParaRelatorio } = req.body;
    const sql = `UPDATE vendas SET data=?, hora=?, totalBruto=?, desconto=?, totalLiquido=?, custoTaxas=?, pagamento=?, detalhesPagamento=?, itens=?, valorParaRelatorio=? WHERE id=?`;
    db.run(sql, [data, hora, totalBruto, desconto, totalLiquido, custoTaxas, pagamento, JSON.stringify(detalhesPagamento || []), JSON.stringify(itens || []), valorParaRelatorio, req.params.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Venda atualizada com sucesso!" });
    });
});

app.delete('/api/vendas/:id', (req, res) => {
    db.run(`DELETE FROM vendas WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.status(204).send();
    });
});

app.get('/api/fiados', (req, res) => {
    db.all("SELECT * FROM fiados ORDER BY id ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        try {
            const fiadosFormatados = rows.map(f => ({
                ...f,
                itens: JSON.parse(f.itens || "[]")
            }));
            res.json(fiadosFormatados);
        } catch (erroDeParse) {
            res.status(500).json({ erro: "Erro ao ler fiados." });
        }
    });
});

app.get('/api/fiados/:id', (req, res) => {
    db.get("SELECT * FROM fiados WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ erro: err.message });
        if (!row) return res.status(404).json({ erro: "Conta não encontrada." });
        try {
            row.itens = JSON.parse(row.itens || "[]");
            res.json(row);
        } catch (e) {
            res.status(500).json({ erro: "Erro ao parsear itens." });
        }
    });
});

app.post('/api/fiados', (req, res) => {
    const { cliente, cpf, telefone, endereco, dataCompra, dataPagamento, total, valorPago, itens } = req.body;
    const sql = `INSERT INTO fiados (cliente, cpf, telefone, endereco, dataCompra, dataPagamento, total, valorPago, itens) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [cliente, cpf, telefone, endereco, dataCompra, dataPagamento, total, valorPago, JSON.stringify(itens || [])], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.status(201).json({ mensagem: "Conta registrada!", id: this.lastID });
    });
});

app.put('/api/fiados/:id', (req, res) => {
    const { cliente, cpf, telefone, endereco, dataCompra, dataPagamento, total, valorPago, itens } = req.body;
    const sql = `UPDATE fiados SET cliente = ?, cpf = ?, telefone = ?, endereco = ?, dataCompra = ?, dataPagamento = ?, total = ?, valorPago = ?, itens = ? WHERE id = ?`;
    db.run(sql, [cliente, cpf, telefone, endereco, dataCompra, dataPagamento, total, valorPago, JSON.stringify(itens || []), req.params.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Conta atualizada!" });
    });
});

app.delete('/api/fiados/:id', (req, res) => {
    db.run(`DELETE FROM fiados WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.status(204).send();
    });
});

app.get('/api/configuracoes_impressora', (req, res) => {
    db.get("SELECT * FROM configuracoes_impressora WHERE id = 1", [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || {}); 
    });
});

app.put('/api/configuracoes_impressora', (req, res) => {
    const { nome, cnpj, endereco, rodape } = req.body;
    const sql = `UPDATE configuracoes_impressora SET nome_estabelecimento = ?, cnpj = ?, endereco = ?, frase_rodape = ? WHERE id = 1`;
    db.run(sql, [nome, cnpj, endereco, rodape], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Configurações atualizadas!" });
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Servidor rodando! Abra seu navegador em:`);
    console.log(`http://localhost:${PORT}`);
    console.log(`=========================================`);
});
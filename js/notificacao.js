// js/notificacao.js

document.addEventListener("DOMContentLoaded", () => {
    // Aguarda um pequeno delay para garantir que o banco carregou
    setTimeout(calcularNotificacoes, 500);
});

function abrirModalNotificacoes() {
    const modal = document.getElementById('modal-notificacoes');
    if (modal) {
        modal.classList.add('active');
        
        // Zera e esconde a bolinha de notificação
        const contador = document.getElementById('contador-notificacoes');
        if(contador) {
            contador.style.display = 'none';
            contador.innerText = '0';
        }

        // Salva que o usuário já leu (Isso pode ficar no localStorage pois é só o estado visual do app)
        localStorage.setItem("ultimaLeituraNotificacoes", Date.now());

        // Carrega as listas do modal
        carregarListasNotificacao();
    }
}

function fecharModalNotificacoes() {
    const modal = document.getElementById('modal-notificacoes');
    if (modal) modal.classList.remove('active');
}

async function calcularNotificacoes() {
    let totalNovasNotificacoes = 0;
    const ultimaLeitura = localStorage.getItem("ultimaLeituraNotificacoes") || 0;

    // 1. Busca os Produtos do Banco de Dados
    let produtos = [];
    try {
        const resp = await fetch('http://localhost:3000/api/produtos');
        if (resp.ok) produtos = await resp.json();
    } catch (e) { console.warn("API de produtos offline na notificação."); }

    // Conta quantos estão com estoque baixo (Sempre avisa se estiver baixo)
    const produtosBaixoEstoque = produtos.filter(p => p.estoque <= 5);
    totalNovasNotificacoes += produtosBaixoEstoque.length;

    // 2. Busca Vendas do Banco de Dados (em vez de usar o localStorage)
    let vendas = [];
    try {
        const respVendas = await fetch('http://localhost:3000/api/vendas');
        if (respVendas.ok) vendas = await respVendas.json();
    } catch (e) { console.warn("API de vendas offline na notificação."); }

    const qtdVendasAnterior = parseInt(localStorage.getItem("qtdVendasSalvas") || "0");
    if (vendas.length > qtdVendasAnterior) {
        totalNovasNotificacoes += (vendas.length - qtdVendasAnterior);
    }
    localStorage.setItem("qtdVendasSalvas", vendas.length);

    // Atualiza a bolinha vermelha
    const contador = document.getElementById('contador-notificacoes');
    if (contador && totalNovasNotificacoes > 0) {
        contador.style.display = 'flex';
        contador.innerText = totalNovasNotificacoes;
    }
}

async function carregarListasNotificacao() {
    // ================= 1. CARREGAR ESTOQUE BAIXO =================
    let produtos = [];
    try {
        const resp = await fetch('http://localhost:3000/api/produtos');
        if (resp.ok) produtos = await resp.json();
    } catch (e) {}

    const listaEstoque = document.getElementById('lista-notif-estoque');
    const estoqueBaixo = produtos.filter(p => p.estoque <= 5);
    
    listaEstoque.innerHTML = "";
    if (estoqueBaixo.length === 0) {
        listaEstoque.innerHTML = `<div class="notif-vazia"><i class="fa-solid fa-check"></i> Tudo OK no estoque!</div>`;
    } else {
        estoqueBaixo.forEach(p => {
            listaEstoque.innerHTML += `
                <div class="notif-item critico">
                    <strong>${p.nome}</strong>
                    <span>Restam: ${p.estoque} ${p.unidade}</span>
                </div>`;
        });
    }

    // ================= 2. CARREGAR ÚLTIMAS VENDAS =================
    let vendas = [];
    try {
        const respVendas = await fetch('http://localhost:3000/api/vendas');
        if (respVendas.ok) vendas = await respVendas.json();
    } catch (e) {}

    const listaVendas = document.getElementById('lista-notif-vendas');
    const ultimasVendas = vendas.slice().reverse().slice(0, 5); // Pega as 5 últimas

    listaVendas.innerHTML = "";
    if (ultimasVendas.length === 0) {
        listaVendas.innerHTML = `<div class="notif-vazia">Nenhuma venda hoje.</div>`;
    } else {
        ultimasVendas.forEach(v => {
            listaVendas.innerHTML += `
                <div class="notif-item sucesso">
                    <strong>Venda às ${v.hora || v.data}</strong>
                    <span>Total: R$ ${parseFloat(v.totalComDesconto || v.total || 0).toFixed(2).replace('.', ',')}</span>
                    <small>Pgto: ${v.pagamento || 'N/A'}</small>
                </div>`;
        });
    }

    // ================= 3. CARREGAR PRODUTOS RECENTES =================
    const listaNovos = document.getElementById('lista-notif-produtos');
    const novosProdutos = produtos.slice().reverse().slice(0, 5); // Últimos 5 produtos cadastrados

    listaNovos.innerHTML = "";
    if (novosProdutos.length === 0) {
        listaNovos.innerHTML = `<div class="notif-vazia">Nenhum produto cadastrado.</div>`;
    } else {
        novosProdutos.forEach(p => {
            listaNovos.innerHTML += `
                <div class="notif-item info">
                    <strong>${p.nome}</strong>
                    <span>R$ ${parseFloat(p.preco || 0).toFixed(2).replace('.', ',')}</span>
                </div>`;
        });
    }
}
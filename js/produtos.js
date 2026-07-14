// js/produtos.js

let produtoEditandoId = null;
let produtosBancoCache = []; 
let vendasDiariasCache = []; 
let chartInstancia = null;   

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const respostaVendas = await fetch("http://localhost:3000/api/vendas");
        if (respostaVendas.ok) {
            vendasDiariasCache = await respostaVendas.json();
        }
    } catch (e) {
        console.warn("Aviso: Não foi possível carregar as estatísticas de vendas do servidor.");
    }

    await carregarProdutos();

    document.getElementById("formCadastro").addEventListener("submit", salvarProduto);
    
    const inputPesquisa = document.getElementById("filtro-pesquisa");
    const selectOrdem = document.getElementById("filtro-ordem");
    
    if (inputPesquisa) inputPesquisa.addEventListener("input", aplicarFiltrosEOrdenacao);
    if (selectOrdem) selectOrdem.addEventListener("change", aplicarFiltrosEOrdenacao);

    document.getElementById("cad-barras").addEventListener("keypress", (evento) => {
        if (evento.key === "Enter") {
            evento.preventDefault();
            document.getElementById("cad-nome").focus();
        }
    });

    // Chama o sistema unificado de notificações assim que a tela abre
    calcularNotificacoes();
});

// =====================================================================
// LÓGICA DE ESTATÍSTICAS
// =====================================================================
function calcularEstatisticasDoProduto(codigo_barras) {
    let totalVendido = 0;
    let historicoDias = {}; 

    vendasDiariasCache.forEach(venda => {
        if (!venda.itens) return; 
        venda.itens.forEach(item => {
            if (item.codigo_barras === codigo_barras) {
                totalVendido += item.quantidade;
                if (!historicoDias[venda.data]) {
                    historicoDias[venda.data] = 0;
                }
                historicoDias[venda.data] += item.quantidade;
            }
        });
    });

    return { totalVendido, historicoDias };
}

// =====================================================================
// CARREGAR E RENDERIZAR TABELA COM FILTROS
// =====================================================================
async function carregarProdutos() {
    try {
        const resposta = await fetch("http://localhost:3000/api/produtos");
        produtosBancoCache = await resposta.json();
        
        produtosBancoCache.forEach(prod => {
            const stats = calcularEstatisticasDoProduto(prod.codigo_barras);
            prod.qtdVendidaHistorico = stats.totalVendido;
        });

        aplicarFiltrosEOrdenacao(); 

    } catch (erro) {
        console.error("Erro ao carregar produtos:", erro);
        document.getElementById("tabela-produtos-body").innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color:#ef4444; padding: 20px 0;">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    Erro ao conectar com o banco de dados. O servidor Node está rodando?
                </td>
            </tr>`;
    }
}

function aplicarFiltrosEOrdenacao() {
    const inputPesquisa = document.getElementById("filtro-pesquisa");
    const selectOrdem = document.getElementById("filtro-ordem");
    
    if (!inputPesquisa || !selectOrdem) return;

    const termoBusca = inputPesquisa.value.toLowerCase();
    const ordem = selectOrdem.value;

    let produtosFiltrados = produtosBancoCache.filter(prod => {
        return prod.nome.toLowerCase().includes(termoBusca) || 
               prod.codigo_barras.includes(termoBusca);
    });

    if (ordem === "az") {
        produtosFiltrados.sort((a, b) => a.nome.localeCompare(b.nome));
    } else if (ordem === "mais_vendidos") {
        produtosFiltrados.sort((a, b) => b.qtdVendidaHistorico - a.qtdVendidaHistorico);
    } else if (ordem === "menos_vendidos") {
        produtosFiltrados.sort((a, b) => a.qtdVendidaHistorico - b.qtdVendidaHistorico);
    } else {
        produtosFiltrados.sort((a, b) => a.id - b.id);
    }

    renderizarTabelaHTML(produtosFiltrados);
}

function renderizarTabelaHTML(produtosParaMostrar) {
    const tbody = document.getElementById("tabela-produtos-body");
    tbody.innerHTML = "";

    if (produtosParaMostrar.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color:#94a3b8; padding: 30px 0;">
                    <i class="fa-solid fa-box-open" style="font-size:2rem; display:block; margin-bottom:8px;"></i>
                    Nenhum produto encontrado.
                </td>
            </tr>`;
        return;
    }

    produtosParaMostrar.forEach(prod => {
        const precoFormatado = parseFloat(prod.preco).toFixed(2).replace(".", ",");
        
        tbody.innerHTML += `
            <tr>
                <td>${prod.codigo_barras}</td>
                <td><strong>${prod.nome}</strong></td>
                <td>${prod.marca}</td>
                <td>${prod.categoria}</td>
                <td>R$ ${precoFormatado}</td>
                <td>${prod.estoque} ${prod.unidade}</td>
                <td class="acoes-cell">
                    <button class="btn-icon chart" onclick="abrirGraficoProduto('${prod.codigo_barras}', '${prod.nome.replace(/'/g, "\\'")}')" title="Ver Estatísticas">
                        <i class="fa-solid fa-chart-simple"></i>
                    </button>
                    <button class="btn-icon edit" onclick="abrirModalEditar(${prod.id})" title="Editar produto">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-icon delete" onclick="abrirModalExcluir(${prod.id}, '${prod.nome.replace(/'/g, "\\'")}')" title="Excluir produto">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    });
}

// =====================================================================
// ABRIR GRÁFICO (NOVA FUNCIONALIDADE)
// =====================================================================
function abrirGraficoProduto(codigo_barras, nome) {
    document.getElementById("grafico-nome-produto").innerText = nome;
    
    const stats = calcularEstatisticasDoProduto(codigo_barras);
    
    const datasVenda = Object.keys(stats.historicoDias);
    datasVenda.sort((a, b) => {
        const [da, ma, ya] = a.split('/');
        const [db, mb, yb] = b.split('/');
        return new Date(ya, ma-1, da) - new Date(yb, mb-1, db);
    });

    const labels = [];
    const dadosGrafico = [];

    datasVenda.forEach(data => {
        labels.push(data);
        dadosGrafico.push(stats.historicoDias[data]);
    });

    document.getElementById("stat-total").innerText = `${stats.totalVendido} un`;
    
    let media = 0;
    if (datasVenda.length > 0) {
        media = (stats.totalVendido / datasVenda.length).toFixed(1);
    }
    document.getElementById("stat-media").innerText = `${media} un/dia`;

    let iconeTendencia = document.getElementById("icone-tendencia");
    let txtTendencia = document.getElementById("stat-tendencia");
    
    if (dadosGrafico.length > 0) {
        const ultimoDia = dadosGrafico[dadosGrafico.length - 1];
        if (ultimoDia > media) {
            iconeTendencia.className = "fa-solid fa-arrow-trend-up";
            iconeTendencia.style.color = "#10b981"; 
            txtTendencia.innerText = "Em Alta";
        } else if (ultimoDia < media) {
            iconeTendencia.className = "fa-solid fa-arrow-trend-down";
            iconeTendencia.style.color = "#ef4444"; 
            txtTendencia.innerText = "Em Queda";
        } else {
            iconeTendencia.className = "fa-solid fa-minus";
            iconeTendencia.style.color = "#f59e0b"; 
            txtTendencia.innerText = "Estável";
        }
    } else {
        iconeTendencia.className = "fa-solid fa-minus";
        iconeTendencia.style.color = "#94a3b8"; 
        txtTendencia.innerText = "Sem Dados";
    }

    const ctx = document.getElementById('graficoCanvas').getContext('2d');
    
    if (chartInstancia) {
        chartInstancia.destroy();
    }

    chartInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Unidades Vendidas',
                data: dadosGrafico,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#2563eb'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
            plugins: { legend: { display: false } }
        }
    });

    abrirModal("modal-grafico");
}

// =====================================================================
// MODAIS DE PRODUTO E EDIÇÃO
// =====================================================================
function abrirModalProduto() {
    produtoEditandoId = null;
    document.getElementById("titulo-modal-produto").innerHTML = '<i class="fa-solid fa-plus-circle"></i> Cadastrar Produto';
    document.getElementById("formCadastro").reset();
    abrirModal("modal-produto");
    document.getElementById("cad-barras").focus();
}

async function abrirModalEditar(id) {
    try {
        const resposta = await fetch(`http://localhost:3000/api/produtos/${id}`);
        if (!resposta.ok) {
            alert("Não foi possível carregar os dados do produto.");
            return;
        }

        const prod = await resposta.json();
        produtoEditandoId = id;

        document.getElementById("titulo-modal-produto").innerHTML = '<i class="fa-solid fa-pen"></i> Editar Produto';
        document.getElementById("cad-barras").value   = prod.codigo_barras;
        document.getElementById("cad-nome").value     = prod.nome;
        document.getElementById("cad-categoria").value = prod.categoria;
        
        let precoAjustado = prod.preco;
        if (typeof precoAjustado === 'string') precoAjustado = precoAjustado.replace(',', '.');
        
        document.getElementById("cad-preco").value    = parseFloat(precoAjustado).toFixed(2);
        document.getElementById("cad-estoque").value  = prod.estoque;
        document.getElementById("cad-marca").value    = prod.marca;
        document.getElementById("cad-unidade").value  = prod.unidade;

        abrirModal("modal-produto");
        document.getElementById("cad-nome").focus();
    } catch (erro) {
        console.error("Erro ao buscar produto para edição:", erro);
        alert("Erro de conexão ao tentar editar. Verifique se o servidor está rodando.");
    }
}

async function salvarProduto(evento) {
    evento.preventDefault();

    let precoStr = document.getElementById("cad-preco").value.replace(',', '.');

    const produto = {
        codigo_barras: document.getElementById("cad-barras").value.trim(),
        nome:          document.getElementById("cad-nome").value.trim(),
        categoria:     document.getElementById("cad-categoria").value.trim(),
        preco:         parseFloat(precoStr),
        estoque:       parseInt(document.getElementById("cad-estoque").value),
        marca:         document.getElementById("cad-marca").value.trim(),
        unidade:       document.getElementById("cad-unidade").value
    };

    const url    = produtoEditandoId ? `http://localhost:3000/api/produtos/${produtoEditandoId}` : "http://localhost:3000/api/produtos";
    const metodo = produtoEditandoId ? "PUT" : "POST";

    try {
        const resposta = await fetch(url, {
            method: metodo,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(produto)
        });

        if (resposta.ok) {
            fecharModal("modal-produto");
            carregarProdutos();
            calcularNotificacoes(); // Atualiza o sino na hora
        } else {
            const dados = await resposta.json();
            alert("Erro ao salvar: " + (dados.erro || "Erro desconhecido."));
        }
    } catch (erro) {
        console.error("Erro ao salvar produto:", erro);
        alert("Erro de conexão. Verifique se o servidor Node.js está ligado.");
    }
}

function abrirModalExcluir(id, nome) {
    document.getElementById("texto-confirmacao-exclusao").innerHTML = `Tem certeza que deseja excluir o produto <strong>"${nome}"</strong>?<br><small style="color:#94a3b8;">Esta ação não pode ser desfeita.</small>`;

    const btnConfirmar = document.getElementById("btn-confirmar-exclusao");
    btnConfirmar.replaceWith(btnConfirmar.cloneNode(true));
    document.getElementById("btn-confirmar-exclusao").addEventListener("click", () => {
        excluirProduto(id);
    });

    abrirModal("modal-excluir");
}

async function excluirProduto(id) {
    try {
        const resposta = await fetch(`http://localhost:3000/api/produtos/${id}`, { method: "DELETE" });
        if (resposta.ok) {
            fecharModal("modal-excluir");
            carregarProdutos(); 
            calcularNotificacoes(); // Atualiza o sino
        } else {
            const dados = await resposta.json();
            alert("Erro ao excluir: " + (dados.erro || "Erro desconhecido."));
        }
    } catch (erro) {
        console.error("Erro ao excluir produto:", erro);
        alert("Erro de conexão ao tentar excluir.");
    }
}

// =====================================================================
// UTILITÁRIOS DE MODAL
// =====================================================================
function abrirModal(idModal) {
    document.getElementById(idModal).classList.add("active");
    document.body.style.overflow = "hidden";
}

function fecharModal(idModal) {
    document.getElementById(idModal).classList.remove("active");
    document.body.style.overflow = "";
}

document.addEventListener("click", (evento) => {
    if (evento.target.classList.contains("modal-overlay")) {
        evento.target.classList.remove("active");
        document.body.style.overflow = "";
    }
});

document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
        document.querySelectorAll(".modal-overlay.active").forEach(modal => {
            modal.classList.remove("active");
        });
        document.body.style.overflow = "";
    }
});

/* =====================================================================
   SISTEMA DE NOTIFICAÇÕES (100% VIA API)
===================================================================== */
async function calcularNotificacoes() {
    let prods = [];
    try {
        const resP = await fetch('http://localhost:3000/api/produtos');
        if (resP.ok) prods = await resP.json();
    } catch(e) {}
    
    let vendasAPI = [];
    try {
        const resV = await fetch('http://localhost:3000/api/vendas');
        if (resV.ok) vendasAPI = await resV.json();
    } catch(e) {}

    let contasAPI = [];
    try {
        const resC = await fetch('http://localhost:3000/api/fiados');
        if (resC.ok) contasAPI = await resC.json();
    } catch(e) {}

    const produtosCriticos = prods.filter(p => (parseFloat(p.estoque) || 0) <= 5);
    const ultimasVendas = vendasAPI.slice(-10).reverse(); 

    const totalBadge = produtosCriticos.length + contasAPI.length;
    const badge = document.getElementById("contador-notificacoes");
    if (badge) {
        if (totalBadge > 0) { badge.innerText = totalBadge; badge.style.display = "block"; } 
        else { badge.style.display = "none"; }
    }

    _renderListaEstoque(produtosCriticos);
    _renderListaVendas(ultimasVendas);
    _renderListaContas(contasAPI);
}

function _renderListaEstoque(produtos) {
    const lista = document.getElementById("lista-notif-estoque");
    if (!lista) return;
    lista.innerHTML = "";
    if (produtos.length === 0) return lista.innerHTML = `<p class="notif-vazia"><i class="fa-solid fa-check-circle"></i> Tudo em ordem!</p>`;

    produtos.forEach(p => {
        lista.innerHTML += `
            <div class="notif-item perigo">
                <p><i class="fa-solid fa-triangle-exclamation" style="color:#ef4444; margin-right:5px;"></i>${p.nome || 'Produto'}</p>
                <small>Restam apenas <strong>${p.estoque || 0} ${p.unidade || 'UN'}</strong></small>
            </div>
        `;
    });
}

function _renderListaVendas(vendas) {
    const lista = document.getElementById("lista-notif-vendas");
    if (!lista) return;
    lista.innerHTML = "";
    if (vendas.length === 0) return lista.innerHTML = `<p class="notif-vazia">Nenhuma venda registrada.</p>`;

    vendas.forEach(v => {
        const total = parseFloat(v.totalLiquido || v.totalBruto || v.valorParaRelatorio || 0);
        lista.innerHTML += `
            <div class="notif-item sucesso">
                <p><i class="fa-solid fa-circle-check" style="color:#10b981; margin-right:5px;"></i>R$ ${total.toFixed(2).replace('.', ',')}</p>
                <small>${v.data || ''} às ${v.hora || ''} — ${v.pagamento}</small>
            </div>
        `;
    });
}

function _renderListaContas(contas) {
    const lista = document.getElementById("lista-notif-produtos"); 
    if (!lista) return;
    lista.innerHTML = "";
    if (contas.length === 0) return lista.innerHTML = `<p class="notif-vazia"><i class="fa-solid fa-check-circle"></i> Sem contas em aberto!</p>`;

    contas.forEach(c => {
        let devedor = c.total - (c.valorPago || 0);
        lista.innerHTML += `
            <div class="notif-item info">
                <p><i class="fa-solid fa-book-open" style="color:#3b82f6; margin-right:5px;"></i>${c.cliente}</p>
                <small>Falta: R$ ${devedor.toFixed(2).replace('.', ',')} — Vence: ${c.dataPagamento}</small>
            </div>
        `;
    });
}

function abrirModalNotificacoes() {
    calcularNotificacoes();
    abrirModal("modal-notificacoes");
    const badge = document.getElementById("contador-notificacoes");
    if (badge) { badge.innerText = "0"; badge.style.display = "none"; }
}

function fecharModalNotificacoes() {
    fecharModal("modal-notificacoes");
}
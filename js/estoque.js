// js/estoque.js

let todosProdutos = [];
let produtoEditandoId = null;
let graficoVendasObj = null; 
let produtoGraficoAtual = null;
let vendasGlobais = []; 

document.addEventListener("DOMContentLoaded", async () => {
    configurarMascaras();

    // Busca vendas para o gráfico
    try {
        const respVendas = await fetch("http://localhost:3000/api/vendas");
        if (respVendas.ok) vendasGlobais = await respVendas.json();
    } catch (e) {
        vendasGlobais = JSON.parse(localStorage.getItem("vendasDiarias")) || [];
    }

    const campoFiltro = document.getElementById("filtro-texto");
    if(campoFiltro) campoFiltro.focus();

    await carregarBanco();

    if(campoFiltro) campoFiltro.addEventListener("input", aplicarFiltros);
    const filtroCat = document.getElementById("filtro-categoria");
    if(filtroCat) filtroCat.addEventListener("change", aplicarFiltros);

    const formCad = document.getElementById("formCadastro");
    if(formCad) formCad.addEventListener("submit", salvarProduto);

    // Leitor de Código na Busca
    if(campoFiltro) {
        campoFiltro.addEventListener("keypress", function (evento) {
            if (evento.key === "Enter") {
                evento.preventDefault();
                const termo = campoFiltro.value.trim().replace(/^0+/, ''); // Limpa zeros
                const soNumeros = /^\d+$/.test(termo);
                const encontrado = todosProdutos.find(p =>
                    p.codigo_barras === termo ||
                    (p.nome && p.nome.toLowerCase().includes(termo.toLowerCase()))
                );
                
                if (termo && !encontrado && soNumeros) {
                    abrirModalProduto();
                    document.getElementById("cad-barras").value = termo;
                } else {
                    aplicarFiltros();
                }
            }
        });
    }

    // Tecla Enter no Cadastro
    const cadBarras = document.getElementById("cad-barras");
    if(cadBarras) {
        cadBarras.addEventListener("keypress", (e) => {
            if (e.key === "Enter") { e.preventDefault(); document.getElementById("cad-categoria").focus(); }
        });
    }

    // Datas do gráfico
    const elDataIni = document.getElementById("grafico-data-ini");
    const elDataFim = document.getElementById("grafico-data-fim");
    if(elDataIni) elDataIni.addEventListener("change", atualizarGrafico);
    if(elDataFim) elDataFim.addEventListener("change", atualizarGrafico);

    // ATALHOS GLOBAIS DE TECLADO
    document.addEventListener("keydown", (e) => {
        const modalAtivo = document.querySelector('.modal-overlay.active');
        
        if (e.key === "Escape") {
            if (modalAtivo) {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
                if(document.getElementById("filtro-texto")) document.getElementById("filtro-texto").focus();
            } else {
                window.location.href = "index.html"; // Volta pro Index se não tiver modal
            }
        }

        if (e.key === "F2" && !modalAtivo) {
            e.preventDefault();
            abrirModalProduto();
        }
    });
});

/* ================= MÁSCARAS E CARREGAMENTO ================= */
function configurarMascaras() {
    const numeroConfig = { mask: Number, scale: 0, signed: false, thousandsSeparator: '' };
    const cadBarras = document.getElementById('cad-barras');
    if(cadBarras) IMask(cadBarras, numeroConfig);
}

async function carregarBanco() {
    try {
        const resposta = await fetch('http://localhost:3000/api/produtos');
        if (!resposta.ok) throw new Error("Falha na API");
        todosProdutos = await resposta.json();
    } catch (erro) {
        todosProdutos = JSON.parse(localStorage.getItem("produtosCadastrados")) || [];
    }
    preencherFiltroEDatalists();
    aplicarFiltros();
}

function preencherFiltroEDatalists() {
    const select = document.getElementById("filtro-categoria");
    if(!select) return;
    
    const categoriasUnicas = [...new Set(todosProdutos.map(p => p.categoria).filter(Boolean))];
    select.innerHTML = `<option value="TODAS">Todas as Categorias</option>`;
    
    const datalistCat = document.getElementById("lista-categorias");
    const datalistMarca = document.getElementById("lista-marcas");
    const marcasUnicas = [...new Set(todosProdutos.map(p => p.marca).filter(Boolean))];
    
    if(datalistCat) datalistCat.innerHTML = "";
    if(datalistMarca) datalistMarca.innerHTML = "";

    categoriasUnicas.forEach(cat => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
        if(datalistCat) datalistCat.innerHTML += `<option value="${cat}">`;
    });

    marcasUnicas.forEach(marca => {
        if(datalistMarca) datalistMarca.innerHTML += `<option value="${marca}">`;
    });
}

function aplicarFiltros() {
    const elBusca = document.getElementById("filtro-texto");
    const elCategoria = document.getElementById("filtro-categoria");
    if(!elBusca || !elCategoria) return;

    const textoBusca = elBusca.value.toLowerCase().trim();
    const categoriaSelecionada = elCategoria.value;

    let produtosFiltrados = todosProdutos.filter(produto => {
        const bateCategoria = categoriaSelecionada === "TODAS" || produto.categoria === categoriaSelecionada;
        let bateTexto = false;
        const codigoSeguro = produto.codigo_barras ? String(produto.codigo_barras).toLowerCase() : "";
        if (codigoSeguro.includes(textoBusca)) bateTexto = true;
        
        if (!bateTexto && produto.variacoes) {
            bateTexto = produto.variacoes.some(v => v.nome && v.nome.toLowerCase().includes(textoBusca));
        } else if (!bateTexto && produto.nome) {
            bateTexto = produto.nome.toLowerCase().includes(textoBusca);
        }
        return bateCategoria && bateTexto;
    });

    renderizarTabela(produtosFiltrados);
}

function renderizarTabela(produtos) {
    const tbody = document.getElementById("tabela-estoque");
    if(!tbody) return;
    tbody.innerHTML = "";

    if (produtos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color: #0055A4; font-weight:bold;"><i class="fa-solid fa-box-open" style="font-size: 2rem; margin-bottom: 8px; display: block;"></i> NENHUM PRODUTO ENCONTRADO.</td></tr>`;
        return;
    }

    produtos.forEach(produto => {
        let variacoes = produto.variacoes || [{ nome: produto.nome || 'Produto', preco: produto.preco, estoque: produto.estoque }];
        let estoqueAtual = variacoes.reduce((acc, v) => acc + (parseFloat(v.estoque) || 0), 0);
        let precoFormatado = variacoes.length > 1 ? "Múltiplos" : `R$ ${parseFloat(variacoes[0].preco || 0).toFixed(2).replace('.', ',')}`;

        const estaEsgotado = estoqueAtual <= 0;
        const estaAcabando = estoqueAtual > 0 && estoqueAtual <= 5;

        let classeLinha = estaEsgotado ? "linha-sem-estoque" : (estaAcabando ? "linha-critica" : "");
        let badgeStatus = estaEsgotado ? `<span class="status-esgotado">ESGOTADO</span>` : (estaAcabando ? `<span class="status-repor">REPOR!</span>` : `<span class="status-ok">OK</span>`);

        const idProduto = produto.id || `'${produto.codigo_barras}'`;
        let nomeExibicao = variacoes.length === 1 ? `<strong>${variacoes[0].nome}</strong>` : `<div style="display: flex; flex-direction: column; gap: 4px;">`;
        if (variacoes.length > 1) {
            variacoes.forEach(v => {
                let precoV = parseFloat(v.preco).toFixed(2).replace('.', ',');
                nomeExibicao += `<span style="font-size: 0.9rem;"><strong>${v.nome}</strong> <span style="color:#0055A4; font-size:0.8rem;">(R$ ${precoV} | Est: ${v.estoque})</span></span>`;
            });
            nomeExibicao += `</div>`;
        }

        tbody.innerHTML += `
            <tr class="${classeLinha}">
                <td>${produto.codigo_barras || '-'}</td>
                <td>${nomeExibicao}</td>
                <td>${produto.marca || '-'}</td>
                <td>${produto.categoria || '-'}</td>
                <td>${precoFormatado}</td>
                <td style="font-size: 1.1rem; font-weight: 900;">${estoqueAtual} <span style="font-size: 0.8rem; font-weight: 600; color: #0055A4;">${produto.unidade || 'UN'}</span></td>
                <td>${badgeStatus}</td>
                <td class="acoes-cell">
                    <button type="button" class="btn-icon" onclick="abrirModalGrafico(${idProduto})" title="Estatísticas"><i class="fa-solid fa-chart-line"></i></button>
                    <button type="button" class="btn-icon" onclick="duplicarProduto(${idProduto})" title="Duplicar"><i class="fa-solid fa-copy"></i></button>
                    <button type="button" class="btn-icon" onclick="abrirEditarProduto(${idProduto})" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button type="button" class="btn-icon delete" onclick="abrirModalExcluir(${idProduto}, '${(produto.nome || 'Este item').replace(/'/g, "\\'")}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

/* ================= LÓGICA DE CADASTRO/EDIÇÃO ================= */
function adicionarLinhaVariacao(nome = '', preco = '', estoque = '') {
    const container = document.getElementById("container-variacoes");
    if(!container) return;

    const div = document.createElement("div");
    div.style.cssText = "display: flex; gap: 10px; align-items: end; background: #fff; padding: 12px; border: 2px solid #b3d4ff; border-radius: 6px; margin-bottom: 5px;";
    
    div.innerHTML = `
        <div style="flex: 2;" class="input-pdv-config">
            <label style="margin-bottom: -5px;">Nome/Tamanho *</label>
            <input type="text" class="var-nome" value="${nome}" required placeholder="Ex: Lata 350ml">
        </div>
        <div style="flex: 1;" class="input-pdv-config">
            <label style="margin-bottom: -5px;">Preço (R$)*</label>
            <input type="text" class="var-preco" value="${preco}" required placeholder="0,00" style="color:#10b981;">
        </div>
        <div style="flex: 1;" class="input-pdv-config">
            <label style="margin-bottom: -5px;">Estoque*</label>
            <input type="number" class="var-estoque" value="${estoque}" required placeholder="0">
        </div>
        <button type="button" onclick="if(document.querySelectorAll('#container-variacoes > div').length > 1) { this.parentElement.remove(); }" style="padding: 12px 15px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; height: 48px;"><i class="fa-solid fa-trash"></i></button>
    `;
    
    container.appendChild(div);
    IMask(div.querySelector('.var-preco'), { mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, normalizeZeros: true, radix: ',' });
}

function abrirModalProduto() {
    produtoEditandoId = null;
    document.getElementById("titulo-modal-produto").innerHTML = '<i class="fa-solid fa-plus-circle"></i> CADASTRAR PRODUTO';
    document.getElementById("formCadastro").reset();
    document.getElementById("container-variacoes").innerHTML = "";
    adicionarLinhaVariacao();
    abrirModal("modal-produto");
    setTimeout(() => document.getElementById("cad-barras").focus(), 100);
}

function abrirEditarProduto(idOuCodigo) {
    const produto = todosProdutos.find(p => p.id === idOuCodigo || p.codigo_barras === idOuCodigo);
    if (!produto) return;

    produtoEditandoId = idOuCodigo;
    document.getElementById("titulo-modal-produto").innerHTML = '<i class="fa-solid fa-pen"></i> EDITAR PRODUTO';
    document.getElementById("cad-barras").value  = produto.codigo_barras || '';
    document.getElementById("cad-categoria").value = produto.categoria || '';
    document.getElementById("cad-marca").value   = produto.marca || '';
    document.getElementById("cad-unidade").value = produto.unidade || 'UN';

    document.getElementById("container-variacoes").innerHTML = "";
    let variacoes = produto.variacoes || [{ nome: produto.nome || '', preco: produto.preco, estoque: produto.estoque }];
    variacoes.forEach(v => {
        let pStr = v.preco ? parseFloat(v.preco).toFixed(2).replace('.', ',') : '';
        adicionarLinhaVariacao(v.nome, pStr, v.estoque);
    });

    abrirModal("modal-produto");
}

function duplicarProduto(idOuCodigo) {
    const produto = todosProdutos.find(p => p.id === idOuCodigo || p.codigo_barras === idOuCodigo);
    if (!produto) return;
    abrirEditarProduto(idOuCodigo);
    produtoEditandoId = null; 
    document.getElementById("titulo-modal-produto").innerHTML = '<i class="fa-solid fa-copy"></i> DUPLICAR PRODUTO';
    document.getElementById("cad-barras").value  = ''; 
}

function abrirModal(id) { document.getElementById(id).classList.add("active"); }
function fecharModal(id) { document.getElementById(id).classList.remove("active"); }

async function salvarProduto(evento) {
    evento.preventDefault(); 
    let variacoesArr = [];
    document.querySelectorAll("#container-variacoes > div").forEach(linha => {
        variacoesArr.push({
            nome: linha.querySelector(".var-nome").value.trim(),
            preco: parseFloat(linha.querySelector(".var-preco").value.replace(/\./g, '').replace(',', '.')),
            estoque: parseInt(linha.querySelector(".var-estoque").value) || 0
        });
    });

    const produtoForm = {
        codigo_barras: document.getElementById("cad-barras").value.trim().replace(/^0+/, '') || '0',
        nome:          variacoesArr[0].nome,
        categoria:     document.getElementById("cad-categoria").value.trim(),
        marca:         document.getElementById("cad-marca").value.trim(),
        unidade:       document.getElementById("cad-unidade").value,
        variacoes:     variacoesArr,
        preco:         variacoesArr[0].preco,
        estoque:       variacoesArr.reduce((acc, v) => acc + v.estoque, 0)
    };

    const url = produtoEditandoId ? `http://localhost:3000/api/produtos/${produtoEditandoId}` : "http://localhost:3000/api/produtos";
    const metodo = produtoEditandoId ? "PUT" : "POST";

    try {
        await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(produtoForm) });
    } catch (e) {
        // Fallback Local
        if (produtoEditandoId) {
            const i = todosProdutos.findIndex(p => p.id === produtoEditandoId || p.codigo_barras === produtoEditandoId);
            if (i > -1) todosProdutos[i] = { ...todosProdutos[i], ...produtoForm };
        } else {
            produtoForm.id = Date.now();
            todosProdutos.push(produtoForm);
        }
        localStorage.setItem("produtosCadastrados", JSON.stringify(todosProdutos));
    }
    
    fecharModal("modal-produto");
    await carregarBanco();
    document.getElementById("filtro-texto").focus();
}

function abrirModalExcluir(id, nome) {
    document.getElementById("texto-confirmacao-exclusao").innerText = `Excluir "${nome}"?`;
    document.getElementById("btn-confirmar-exclusao").onclick = () => excluirProduto(id);
    abrirModal("modal-excluir");
}

async function excluirProduto(id) {
    try {
        await fetch(`http://localhost:3000/api/produtos/${id}`, { method: "DELETE" });
    } catch (e) {
        todosProdutos = todosProdutos.filter(p => p.id !== id && p.codigo_barras !== id);
        localStorage.setItem("produtosCadastrados", JSON.stringify(todosProdutos));
    }
    fecharModal("modal-excluir");
    await carregarBanco();
}

/* ================= GRÁFICOS (MANTIDOS) ================= */
const parseDateBR = (str) => { 
    if(!str) return null; 
    let d = str.includes('T') ? str.split('T')[0].split('-') : (str.includes('-') ? str.split('-') : str.split('/'));
    if(d[0].length === 4) d = [d[2], d[1], d[0]];
    return new Date(d[2], d[1] - 1, d[0]).getTime(); 
};

function abrirModalGrafico(id) {
    produtoGraficoAtual = todosProdutos.find(p => p.id === id || p.codigo_barras === id);
    if (!produtoGraficoAtual) return;
    document.getElementById("grafico-titulo").innerHTML = `<i class="fa-solid fa-chart-line"></i> DESEMPENHO: ${produtoGraficoAtual.nome}`;
    
    let hj = new Date(); let ant = new Date(); ant.setDate(hj.getDate() - 30);
    document.getElementById("grafico-data-fim").value = hj.toISOString().split('T')[0];
    document.getElementById("grafico-data-ini").value = ant.toISOString().split('T')[0];
    abrirModal("modal-grafico"); atualizarGrafico();
}

function atualizarGrafico() {
    if (!produtoGraficoAtual) return;
    let iMs = new Date(document.getElementById("grafico-data-ini").value + "T00:00:00").getTime() || 0;
    let fMs = new Date(document.getElementById("grafico-data-fim").value + "T23:59:59").getTime() || Infinity;

    let tot = 0, hist = {};
    vendasGlobais.forEach(v => {
        let vMs = parseDateBR(v.data);
        if (vMs >= iMs && vMs <= fMs) {
            let it = typeof v.itens === 'string' ? JSON.parse(v.itens) : v.itens;
            it.forEach(item => {
                if (item.codigo_barras === produtoGraficoAtual.codigo_barras) {
                    tot += item.quantidade;
                    hist[v.data] = (hist[v.data] || 0) + item.quantidade;
                }
            });
        }
    });

    let dt = Object.keys(hist).sort((a,b) => parseDateBR(a) - parseDateBR(b));
    let lbl = dt.map(d => d.substring(0, 5));
    let val = dt.map(d => hist[d]);

    document.getElementById("stat-total").innerText = tot;
    let med = dt.length ? (tot / dt.length).toFixed(1) : 0;
    document.getElementById("stat-media").innerText = med;

    let ic = document.getElementById("icone-tendencia");
    if (val.length > 0) {
        let ult = val[val.length - 1];
        ic.className = ult > med ? "fa-solid fa-arrow-trend-up" : (ult < med ? "fa-solid fa-arrow-trend-down" : "fa-solid fa-minus");
        ic.style.color = ult > med ? "#10b981" : (ult < med ? "#ef4444" : "#f59e0b");
    }

    const ctx = document.getElementById('canvasGraficoVendas').getContext('2d');
    if (graficoVendasObj) graficoVendasObj.destroy();
    graficoVendasObj = new Chart(ctx, {
        type: 'line',
        data: { labels: lbl, datasets: [{ label: 'Vendas', data: val, borderColor: '#0055A4', backgroundColor: 'rgba(0, 85, 164, 0.1)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}
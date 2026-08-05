// js/vendas.js

// ====== CONFIGURAÇÃO FIREBASE ======
const firebaseConfig = {
  apiKey: "AIzaSyD7wJktOHu8-DcjUJuq2LNfc3tzbPYG51I",
  authDomain: "vendas-5be3a.firebaseapp.com",
  projectId: "vendas-5be3a",
  storageBucket: "vendas-5be3a.firebasestorage.app",
  messagingSenderId: "1081607347261",
  appId: "1:1081607347261:web:042bcb33c48d115d6ade54",
  measurementId: "G-VCGD6B2XET"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// ===================================

let produtosDoBanco = []; 
let carrinho = [];        
let valorTotal = 0;       
let formaPagamentoAtual = "Dinheiro"; 
let multiplicadorAtual = 1; 
let contaFiadoOriginal_id = null; 
let cpfNotaAtual = ""; 

let pagamentosCaixa = [];
let valorFaltanteMisto = 0;
let vendaEditandoId = null;
let dataOriginalVendaEditada = null;
let horaOriginalVendaEditada = null;

let modoCarrinho = false;
let indiceCarrinhoSelecionado = -1;

let produtosPorPeso = [];
let idEditandoPeso = null;

// Lógica de Peso (F9)
let indiceF9Selecionado = -1;
let produtoF9Atual = null;

let todasContasF4 = [];
let contasFiltradasF4 = [];
let indiceContaF4 = -1;

let taxasMaquininha = JSON.parse(localStorage.getItem("taxasMaquininha")) || { credito: 0, debito: 0, pix: 0 };
let configImpressora = JSON.parse(localStorage.getItem("configImpressora")) || { 
    nome: "SUPERMERCADO MARCÃO", cnpj: "00.000.000/0001-00", endereco: "Rua Principal, 123", rodape: "Obrigado!" 
};

document.addEventListener("DOMContentLoaded", async () => {
    await carregarCatalogoDoServidor();
    await carregarProdutosPesoDoServidor();
    aplicarConfiguracoesNaTela();
    
    const idEdit = localStorage.getItem("editandoVendaId");
    if (idEdit) {
        localStorage.removeItem("editandoVendaId");
        await carregarVendaParaEdicao(idEdit);
    } else {
        await detectarFiadoNaUrl();
    }

    document.addEventListener('click', () => {
        const modalAtivo = document.querySelector('.modal-overlay.active');
        if (!modalAtivo && !modoCarrinho) document.getElementById("venda-barras").focus();
    });

    configurarMascaras();
    document.getElementById("venda-barras").focus();
    atualizarVisorQuantidade(); 

    const campoLeitor = document.getElementById("venda-barras");
    campoLeitor.addEventListener("keypress", function(evento) {
        if (evento.key === "Enter") {
            evento.preventDefault();
            
            // --- CORREÇÃO: Se o campo estiver vazio, não faz a busca! ---
            if (this.value.trim() === "") {
                return; 
            }
            // --------------------------------------------------------------

            let codigo = this.value.trim().replace(/^0+/, ''); 
            if(codigo === '') codigo = '0';
            adicionarProduto(codigo);
            this.value = ""; 
        }
    });

    document.addEventListener("keydown", (e) => {
        const modalImpressaoAberto = document.getElementById('modal-confirmar-impressao').classList.contains('active');
        if (modalImpressaoAberto) {
            if (e.key === "F1") { e.preventDefault(); confirmarVendaComImpressao(true); }
            if (e.key === "F2") { e.preventDefault(); confirmarVendaComImpressao(false); }
            if (e.key === "Escape") { e.preventDefault(); fecharModal('modal-confirmar-impressao'); }
            return; 
        }

        const modalAtivo = document.querySelector('.modal-overlay.active');

        // NAVEGAÇÃO NO MODAL DO F9
        if (modalAtivo && modalAtivo.id === 'modal-f9-lista') {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (indiceF9Selecionado < produtosPorPeso.length - 1) {
                    indiceF9Selecionado++;
                    atualizarEstilosListaF9();
                }
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (indiceF9Selecionado > 0) {
                    indiceF9Selecionado--;
                    atualizarEstilosListaF9();
                }
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (indiceF9Selecionado >= 0 && produtosPorPeso.length > 0) {
                    selecionarProdutoF9(produtosPorPeso[indiceF9Selecionado]);
                }
            }
        }

        if (modalAtivo && modalAtivo.id === 'modal-selecionar-conta') {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (indiceContaF4 < contasFiltradasF4.length - 1) {
                    indiceContaF4++;
                    atualizarEstilosF4();
                }
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (indiceContaF4 > 0) {
                    indiceContaF4--;
                    atualizarEstilosF4();
                }
            } else if (e.key === "Enter") {
                if (document.activeElement.tagName !== 'BUTTON' || document.activeElement.classList.contains('btn-conta-f4')) {
                    e.preventDefault();
                    if (indiceContaF4 >= 0 && contasFiltradasF4.length > 0) {
                        const c = contasFiltradasF4[indiceContaF4];
                        processarFiadoExistente(c.id, c.cliente);
                    }
                }
            }
        }

        if (e.key === "Tab" && !modalAtivo) {
            e.preventDefault();
            if (carrinho.length > 0) {
                modoCarrinho = !modoCarrinho;
                indiceCarrinhoSelecionado = modoCarrinho ? carrinho.length - 1 : -1;
                if (modoCarrinho) document.activeElement.blur(); 
                else document.getElementById("venda-barras").focus(); 
                atualizarTela();
            }
            return;
        }

        if (modoCarrinho && !modalAtivo) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (indiceCarrinhoSelecionado < carrinho.length - 1) indiceCarrinhoSelecionado++;
                atualizarTela();
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                if (indiceCarrinhoSelecionado > 0) indiceCarrinhoSelecionado--;
                atualizarTela();
            }
            if (e.key === "Delete") {
                e.preventDefault();
                removerItemDoCarrinho();
            }
            if (e.key === "Escape") {
                modoCarrinho = false;
                indiceCarrinhoSelecionado = -1;
                atualizarTela();
                document.getElementById("venda-barras").focus();
            }
            return; 
        }

        if (e.key === "Escape") {
            if (modalAtivo) {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
                document.getElementById("venda-barras").focus();
            } else window.location.href = "index.html";
        }

        if (["F2", "F3", "F4", "F7", "F8", "F9", "F12"].includes(e.key)) e.preventDefault();

        if (!modalAtivo && !modoCarrinho) {
            if (e.key === "F2") abrirPesquisa();
            if (e.key === "F3") abrirQuantidade();
            if (e.key === "F4") abrirModalContas();
            if (e.key === "F7") abrirModalCPF();
            if (e.key === "F8") abrirModalAvulso();
            if (e.key === "F9") abrirModalF9();
            if (e.key === "F12") abrirPagamento();
            if (e.key === "Delete") cancelarVenda(); 
        }

        if (modalAtivo && modalAtivo.id === 'modal-pagamento') {
            if (e.key === "F1") selecionarFormaPagamento('Dinheiro');
            if (e.key === "F2") selecionarFormaPagamento('Cartão de Crédito');
            if (e.key === "F3") selecionarFormaPagamento('Cartão de Débito');
            if (e.key === "F4") selecionarFormaPagamento('PIX');
        }

        // --- CORREÇÃO: Adicionado e.preventDefault() nas confirmações de modal ---
        if (e.key === "Enter" && modalAtivo && modalAtivo.id === 'modal-quantidade') { e.preventDefault(); confirmarQuantidade(); }
        if (e.key === "Enter" && modalAtivo && modalAtivo.id === 'modal-cpf') { e.preventDefault(); confirmarCPF(); }
        if (e.key === "Enter" && modalAtivo && modalAtivo.id === 'modal-cadastrar-fiado') { e.preventDefault(); salvarNovoFiadoNoPDV(); }
        if (e.key === "Enter" && modalAtivo && modalAtivo.id === 'modal-f9-peso') { e.preventDefault(); confirmarPesoF9(); }
        // -------------------------------------------------------------------------
    });
});

async function carregarCatalogoDoServidor() {
    try {
        const resposta = await fetch('http://localhost:3000/api/produtos');
        if (resposta.ok) produtosDoBanco = await resposta.json();
    } catch (erro) { console.error("Servidor offline!"); }
}

async function carregarProdutosPesoDoServidor() {
    try {
        const resposta = await fetch('http://localhost:3000/api/produtos_peso');
        if (resposta.ok) produtosPorPeso = await resposta.json();
    } catch (erro) { console.error("Servidor offline!"); }
}

async function carregarVendaParaEdicao(id) {
    try {
        const doc = await db.collection("vendas").doc(id).get();
        if (doc.exists) {
            const venda = doc.data();
            vendaEditandoId = doc.id;
            dataOriginalVendaEditada = venda.data;
            horaOriginalVendaEditada = venda.hora;
            carrinho = venda.itens || [];
            
            document.getElementById("status-fiado-carregado").style.display = "block";
            document.getElementById("status-fiado-carregado").style.background = "#f59e0b";
            document.getElementById("nome-cliente-fiado-nota").innerText = "MODO DE EDIÇÃO";
            document.getElementById("display-nome-produto").innerText = `EDITANDO VENDA #${id.substring(0,5)}...`;
            
            atualizarTela();
        }
    } catch(e) { console.warn("Erro ao carregar venda do Firebase para edição", e); }
}

async function detectarFiadoNaUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const fiadoId = urlParams.get('fiado_id');

    if (fiadoId) {
        contaFiadoOriginal_id = parseInt(fiadoId);
        try {
            const resposta = await fetch(`http://localhost:3000/api/fiados/${contaFiadoOriginal_id}`);
            const conta = await resposta.json();

            if (conta.itens && conta.itens.length > 0) {
                carrinho = [...conta.itens]; 
                
                let somaDosItens = carrinho.reduce((acc, item) => acc + item.subtotal, 0);
                let valorRealDevido = (conta.total || 0) - (conta.valorPago || 0);
                let valorJaPago = somaDosItens - valorRealDevido;
                
                if (valorJaPago > 0.01) { 
                    carrinho.push({
                        codigo_barras: 'PGTO-ANT',
                        nome: 'Pago',
                        preco: -valorJaPago,
                        quantidade: 1,
                        subtotal: -valorJaPago
                    });
                }

                document.getElementById("status-fiado-carregado").style.display = "block";
                document.getElementById("status-fiado-carregado").style.background = "#0055A4";
                document.getElementById("nome-cliente-fiado-nota").innerText = conta.cliente;
                document.getElementById("display-nome-produto").innerText = `FIADO: ${conta.cliente}`;
                
                if (conta.cpf && conta.cpf !== "Não informado") {
                    cpfNotaAtual = conta.cpf;
                    document.getElementById("cupom-cpf-cliente").innerText = cpfNotaAtual;
                    document.getElementById("display-cpf-nota").innerText = cpfNotaAtual;
                }
                atualizarTela(); 
            }
        } catch (e) { contaFiadoOriginal_id = null; }
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function configurarMascaras() {
    const configMoeda = { mask: Number, scale: 2, signed: false, thousandsSeparator: '.', padFractionalZeros: true, normalizeZeros: true, radix: ',' };
    IMask(document.getElementById('pagamento-valor-recebido'), configMoeda);
    IMask(document.getElementById('avulso-valor'), configMoeda);
    IMask(document.getElementById('rapido-valor'), configMoeda);
    IMask(document.getElementById('config-peso-preco'), configMoeda);

    IMask(document.getElementById('input-cpf-modal'), { mask: '000.000.000-00' });
    IMask(document.getElementById('novofiado-cpf'), { mask: '000.000.000-00' });
    IMask(document.getElementById('novofiado-telefone'), { mask: '(00) 00000-0000' });
}

function aplicarConfiguracoesNaTela() {
    document.getElementById("cupom-nome-mercado").innerText = configImpressora.nome;
    document.getElementById("cupom-cnpj").innerText = "CNPJ: " + configImpressora.cnpj;
    document.getElementById("cupom-endereco").innerText = configImpressora.endereco;
    document.getElementById("cupom-rodape").innerText = configImpressora.rodape;
}

function fecharModal(id) { 
    document.getElementById(id).classList.remove('active'); 
    document.getElementById("venda-barras").focus();
}

function abrirPesquisa() { alert("Tela de pesquisa de produtos será implementada em breve."); }

function abrirConfigPeso() {
    idEditandoPeso = null; 
    document.getElementById('config-peso-nome').value = '';
    document.getElementById('config-peso-codigo').value = '';
    document.getElementById('config-peso-preco').value = '';
    document.getElementById('modal-config-peso').classList.add('active');
    renderizarListaConfigPeso();
    setTimeout(() => document.getElementById('config-peso-nome').focus(), 100);
}

async function salvarProdutoPeso() {
    const nome = document.getElementById('config-peso-nome').value.trim();
    const codigoStr = document.getElementById('config-peso-codigo').value.trim();
    const codigo = parseInt(codigoStr, 10);
    
    let precoStr = document.getElementById("config-peso-preco").value.replace(/\./g, '').replace(',', '.');
    let precoKg = parseFloat(precoStr) || 0;

    if(!nome) return alert("Preencha o nome do produto!");

    const payload = { nome: nome, codigo: codigo || 0, precoKg: precoKg };

    try {
        if (idEditandoPeso) {
            await fetch(`http://localhost:3000/api/produtos_peso/${idEditandoPeso}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            idEditandoPeso = null;
        } else {
            await fetch('http://localhost:3000/api/produtos_peso', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
        }
        await carregarProdutosPesoDoServidor(); 
    } catch(e) { console.error("Erro ao salvar produto por peso", e); }
    
    document.getElementById('config-peso-nome').value = '';
    document.getElementById('config-peso-codigo').value = '';
    document.getElementById('config-peso-preco').value = '';
    renderizarListaConfigPeso();
    document.getElementById('config-peso-nome').focus();
}

function editarProdutoPeso(id, nome, codigo, precoKg) {
    idEditandoPeso = id;
    document.getElementById('config-peso-nome').value = nome;
    document.getElementById('config-peso-codigo').value = codigo;
    document.getElementById('config-peso-preco').value = parseFloat(precoKg).toFixed(2).replace('.', ',');
    document.getElementById('config-peso-nome').focus();
}

async function excluirProdutoPeso(id) {
    if(confirm("Remover este produto da balança?")) {
        try {
            await fetch(`http://localhost:3000/api/produtos_peso/${id}`, { method: 'DELETE' });
            await carregarProdutosPesoDoServidor();
            renderizarListaConfigPeso();
        } catch (e) { console.error("Erro ao excluir", e); }
    }
}

function renderizarListaConfigPeso() {
    const lista = document.getElementById('lista-config-peso');
    lista.innerHTML = '';
    produtosPorPeso.forEach((prod) => {
        let precoAmostra = (prod.precoKg > 0) ? ` | R$ ${prod.precoKg.toFixed(2).replace('.',',')}/Kg` : '';
        lista.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px; border: 1px solid #b3d4ff; background: #f8fafc; border-radius: 8px; margin-bottom: 8px;">
                <span style="font-weight: 900; color: #0055A4; font-size: 1.1rem; flex: 1;">${prod.nome}</span>
                <div style="display:flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; color: #10b981; margin-right: 10px;">Cód: ${prod.codigo} ${precoAmostra}</span>
                    <button onclick="editarProdutoPeso(${prod.id}, '${prod.nome}', ${prod.codigo}, ${prod.precoKg})" title="Editar" style="background: #f59e0b; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="excluirProdutoPeso(${prod.id})" title="Excluir" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
}

// ======================= F9 - LÓGICA DE PESO =======================
function abrirModalF9() {
    if (produtosPorPeso.length === 0) return alert("Nenhum produto de peso cadastrado. Cadastre no ícone da balança!");
    
    indiceF9Selecionado = 0;
    document.getElementById('modal-f9-lista').classList.add('active');
    
    const listaHtml = document.getElementById('lista-f9-produtos');
    listaHtml.innerHTML = "";
    
    produtosPorPeso.forEach((p, index) => {
        let precoStr = (p.precoKg > 0) ? `R$ ${p.precoKg.toFixed(2).replace('.',',')}/Kg` : 'Sem Preço Kg';
        listaHtml.innerHTML += `
            <div class="item-peso" id="f9-item-${index}" onclick="selecionarProdutoF9(produtosPorPeso[${index}])">
                <span>${p.nome}</span>
                <span>${precoStr}</span>
            </div>
        `;
    });
    
    atualizarEstilosListaF9();
}

function atualizarEstilosListaF9() {
    const itens = document.querySelectorAll('.item-peso');
    itens.forEach((item, index) => {
        if (index === indiceF9Selecionado) {
            item.classList.add('selecionada');
            item.style.backgroundColor = "#ddd6fe"; // Cor tema F9 (roxo)
            item.style.borderLeft = "5px solid #8b5cf6";
            item.style.fontWeight = "bold";
            item.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } else {
            item.classList.remove('selecionada');
            item.style.backgroundColor = "transparent";
            item.style.borderLeft = "none";
            item.style.fontWeight = "normal";
        }
    });
}

function selecionarProdutoF9(produto) {
    if (!produto.precoKg || produto.precoKg <= 0) return alert("Esse produto não tem Preço por Kg cadastrado!");
    
    produtoF9Atual = produto;
    fecharModal('modal-f9-lista');
    
    document.getElementById('f9-produto-nome').innerText = produto.nome;
    document.getElementById('f9-produto-preco').innerText = `R$ ${produto.precoKg.toFixed(2).replace('.',',')} / Kg`;
    document.getElementById('input-f9-peso').value = "";
    
    document.getElementById('modal-f9-peso').classList.add('active');
    setTimeout(() => document.getElementById('input-f9-peso').focus(), 100);
}

// Máscara que coloca a vírgula automática ao chegar no 4º dígito (Ex: 1000 vira 1,000)
function formatarPesoF9(input) {
    let valor = input.value.replace(/\D/g, ''); // Deixa apenas números
    
    if (valor.length >= 4) {
        valor = valor.substring(0, valor.length - 3) + ',' + valor.substring(valor.length - 3);
    }
    
    input.value = valor;
}

function confirmarPesoF9() {
    if (!produtoF9Atual) return;
    
    let pesoStr = document.getElementById('input-f9-peso').value.replace(',', '.');
    let pesoKg = parseFloat(pesoStr);
    
    if (!pesoKg || pesoKg <= 0) return alert("Digite um peso válido!");
    
    let preco = produtoF9Atual.precoKg;
    let subtotalCalculado = preco * pesoKg;
    
    const produtoF9Carrinho = {
        codigo_barras: 'F9-' + Date.now(),
        nome: "(Peso) " + produtoF9Atual.nome,
        preco: preco,
        quantidade: pesoKg,
        subtotal: subtotalCalculado
    };

    carrinho.push(produtoF9Carrinho);
    
    document.getElementById("display-nome-produto").innerText = produtoF9Carrinho.nome;
    document.getElementById("display-unit").innerText = preco.toFixed(2).replace('.',',');
    document.getElementById("display-subtotal").innerText = subtotalCalculado.toFixed(2).replace('.',',');

    multiplicadorAtual = 1;
    atualizarVisorQuantidade();
    atualizarTela();
    
    fecharModal('modal-f9-peso');
}
// ===================================================================

function abrirModalAvulso() {
    document.getElementById("avulso-nome").value = "";
    document.getElementById("avulso-valor").value = "";
    document.getElementById("modal-avulso").classList.add("active");
    setTimeout(() => document.getElementById("avulso-nome").focus(), 100);
}

function confirmarAvulso() {
    let nome = document.getElementById("avulso-nome").value.trim();
    let valStr = document.getElementById("avulso-valor").value.replace(/\./g, '').replace(',', '.');
    let preco = parseFloat(valStr);

    if (!nome || !preco || preco <= 0) return alert("Preencha o nome e um valor válido!");

    const produtoAvulso = {
        codigo_barras: 'AVULSO-' + Date.now(),
        nome: "(Avulso) " + nome,
        preco: preco,
        quantidade: multiplicadorAtual,
        subtotal: preco * multiplicadorAtual
    };

    carrinho.push(produtoAvulso);
    
    document.getElementById("display-nome-produto").innerText = produtoAvulso.nome;
    document.getElementById("display-unit").innerText = preco.toFixed(2).replace('.',',');
    document.getElementById("display-subtotal").innerText = produtoAvulso.subtotal.toFixed(2).replace('.',',');

    multiplicadorAtual = 1;
    atualizarVisorQuantidade();
    atualizarTela();
    fecharModal("modal-avulso");
}

function abrirCadastroRapido(codigoBarras) {
    document.getElementById("rapido-barras").value = codigoBarras;
    document.getElementById("rapido-nome").value = "";
    document.getElementById("rapido-valor").value = "";
    document.getElementById("rapido-estoque").value = "1";
    document.getElementById("modal-cadastro-rapido").classList.add("active");
    setTimeout(() => document.getElementById("rapido-nome").focus(), 100);
}

async function salvarCadastroRapido() {
    let codigo = document.getElementById("rapido-barras").value;
    let nome = document.getElementById("rapido-nome").value.trim();
    let valStr = document.getElementById("rapido-valor").value.replace(/\./g, '').replace(',', '.');
    let preco = parseFloat(valStr);
    let estoque = parseInt(document.getElementById("rapido-estoque").value) || 0;

    if (!nome || !preco || preco <= 0) return alert("Preencha Nome e Valor corretamente!");

    const novoProduto = {
        codigo_barras: codigo,
        nome: nome,
        categoria: "Sem Categoria",
        marca: "Sem Marca",
        unidade: "UN",
        variacoes: [{ nome: nome, preco: preco, estoque: estoque }],
        preco: preco,
        estoque: estoque
    };

    try {
        await fetch("http://localhost:3000/api/produtos", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(novoProduto)
        });
    } catch(e) { console.warn("API Offline, salvando na memória."); }
    
    produtosDoBanco.push(novoProduto);
    fecharModal("modal-cadastro-rapido");
    adicionarProduto(codigo);
}

function abrirModalCPF() {
    document.getElementById('modal-cpf').classList.add('active');
    setTimeout(() => {
        const input = document.getElementById('input-cpf-modal');
        input.value = cpfNotaAtual; input.focus();
    }, 100);
}
function confirmarCPF() {
    let cpf = document.getElementById('input-cpf-modal').value.trim();
    cpfNotaAtual = cpf;
    document.getElementById("cupom-cpf-cliente").innerText = cpf || "Não informado";
    document.getElementById("display-cpf-nota").innerText = cpf || "Não informado";
    fecharModal('modal-cpf');
}

function abrirQuantidade() {
    document.getElementById('modal-quantidade').classList.add('active');
    setTimeout(() => {
        const input = document.getElementById('input-nova-qtd');
        input.value = ""; input.focus();
    }, 100);
}
function confirmarQuantidade() {
    let valStr = document.getElementById('input-nova-qtd').value.replace(',', '.');
    let val = parseFloat(valStr);
    if(val > 0) {
        multiplicadorAtual = val;
        atualizarVisorQuantidade();
    }
    fecharModal('modal-quantidade');
}

function atualizarVisorQuantidade() {
    document.getElementById("display-qtd").innerText = multiplicadorAtual.toFixed(3).replace('.',',');
}

function adicionarProduto(codigoBarras) {
    if (codigoBarras.length === 13 && codigoBarras.startsWith("2")) {
        let codigoExtraido = parseInt(codigoBarras.substring(1, 5), 10);
        let precoTotal = parseInt(codigoBarras.substring(7, 12), 10) / 100;
        const produtoPeso = produtosPorPeso.find(p => p.codigo === codigoExtraido);

        if (produtoPeso) {
            const itemVenda = {
                codigo_barras: codigoBarras,
                nome: "(Bal) " + produtoPeso.nome,
                preco: precoTotal,
                quantidade: 1, 
                subtotal: precoTotal
            };

            carrinho.push(itemVenda);
            
            document.getElementById("display-nome-produto").innerText = itemVenda.nome;
            document.getElementById("display-unit").innerText = precoTotal.toFixed(2).replace('.',',');
            document.getElementById("display-subtotal").innerText = precoTotal.toFixed(2).replace('.',',');

            multiplicadorAtual = 1;
            atualizarVisorQuantidade();
            atualizarTela();
            return; 
        }
    }

    const produto = produtosDoBanco.find(p => p.codigo_barras === codigoBarras);
    if (produto) {
        const itemExistente = carrinho.find(i => i.codigo_barras === produto.codigo_barras);
        if (itemExistente) {
            itemExistente.quantidade += multiplicadorAtual; 
            itemExistente.subtotal = itemExistente.quantidade * itemExistente.preco;
        } else {
            carrinho.push({ ...produto, quantidade: multiplicadorAtual, subtotal: produto.preco * multiplicadorAtual });
        }
        
        document.getElementById("display-nome-produto").innerText = produto.nome;
        document.getElementById("display-unit").innerText = parseFloat(produto.preco).toFixed(2).replace('.',',');
        document.getElementById("display-subtotal").innerText = (parseFloat(produto.preco) * multiplicadorAtual).toFixed(2).replace('.',',');
        
        atualizarTela();
        multiplicadorAtual = 1; 
        atualizarVisorQuantidade();
    } else {
        abrirCadastroRapido(codigoBarras);
    }
}

function atualizarTela() {
    const tbody = document.getElementById("lista-carrinho-notinha");
    tbody.innerHTML = "";
    valorTotal = 0;

    carrinho.forEach((item, index) => {
        valorTotal += item.subtotal;
        let qtd = Number.isInteger(item.quantidade) ? item.quantidade : item.quantidade.toFixed(3);
        let nome = item.nome.substring(0, 18);
        
        let classeSelecionada = (modoCarrinho && index === indiceCarrinhoSelecionado) ? 'class="linha-selecionada"' : '';

        tbody.innerHTML += `<tr ${classeSelecionada}>
            <td>${qtd}</td>
            <td>${nome}</td>
            <td>${parseFloat(item.preco).toFixed(2).replace('.',',')}</td>
            <td>${item.subtotal.toFixed(2).replace('.',',')}</td>
        </tr>`;
    });

    let totalStr = `R$ ${valorTotal.toFixed(2).replace('.', ',')}`;
    document.getElementById("notinha-subtotal").innerText = totalStr;
    document.getElementById("notinha-total").innerText = totalStr;
    document.getElementById("pagamento-total-cobrar").innerText = totalStr;
}

function removerItemDoCarrinho() {
    if (indiceCarrinhoSelecionado >= 0 && indiceCarrinhoSelecionado < carrinho.length) {
        carrinho.splice(indiceCarrinhoSelecionado, 1);
        if (carrinho.length === 0) {
            modoCarrinho = false;
            indiceCarrinhoSelecionado = -1;
            document.getElementById("venda-barras").focus();
        } else if (indiceCarrinhoSelecionado >= carrinho.length) {
            indiceCarrinhoSelecionado = carrinho.length - 1;
        }
        atualizarTela();
    }
}

function cancelarVenda() {
    if (carrinho.length > 0 && confirm("Deseja realmente CANCELAR o carrinho atual?")) limparCaixaEVisores();
}

function limparCaixaEVisores() {
    carrinho = []; valorTotal = 0; multiplicadorAtual = 1;
    contaFiadoOriginal_id = null; cpfNotaAtual = "";
    modoCarrinho = false; indiceCarrinhoSelecionado = -1;
    vendaEditandoId = null;
    document.getElementById("status-fiado-carregado").style.display = "none";
    document.getElementById("display-nome-produto").innerText = "CAIXA LIVRE";
    document.getElementById("display-unit").innerText = "0,00";
    document.getElementById("display-subtotal").innerText = "0,00";
    document.getElementById("cupom-cpf-cliente").innerText = "Não informado";
    document.getElementById("display-cpf-nota").innerText = "Não informado";
    atualizarVisorQuantidade(); atualizarTela(); document.getElementById("venda-barras").focus();
}

function abrirPagamento() {
    if (carrinho.length === 0) return alert("Adicione produtos primeiro!");
    pagamentosCaixa = [];
    valorFaltanteMisto = valorTotal;
    
    document.getElementById("pagamento-valor-recebido").value = "";
    document.getElementById('modal-pagamento').classList.add('active');
    selecionarFormaPagamento('Dinheiro');
    
    atualizarResumoPagamentoMisto();
    setTimeout(() => document.getElementById("pagamento-valor-recebido").focus(), 100);
}

function selecionarFormaPagamento(forma) {
    formaPagamentoAtual = forma;
    document.querySelectorAll('.forma-box').forEach(b => b.classList.remove('active'));
    
    if (forma === 'Dinheiro') document.getElementById('btn-pgto-dinheiro').classList.add('active');
    if (forma === 'Cartão de Crédito') document.getElementById('btn-pgto-cartao').classList.add('active');
    if (forma === 'Cartão de Débito') document.getElementById('btn-pgto-debito').classList.add('active');
    if (forma === 'PIX') document.getElementById('btn-pgto-pix').classList.add('active');

    if(valorFaltanteMisto > 0) {
        document.getElementById("pagamento-valor-recebido").value = valorFaltanteMisto.toFixed(2).replace('.', ',');
    }
    document.getElementById("pagamento-valor-recebido").focus();
}

function verificarEnterPagamento(event) {
    if (event.key === "Enter") adicionarPagamentoCaixa();
}

function adicionarPagamentoCaixa() {
    let valStr = document.getElementById("pagamento-valor-recebido").value.replace(/\./g, '').replace(',', '.');
    let valorDigitado = parseFloat(valStr);

    if (!valorDigitado || valorDigitado <= 0) return;

    pagamentosCaixa.push({ forma: formaPagamentoAtual, valor: valorDigitado });
    document.getElementById("pagamento-valor-recebido").value = "";
    
    atualizarResumoPagamentoMisto();
}

function atualizarResumoPagamentoMisto() {
    let totalPagoNaVenda = pagamentosCaixa.reduce((acc, p) => acc + p.valor, 0);
    valorFaltanteMisto = valorTotal - totalPagoNaVenda;
    
    let trocoVisual = 0;
    if (valorFaltanteMisto < 0) {
        trocoVisual = Math.abs(valorFaltanteMisto);
        valorFaltanteMisto = 0;
    }

    const listaHtml = document.getElementById("lista-pagamentos-pdv");
    listaHtml.innerHTML = "";
    pagamentosCaixa.forEach((p) => {
        listaHtml.innerHTML += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding:5px 0;">
            <span><i class="fa-solid fa-check" style="color:#10b981;"></i> ${p.forma}</span>
            <span>R$ ${p.valor.toFixed(2).replace('.',',')}</span>
        </div>`;
    });

    document.getElementById("pagamento-falta").innerText = `R$ ${valorFaltanteMisto.toFixed(2).replace('.',',')}`;
    document.getElementById("pagamento-troco").innerText = `R$ ${trocoVisual.toFixed(2).replace('.',',')}`;

    const btnConcluir = document.getElementById("btn-finalizar-venda-btn");
    
    let podeConcluir = false;
    if (pagamentosCaixa.length > 0) {
        if (valorFaltanteMisto <= 0) {
            podeConcluir = true;
        } else if (contaFiadoOriginal_id !== null) {
            podeConcluir = true; 
        }
    }

    if (podeConcluir) {
        btnConcluir.style.opacity = "1";
        btnConcluir.style.pointerEvents = "auto";
        btnConcluir.innerHTML = '<i class="fa-solid fa-check-circle"></i> CONCLUIR VENDA (ENTER)';
        btnConcluir.style.background = "#10b981";
        btnConcluir.focus();
    } else {
        btnConcluir.style.opacity = "0.5";
        btnConcluir.style.pointerEvents = "none";
    }
}

function abrirModalImpressao() {
    document.getElementById('modal-confirmar-impressao').classList.add('active');
}

function confirmarVendaComImpressao(imprimir) {
    finalizarVendaReal(imprimir);
}

async function finalizarVendaReal(imprimir) {
    let nomePagamento = pagamentosCaixa.length === 1 ? pagamentosCaixa[0].forma : "Misto";
    let totalPago = pagamentosCaixa.reduce((acc, p) => acc + p.valor, 0);
    
    let valorVendaRegistrada = (contaFiadoOriginal_id && totalPago < valorTotal) ? totalPago : valorTotal;
    
    const agora = new Date();
    
    const vendaObj = {
        data: (vendaEditandoId && dataOriginalVendaEditada) ? dataOriginalVendaEditada : agora.toLocaleDateString('pt-BR'),
        hora: (vendaEditandoId && horaOriginalVendaEditada) ? horaOriginalVendaEditada : agora.toLocaleTimeString('pt-BR', { hour12: false }),
        totalBruto: valorVendaRegistrada,
        desconto: 0,
        totalLiquido: valorVendaRegistrada, 
        custoTaxas: 0,
        pagamento: nomePagamento,
        detalhesPagamento: pagamentosCaixa, 
        itens: carrinho,
        valorParaRelatorio: valorVendaRegistrada 
    };
    
    try {
        if (vendaEditandoId) {
            await db.collection("vendas").doc(vendaEditandoId).set(vendaObj);
        } else {
            await db.collection("vendas").add(vendaObj);
        }

        if (contaFiadoOriginal_id) {
            const resp = await fetch(`http://localhost:3000/api/fiados/${contaFiadoOriginal_id}`);
            if (resp.ok) {
                const contaAtual = await resp.json();

                if (valorFaltanteMisto > 0) {
                    contaAtual.total = contaAtual.total - totalPago; 
                } else {
                    contaAtual.valorPago = contaAtual.total;
                }
                
                await fetch(`http://localhost:3000/api/fiados/${contaFiadoOriginal_id}`, { 
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(contaAtual)
                });
            }
        }
    } catch(e) { 
        console.error("Erro ao salvar no Firebase ou Servidor!", e);
        alert("Erro ao salvar a venda. Verifique a internet ou o servidor local!");
        return; 
    }

    if(imprimir === true) {
        imprimirNotinha();
    }

    fecharModal('modal-confirmar-impressao');
    fecharModal('modal-pagamento');
    limparCaixaEVisores();
}

function imprimirNotinha() {
    const recibo = document.getElementById("recibo-impressao");
    
    let htmlRecibo = `
        <div style="text-align: center; margin-bottom: 10px;">
            <h2 style="margin: 0; font-size: 16px;">${configImpressora.nome}</h2>
            <p style="margin: 0; font-size: 10px;">CNPJ: ${configImpressora.cnpj}</p>
            <p style="margin: 0; font-size: 10px;">${configImpressora.endereco}</p>
            <p style="margin: 5px 0;">--------------------------------</p>
            <h3 style="margin: 0; font-size: 14px;">CUPOM NÃO FISCAL</h3>
            <p style="margin: 5px 0;">--------------------------------</p>
        </div>
        <table style="width: 100%; text-align: left; font-size: 11px; margin-bottom: 10px; border-collapse: collapse;">
            <tr><th style="border-bottom: 1px dashed #000;">QTD</th><th style="border-bottom: 1px dashed #000;">DESC.</th><th style="text-align: right; border-bottom: 1px dashed #000;">TOTAL</th></tr>
    `;

    carrinho.forEach(item => {
        let qtd = Number.isInteger(item.quantidade) ? item.quantidade : item.quantidade.toFixed(3);
        let nomeLimitado = item.nome.substring(0, 15);
        htmlRecibo += `
            <tr>
                <td style="vertical-align: top; padding-top: 3px;">${qtd}</td>
                <td style="padding-top: 3px;">${nomeLimitado}</td>
                <td style="text-align: right; padding-top: 3px;">R$ ${item.subtotal.toFixed(2).replace('.',',')}</td>
            </tr>
        `;
    });

    htmlRecibo += `
        </table>
        <p style="margin: 5px 0; text-align: center;">--------------------------------</p>
        <h2 style="text-align: right; margin: 5px 0; font-size: 14px;">TOTAL: R$ ${valorTotal.toFixed(2).replace('.',',')}</h2>
        <div style="font-size: 11px; margin-top: 10px;">
    `;
    
    pagamentosCaixa.forEach(p => {
        htmlRecibo += `<div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span>PAGO EM ${p.forma.toUpperCase()}</span><span>R$ ${p.valor.toFixed(2).replace('.',',')}</span></div>`;
    });
    
    let totalPago = pagamentosCaixa.reduce((acc, p) => acc + p.valor, 0);
    let troco = totalPago - valorTotal;
    let falta = valorTotal - totalPago;

    if(troco > 0) {
         htmlRecibo += `<div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 5px; font-size: 12px;"><span>TROCO</span><span>R$ ${troco.toFixed(2).replace('.',',')}</span></div>`;
    } else if (falta > 0 && contaFiadoOriginal_id) {
         htmlRecibo += `<div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 5px; font-size: 12px; color: #000;"><span>FICOU DEVENDO</span><span>R$ ${falta.toFixed(2).replace('.',',')}</span></div>`;
    }

    htmlRecibo += `
        </div>
        <p style="margin: 15px 0 5px 0; text-align: center;">--------------------------------</p>
        <p style="text-align: center; font-size: 11px;">${configImpressora.rodape}</p>
        <p style="text-align: center; font-size: 10px; margin-top: 5px;">CPF: ${cpfNotaAtual || 'Não informado'}</p>
    `;

    recibo.innerHTML = htmlRecibo;

    let cssImpressao = document.createElement('style');
    cssImpressao.innerHTML = `
        @media print {
            body * { visibility: hidden; } 
            #recibo-impressao, #recibo-impressao * { visibility: visible; } 
            #recibo-impressao { 
                position: absolute; left: 0; top: 0; 
                width: 100%; max-width: 80mm; 
                margin: 0; padding: 0; font-family: monospace; color: black;
            }
        }
    `;
    document.head.appendChild(cssImpressao);

    window.print(); 

    document.head.removeChild(cssImpressao); 
}

async function abrirModalContas() {
    if (carrinho.length === 0) return alert("Passe os produtos no leitor primeiro!");
    const container = document.getElementById('lista-contas-existentes');
    container.innerHTML = "<p style='color:#0055A4; font-weight:bold;'>Carregando clientes...</p>";
    document.getElementById('modal-selecionar-conta').classList.add('active');

    document.getElementById('pesquisa-conta-f4').value = ""; 
    indiceContaF4 = 0; 
    todasContasF4 = [];
    contasFiltradasF4 = [];

    try {
        const resp = await fetch('http://localhost:3000/api/fiados');
        if(resp.ok) todasContasF4 = await resp.json();
        
        contasFiltradasF4 = [...todasContasF4];
        renderizarContasF4();
        setTimeout(() => document.getElementById('pesquisa-conta-f4').focus(), 100);
    } catch(e) { container.innerHTML = "<p style='color:red'>Erro ao carregar clientes.</p>"; }
}

function renderizarContasF4() {
    const container = document.getElementById('lista-contas-existentes');
    container.innerHTML = "";
    
    if (contasFiltradasF4.length === 0) {
        container.innerHTML = "<p style='color:#ef4444; font-weight:bold;'>Nenhum cliente encontrado.</p>";
        indiceContaF4 = -1;
        return;
    }

    contasFiltradasF4.forEach((conta, index) => {
        let devendo = conta.total - (conta.valorPago || 0);
        container.innerHTML += `
            <button class="btn-conta-f4" onclick="processarFiadoExistente(${conta.id}, '${conta.cliente}')" 
                style="width: 100%; padding: 15px; margin-bottom: 10px; background: #f0f8ff; border: 2px solid #b3d4ff; border-radius: 6px; font-size: 1.1rem; font-weight: bold; color: #003366; text-align: left; cursor: pointer; transition: 0.2s; display: block;">
                <i class="fa-solid fa-user" style="color: #0055A4; margin-right: 10px;"></i> 
                ${conta.cliente} 
                <span style="float:right; color:#ef4444;">Devendo: R$ ${devendo.toFixed(2).replace('.',',')}</span>
            </button>
        `;
    });
    
    if (indiceContaF4 >= contasFiltradasF4.length) indiceContaF4 = Math.max(0, contasFiltradasF4.length - 1);
    atualizarEstilosF4();
}

function filtrarContasF4() {
    const termo = document.getElementById('pesquisa-conta-f4').value.toLowerCase();
    contasFiltradasF4 = todasContasF4.filter(c => c.cliente.toLowerCase().includes(termo));
    indiceContaF4 = contasFiltradasF4.length > 0 ? 0 : -1;
    renderizarContasF4();
}

function atualizarEstilosF4() {
    const botoes = document.querySelectorAll('.btn-conta-f4');
    botoes.forEach((btn, index) => {
        if (index === indiceContaF4) {
            btn.style.backgroundColor = "#0055A4";
            btn.style.color = "white";
            btn.querySelector('i').style.color = "white";
            btn.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } else {
            btn.style.backgroundColor = "#f0f8ff";
            btn.style.color = "#003366";
            btn.querySelector('i').style.color = "#0055A4";
        }
    });
}

async function processarFiadoExistente(id, cliente) {
    if (!confirm(`Deseja salvar o carrinho atual na conta de ${cliente}?`)) return;

    try {
        const resp = await fetch(`http://localhost:3000/api/fiados/${id}`);
        const conta = await resp.json();
        
        let itensFinais = [...(conta.itens || []), ...carrinho]; 
        let novoTotal = (conta.total || 0) + valorTotal;

        await fetch(`http://localhost:3000/api/fiados/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...conta, total: novoTotal, itens: itensFinais })
        });
        alert(`Produtos vinculados à conta de ${cliente}!`);
        fecharModal('modal-selecionar-conta'); limparCaixaEVisores();
    } catch (e) { alert("Erro ao lançar no fiado."); }
}

function abrirModalCadastrarFiado() {
    document.getElementById("novofiado-nome").value = "";
    document.getElementById("novofiado-cpf").value = "";
    document.getElementById("novofiado-telefone").value = "";
    document.getElementById('modal-cadastrar-fiado').classList.add('active');
    setTimeout(() => document.getElementById("novofiado-nome").focus(), 100);
}

async function salvarNovoFiadoNoPDV() {
    const nome = document.getElementById("novofiado-nome").value.trim();
    const cpf = document.getElementById("novofiado-cpf").value.trim();
    const telefone = document.getElementById("novofiado-telefone").value.trim();

    if (!nome) return alert("O Nome é obrigatório!");

    const novaConta = {
        cliente: nome, cpf: cpf || "Não informado", telefone: telefone || "Não informado",
        endereco: "Cadastrado no Caixa", dataCompra: new Date().toLocaleDateString('pt-BR'),
        dataPagamento: "A combinar", total: valorTotal, valorPago: 0, itens: [...carrinho] 
    };

    try {
        await fetch('http://localhost:3000/api/fiados', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novaConta)
        });
        alert(`Conta criada e vinculada para ${nome}!`);
        fecharModal('modal-cadastrar-fiado'); fecharModal('modal-selecionar-conta'); limparCaixaEVisores();
    } catch(e) { alert("Erro ao criar conta."); }
}

function abrirConfiguracoes() { document.getElementById('modal-taxas').classList.add('active'); }
function salvarTaxas() { fecharModal('modal-taxas'); }
function abrirConfigImpressora() { document.getElementById('modal-config-impressora').classList.add('active'); }
function salvarConfigImpressora() { fecharModal('modal-config-impressora'); }
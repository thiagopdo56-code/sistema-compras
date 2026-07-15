// js/vendas.js

// ====== CONFIGURAÇÃO FIREBASE ======
const firebaseConfig = {
  apiKey: "AIzaSyBZYWl6TWgSthBAVe1bTp2SkmDAdmtXieM",
  authDomain: "vendas2-47769.firebaseapp.com",
  projectId: "vendas2-47769",
  storageBucket: "vendas2-47769.firebasestorage.app",
  messagingSenderId: "34980699438",
  appId: "1:34980699438:web:643b2dbe31331d16886ebf",
  measurementId: "G-Y1MGMGQWDK"
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
let cnpjNotaAtual = ""; 
let nomeLojaCnpjAtual = "";

let pagamentosCaixa = [];
let valorFaltanteMisto = 0;
let vendaEditandoId = null;
let dataOriginalVendaEditada = null;
let horaOriginalVendaEditada = null;

let modoCarrinho = false;
let indiceCarrinhoSelecionado = -1;

let produtosPorPeso = [];
let indicePesoSelecionado = 0;
let produtoPesoVendaSelecionado = null;
let idEditandoPeso = null;

let todasContasF4 = [];
let contasFiltradasF4 = [];
let indiceContaF4 = -1;

// Variáveis de Modais Dinâmicos
let produtoAguardandoVariacao = null;
let indiceVariacaoSelecionada = 0;
let avulsosCadastrados = [];
let avulsosCadastradosFiltrados = [];
let indiceAvulsoSelecionado = 0;
let avulsoPendenteParaQuantidade = null; // Armazena o avulso antes de pedir a quantidade

let produtosPesquisaF2 = [];
let indicePesquisaF2 = -1;

let taxasMaquininha = JSON.parse(localStorage.getItem("taxasMaquininha")) || { credito: 0, debito: 0, pix: 0 };
let configImpressora = JSON.parse(localStorage.getItem("configImpressora")) || { 
    nome: "Artes e Encantos", cnpj: "28.284.202/0001-21", endereco: "Rua Campos Sales, 2191", rodape: "Obrigado!" 
};

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================
document.addEventListener("DOMContentLoaded", async () => {
    forcarLetrasMaiusculas();
    injetarModaisAvulsoDinamicos(); 
    injetarModalPesquisaProdutos(); // Adicionado para injetar o novo modal do F2

    const campoNomeFiado = document.getElementById("novofiado-nome");
    const campoNascFiado = document.getElementById("novofiado-nascimento");
    if (campoNascFiado) {
        campoNascFiado.addEventListener("change", function() {
            verificarAniversarioCadastro(this.value, campoNomeFiado ? campoNomeFiado.value : "");
        });
    }

    // Monitora a pesquisa global de produtos e avulsos
    document.body.addEventListener('input', function(e) {
        if (e.target && e.target.id === 'pesquisa-avulso-f8') {
            const termo = e.target.value.toLowerCase();
            avulsosCadastradosFiltrados = avulsosCadastrados.filter(p => p.nome.toLowerCase().includes(termo));
            indiceAvulsoSelecionado = avulsosCadastradosFiltrados.length > 0 ? 0 : -1;
            renderizarListaAvulsosCadastrados();
        }
        if (e.target && e.target.id === 'input-pesquisa-global') {
            const termo = e.target.value.toLowerCase();
            if (termo.trim() === "") {
                produtosPesquisaF2 = produtosDoBanco.slice(0, 50);
            } else {
                produtosPesquisaF2 = produtosDoBanco.filter(p => p.nome.toLowerCase().includes(termo) || (p.codigo_barras && String(p.codigo_barras).includes(termo))).slice(0, 50);
            }
            indicePesquisaF2 = produtosPesquisaF2.length > 0 ? 0 : -1;
            renderizarListaPesquisaF2();
        }
    });
});

function forcarLetrasMaiusculas() {
    const aplicarNosInputs = () => {
        document.querySelectorAll('input[type="text"], textarea').forEach(input => {
            if (!input.dataset.maiusculaConfigurada) {
                input.dataset.maiusculaConfigurada = "true";
                input.style.textTransform = "uppercase"; 
                input.addEventListener('input', function() {
                    this.value = this.value.toUpperCase();
                });
            }
        });
    };
    aplicarNosInputs();
    const observer = new MutationObserver(aplicarNosInputs);
    observer.observe(document.body, { childList: true, subtree: true });
}

// =====================================================================
// INJEÇÃO DINÂMICA (F8 E F2)
// =====================================================================
function injetarModaisAvulsoDinamicos() {
    if (!document.getElementById("modal-escolha-avulso")) {
        const modalEscolha = document.createElement("div");
        modalEscolha.id = "modal-escolha-avulso";
        modalEscolha.className = "modal-overlay";
        modalEscolha.innerHTML = `
            <div class="modal-content" style="max-width: 450px; text-align: center; border: 3px solid #0055A4; border-radius: 12px; padding: 25px; background: #fff;">
                <h3 style="color: #0055A4; margin-top: 0; font-size: 1.5rem;"><i class="fa-solid fa-box-open"></i> PRODUTO AVULSO</h3>
                <p style="color: #475569; font-weight: bold; margin-bottom: 20px;">Como deseja lançar este item?</p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button type="button" id="btn-avulso-cadastrado" onclick="abrirListaAvulsosCadastrados()" style="background: #0055A4; color: white; padding: 16px; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: 0.2s;">
                        <span><i class="fa-solid fa-list-check" style="margin-right: 10px;"></i> 1. JÁ CADASTRADO</span>
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                    <button type="button" id="btn-avulso-nahora" onclick="abrirModalAvulsoNaHora()" style="background: #10b981; color: white; padding: 16px; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: 0.2s;">
                        <span><i class="fa-solid fa-bolt" style="margin-right: 10px;"></i> 2. DIGITAR NA HORA</span>
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
                <button type="button" onclick="fecharModal('modal-escolha-avulso')" style="margin-top: 20px; background: #ef4444; color: white; padding: 10px 20px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%;">CANCELAR (ESC)</button>
            </div>
        `;
        document.body.appendChild(modalEscolha);
    }

    if (!document.getElementById("modal-lista-avulsos-banco")) {
        const modalLista = document.createElement("div");
        modalLista.id = "modal-lista-avulsos-banco";
        modalLista.className = "modal-overlay";
        modalLista.innerHTML = `
            <div class="modal-content" style="max-width: 800px; text-align: left; border: 3px solid #0055A4; border-radius: 12px; padding: 25px; background: #fff;">
                <h3 style="color: #0055A4; margin-top: 0; text-align: center; font-size: 1.4rem;"><i class="fa-solid fa-boxes-stacked"></i> AVULSOS CADASTRADOS</h3>
                <input type="text" id="pesquisa-avulso-f8" placeholder="Pesquisar avulso cadastrado..." style="width: 100%; padding: 12px; font-size: 1.2rem; border: 2px solid #b3d4ff; border-radius: 8px; margin-bottom: 15px; text-transform: uppercase;">
                <p style="color: #64748b; font-size: 0.9rem; text-align: center; margin-bottom: 15px;">Use as setas para navegar e ENTER para selecionar:</p>
                <div id="container-lista-avulsos-banco" style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 5px;"></div>
                <button type="button" onclick="fecharModal('modal-lista-avulsos-banco')" style="margin-top: 20px; background: #ef4444; color: white; padding: 12px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%;">VOLTAR (ESC)</button>
            </div>
        `;
        document.body.appendChild(modalLista);
    }
}

function injetarModalPesquisaProdutos() {
    if (!document.getElementById("modal-pesquisa-produtos")) {
        const modalPesquisa = document.createElement("div");
        modalPesquisa.id = "modal-pesquisa-produtos";
        modalPesquisa.className = "modal-overlay";
        modalPesquisa.innerHTML = `
            <div class="modal-content" style="max-width: 800px; text-align: left; border: 3px solid #0055A4; border-radius: 12px; padding: 25px; background: #fff;">
                <h3 style="color: #0055A4; margin-top: 0; text-align: center; font-size: 1.4rem;"><i class="fa-solid fa-search"></i> PESQUISAR PRODUTO GERAL (F2)</h3>
                <input type="text" id="input-pesquisa-global" placeholder="Digite o nome ou código de barras do produto..." style="width: 100%; padding: 12px; font-size: 1.2rem; border: 2px solid #b3d4ff; border-radius: 8px; margin-bottom: 15px; text-transform: uppercase;">
                <p style="color: #64748b; font-size: 0.9rem; text-align: center; margin-bottom: 15px;">Use as setas para navegar e ENTER para adicionar ao carrinho.</p>
                <div id="container-lista-pesquisa-global" style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 5px;"></div>
                <button type="button" onclick="fecharModal('modal-pesquisa-produtos')" style="margin-top: 20px; background: #ef4444; color: white; padding: 12px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%;">VOLTAR (ESC)</button>
            </div>
        `;
        document.body.appendChild(modalPesquisa);
    }
}

// =====================================================================
// BAIXA AUTOMÁTICA DE ESTOQUE
// =====================================================================
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
        valorParaRelatorio: valorVendaRegistrada,
        cliente_cpf: cpfNotaAtual 
    };
    
    try {
        for (let item of carrinho) {
            if (item.codigo_barras && !item.codigo_barras.startsWith('PESO-')) {
                const prodLocal = produtosDoBanco.find(p => p.codigo_barras === item.codigo_barras);
                if (prodLocal) {
                    if (prodLocal.variacoes && prodLocal.variacoes.length > 0) {
                        let vIdx = prodLocal.variacoes.findIndex(v => v.nome === item.variacaoNome || v.nome === item.nome);
                        if (vIdx > -1) {
                            prodLocal.variacoes[vIdx].estoque = Math.max(0, (prodLocal.variacoes[vIdx].estoque || 0) - (item.quantidade || 1));
                        }
                    }
                    prodLocal.estoque = Math.max(0, (prodLocal.estoque || 0) - (item.quantidade || 1));
                    
                    await fetch(`http://localhost:3000/api/produtos/${prodLocal.id || item.codigo_barras}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(prodLocal)
                    }).catch(() => console.warn('Falha ao atualizar o estoque.'));
                }
            }
        }

        if (vendaEditandoId) {
            await db.collection("vendas").doc(vendaEditandoId).set(vendaObj);
            await fetch(`http://localhost:3000/api/vendas/${vendaEditandoId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vendaObj)
            }).catch(() => console.log('Offline server'));
        } else {
            await db.collection("vendas").add(vendaObj);
            await fetch('http://localhost:3000/api/vendas', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vendaObj)
            }).catch(() => console.log('Offline server'));
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
        alert("Erro de conexão ao salvar a venda.");
    }

    if(imprimir === true) { imprimirNotinha(); }

    fecharModal('modal-confirmar-impressao');
    fecharModal('modal-pagamento');
    limparCaixaEVisores();
}

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

    const campoNomeFiado = document.getElementById("novofiado-nome");
    if (campoNomeFiado) {
        campoNomeFiado.addEventListener("input", function() {
            this.value = this.value.toUpperCase();
        });
    }

    const campoLeitor = document.getElementById("venda-barras");
    campoLeitor.addEventListener("keypress", function(evento) {
        if (evento.key === "Enter") {
            evento.preventDefault();
            let codigo = this.value.trim().replace(/^0+/, ''); 
            if(codigo === '') codigo = '0';
            adicionarProduto(codigo);
            this.value = ""; 
        }
    });

    // =========================================================
    // CONTROLE GLOBAL DE TECLADO (ESC, ENTER E ATALHOS)
    // =========================================================
    document.addEventListener("keydown", (e) => {
        const modalImpressaoAberto = document.getElementById('modal-confirmar-impressao').classList.contains('active');
        const modalAtivo = document.querySelector('.modal-overlay.active');

        // PRIORIDADE 1: O BOTÃO ESCAPE (FECHAR TUDO / LIMPAR)
        if (e.key === "Escape") {
            e.preventDefault();
            if (modalImpressaoAberto) {
                fecharModal('modal-confirmar-impressao');
            } else if (modalAtivo) {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
                setTimeout(() => document.getElementById("venda-barras").focus(), 50); // Garante retorno ao leitor
            } else if (modoCarrinho) {
                modoCarrinho = false;
                indiceCarrinhoSelecionado = -1;
                atualizarTela();
                document.getElementById("venda-barras").focus();
            } else {
                window.location.href = "index.html";
            }
            return; 
        }

        if (modalImpressaoAberto) {
            if (e.key === "F1") { e.preventDefault(); confirmarVendaComImpressao(true); }
            if (e.key === "F2") { e.preventDefault(); confirmarVendaComImpressao(false); }
            return; 
        }

        // TRAVA DO ENTER NOS MODAIS PRA NÃO DISPARAR O LEITOR
        if (e.key === "Enter" && modalAtivo) {
            if (modalAtivo.id === 'modal-quantidade') { e.preventDefault(); confirmarQuantidade(); return; }
            if (modalAtivo.id === 'modal-cpf') { e.preventDefault(); confirmarCPF(); return; }
            if (modalAtivo.id === 'modal-cadastrar-fiado') { e.preventDefault(); salvarNovoFiadoNoPDV(); return; }
            if (modalAtivo.id === 'modal-cnpj') { e.preventDefault(); confirmarCNPJ(); return; }
        }

        // NAVEGAÇÃO PESQUISA F2 (GLOBAL)
        if (modalAtivo && modalAtivo.id === 'modal-pesquisa-produtos') {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (indicePesquisaF2 < produtosPesquisaF2.length - 1) { indicePesquisaF2++; renderizarListaPesquisaF2(); }
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (indicePesquisaF2 > 0) { indicePesquisaF2--; renderizarListaPesquisaF2(); }
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (produtosPesquisaF2.length > 0) selecionarProdutoF2(indicePesquisaF2);
            }
            return;
        }

        // NAVEGAÇÃO MODAL DE ESCOLHA AVULSO (F8 INICIAL)
        if (modalAtivo && modalAtivo.id === 'modal-escolha-avulso') {
            if (e.key === "1" || e.key === "F1") { e.preventDefault(); abrirListaAvulsosCadastrados(); return; }
            if (e.key === "2" || e.key === "F2") { e.preventDefault(); abrirModalAvulsoNaHora(); return; }
        }

        // NAVEGAÇÃO MODAL LISTA DE AVULSOS CADASTRADOS (F8 -> 1)
        if (modalAtivo && modalAtivo.id === 'modal-lista-avulsos-banco') {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (indiceAvulsoSelecionado < avulsosCadastradosFiltrados.length - 1) {
                    indiceAvulsoSelecionado++;
                    renderizarListaAvulsosCadastrados();
                }
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (indiceAvulsoSelecionado > 0) {
                    indiceAvulsoSelecionado--;
                    renderizarListaAvulsosCadastrados();
                }
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (avulsosCadastradosFiltrados.length > 0) {
                    selecionarAvulsoCadastrado(indiceAvulsoSelecionado);
                }
            }
            return;
        }

        // OUTROS MODAIS
        if (modalAtivo && modalAtivo.id === 'modal-variacoes') {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (indiceVariacaoSelecionada < produtoAguardandoVariacao.variacoes.length - 1) {
                    indiceVariacaoSelecionada++; renderizarListaVariacoes();
                }
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (indiceVariacaoSelecionada > 0) {
                    indiceVariacaoSelecionada--; renderizarListaVariacoes();
                }
            } else if (e.key === "Enter") {
                e.preventDefault(); confirmarVariacao(indiceVariacaoSelecionada);
            }
            return;
        }

        if (modalAtivo && modalAtivo.id === 'modal-selecionar-conta') {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (indiceContaF4 < contasFiltradasF4.length - 1) { indiceContaF4++; atualizarEstilosF4(); }
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (indiceContaF4 > 0) { indiceContaF4--; atualizarEstilosF4(); }
            } else if (e.key === "Enter" && (!document.activeElement || !document.activeElement.classList.contains('btn-conta-f4'))) {
                e.preventDefault();
                if (indiceContaF4 >= 0 && contasFiltradasF4.length > 0) {
                    const c = contasFiltradasF4[indiceContaF4];
                    processarFiadoExistente(c.id, c.cliente);
                }
            }
            return;
        }

        if (modalAtivo && modalAtivo.id === 'modal-venda-peso') {
            const passo1Ativo = document.getElementById('passo-1-peso').style.display !== 'none';
            if (passo1Ativo) {
                if (e.key === "ArrowDown") { e.preventDefault(); if (indicePesoSelecionado < produtosPorPeso.length - 1) indicePesoSelecionado++; renderizarListaVendaPeso(); }
                if (e.key === "ArrowUp") { e.preventDefault(); if (indicePesoSelecionado > 0) indicePesoSelecionado--; renderizarListaVendaPeso(); }
                if (e.key === "Enter") { e.preventDefault(); selecionarProdutoPesoParaVenda(indicePesoSelecionado); }
            } else {
                if (e.key === "Enter") { e.preventDefault(); confirmarVendaPeso(); }
            }
            return;
        }

        // NAVEGAÇÃO CARRINHO (TAB)
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
            if (e.key === "ArrowDown") { e.preventDefault(); if (indiceCarrinhoSelecionado < carrinho.length - 1) indiceCarrinhoSelecionado++; atualizarTela(); }
            if (e.key === "ArrowUp") { e.preventDefault(); if (indiceCarrinhoSelecionado > 0) indiceCarrinhoSelecionado--; atualizarTela(); }
            if (e.key === "Delete") { e.preventDefault(); removerItemDoCarrinho(); }
            return; 
        }

        if (["F1", "F2", "F3", "F4", "F7", "F8", "F9", "F12"].includes(e.key)) e.preventDefault();

        // ATALHOS CAIXA LIVRE
        if (!modalAtivo && !modoCarrinho) {
            if (e.key === "F1") abrirModalCNPJ(); 
            if (e.key === "F2") abrirPesquisa();
            if (e.key === "F3") abrirQuantidade();
            if (e.key === "F4") abrirModalContas();
            if (e.key === "F7") abrirModalCPF();
            if (e.key === "F8") abrirEscolhaAvulso(); 
            if (e.key === "F9") abrirModalVendaPeso();
            if (e.key === "F12") abrirPagamento();
            if (e.key === "Delete") cancelarVenda(); 
        }

        if (modalAtivo && modalAtivo.id === 'modal-pagamento') {
            if (e.key === "F1") selecionarFormaPagamento('Dinheiro');
            if (e.key === "F2") selecionarFormaPagamento('Cartão');
            if (e.key === "F3") selecionarFormaPagamento('PIX');
        }
    });
});

function verificarAniversarioCadastro(dataNascimento, nome) {
    if (!dataNascimento) return;
    const hoje = new Date();
    const diaHoje = String(hoje.getDate()).padStart(2, '0');
    const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0');

    let diaNasc, mesNasc;
    if (dataNascimento.includes('-')) {
        const partes = dataNascimento.split('-');
        diaNasc = partes[2]; mesNasc = partes[1];
    } else if (dataNascimento.includes('/')) {
        const partes = dataNascimento.split('/');
        diaNasc = partes[0]; mesNasc = partes[1];
    }

    if (diaNasc === diaHoje && mesNasc === mesHoje) {
        const nomeCliente = nome.trim() !== "" ? nome : "Este cliente";
        setTimeout(() => {
            alert(`🎉 HOJE É O ANIVERSÁRIO DE ${nomeCliente}! 🎂\nAproveite para parabenizá-lo!`);
            const modalAtivo = document.querySelector('.modal-overlay.active');
            if (!modalAtivo) document.getElementById("venda-barras").focus();
        }, 100);
    }
}

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
    } catch(e) { console.warn("Erro ao carregar venda para edição", e); }
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
    if(document.getElementById('config-peso-preco')) IMask(document.getElementById('config-peso-preco'), configMoeda);
    
    function aplicarMascaraMoedaAutomatica(inputElement) {
        if (!inputElement) return;
        inputElement.addEventListener('input', function(e) {
            let valor = this.value.replace(/\D/g, ''); 
            if (valor === '') { this.value = ''; return; }
            valor = (parseInt(valor, 10) / 100).toFixed(2);
            valor = valor.replace('.', ',');
            valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
            this.value = valor;
        });
    }

    if(document.getElementById('avulso-valor')) aplicarMascaraMoedaAutomatica(document.getElementById('avulso-valor'));
    if(document.getElementById('rapido-valor')) aplicarMascaraMoedaAutomatica(document.getElementById('rapido-valor'));
    
    const inputPesoKg = document.getElementById('input-peso-kg');
    if (inputPesoKg) {
        inputPesoKg.addEventListener('input', function(e) {
            let valor = this.value.replace(/\D/g, ''); 
            if (valor === '') { this.value = ''; return; }
            valor = parseInt(valor, 10).toString().padStart(4, '0');
            let inteiro = valor.slice(0, -3);
            let decimal = valor.slice(-3);
            this.value = inteiro + ',' + decimal;
        });
    }

    if(document.getElementById('input-cpf-modal')) IMask(document.getElementById('input-cpf-modal'), { mask: '000.000.000-00' });
    if(document.getElementById('novofiado-cpf')) IMask(document.getElementById('novofiado-cpf'), { mask: '000.000.000-00' });
    if(document.getElementById('input-cnpj-modal')) IMask(document.getElementById('input-cnpj-modal'), { mask: '00.000.000/0000-00' });
    if(document.getElementById('novofiado-telefone')) IMask(document.getElementById('novofiado-telefone'), { mask: '(00) 00000-0000' });
}

function aplicarConfiguracoesNaTela() {
    if(document.getElementById("cupom-nome-mercado")) document.getElementById("cupom-nome-mercado").innerText = configImpressora.nome;
    if(document.getElementById("cupom-cnpj")) document.getElementById("cupom-cnpj").innerText = "CNPJ: " + configImpressora.cnpj;
    if(document.getElementById("cupom-endereco")) document.getElementById("cupom-endereco").innerText = configImpressora.endereco;
    if(document.getElementById("cupom-rodape")) document.getElementById("cupom-rodape").innerText = configImpressora.rodape;
}

function fecharModal(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.remove('active'); 
    setTimeout(() => { document.getElementById("venda-barras").focus(); }, 50);
}

// =====================================================================
// NOVA PESQUISA GLOBAL (F2)
// =====================================================================
function abrirPesquisa() {
    document.getElementById('modal-pesquisa-produtos').classList.add('active');
    const inputPesquisa = document.getElementById('input-pesquisa-global');
    inputPesquisa.value = '';
    
    produtosPesquisaF2 = produtosDoBanco.slice(0, 50); // Mostrar 50 primeiros de início
    indicePesquisaF2 = produtosPesquisaF2.length > 0 ? 0 : -1;
    
    renderizarListaPesquisaF2();
    setTimeout(() => inputPesquisa.focus(), 100);
}

function renderizarListaPesquisaF2() {
    const container = document.getElementById("container-lista-pesquisa-global");
    container.innerHTML = "";
    
    if (produtosPesquisaF2.length === 0) {
        container.innerHTML = "<p style='text-align: center; color: #ef4444; font-weight: bold; padding: 20px;'>Nenhum produto encontrado com essa pesquisa.</p>";
        return;
    }

    produtosPesquisaF2.forEach((prod, index) => {
        let selecionadoStyle = index === indicePesquisaF2 ? "background: #0055A4; color: white;" : "background: #f0f8ff; color: #003366;";
        let precoStyle = index === indicePesquisaF2 ? "white" : "#10b981";
        
        container.innerHTML += `
            <button type="button" onclick="selecionarProdutoF2(${index})" style="${selecionadoStyle} padding: 14px; border: 2px solid #b3d4ff; border-radius: 8px; font-size: 1.1rem; font-weight: bold; text-align: left; cursor: pointer; transition: 0.1s; display: flex; justify-content: space-between; align-items: center;">
                <span>${prod.nome} <small style="font-weight:normal; opacity:0.8;">(${prod.codigo_barras || 'Sem código'})</small></span>
                <span style="color: ${precoStyle}; font-weight: 900;">R$ ${parseFloat(prod.preco || 0).toFixed(2).replace('.',',')}</span>
            </button>
        `;
    });

    const btnAtivo = container.children[indicePesquisaF2];
    if (btnAtivo) btnAtivo.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function selecionarProdutoF2(index) {
    const escolhido = produtosPesquisaF2[index];
    fecharModal("modal-pesquisa-produtos");
    adicionarProduto(escolhido.codigo_barras);
}

function abrirConfigPeso() {
    idEditandoPeso = null; 
    document.getElementById('config-peso-nome').value = '';
    document.getElementById('config-peso-preco').value = '';
    document.getElementById('modal-config-peso').classList.add('active');
    renderizarListaConfigPeso();
    setTimeout(() => document.getElementById('config-peso-nome').focus(), 100);
}

async function salvarProdutoPeso() {
    const nome = document.getElementById('config-peso-nome').value.trim();
    const precoStr = document.getElementById('config-peso-preco').value.replace(/\./g, '').replace(',', '.');
    const preco = parseFloat(precoStr);

    if(!nome || !preco || preco <= 0) return alert("Preencha o nome e um preço válido!");

    const payload = { nome: nome, precoKg: preco };

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
    document.getElementById('config-peso-preco').value = '';
    renderizarListaConfigPeso();
    document.getElementById('config-peso-nome').focus();
}

function editarProdutoPeso(id, nome, preco) {
    idEditandoPeso = id;
    document.getElementById('config-peso-nome').value = nome;
    document.getElementById('config-peso-preco').value = preco.toFixed(2).replace('.', ',');
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
    if(!lista) return;
    lista.innerHTML = '';
    produtosPorPeso.forEach((prod) => {
        lista.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px; border: 1px solid #b3d4ff; background: #f8fafc; border-radius: 8px; margin-bottom: 8px;">
                <span style="font-weight: 900; color: #0055A4; font-size: 1.1rem; flex: 1;">${prod.nome}</span>
                <div style="display:flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; color: #10b981; margin-right: 10px;">R$ ${prod.precoKg.toFixed(2).replace('.',',')}/kg</span>
                    <button onclick="editarProdutoPeso(${prod.id}, '${prod.nome}', ${prod.precoKg})" title="Editar" style="background: #f59e0b; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="excluirProdutoPeso(${prod.id})" title="Excluir" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
}

function abrirModalVendaPeso() {
    if(produtosPorPeso.length === 0) {
        alert("Cadastre produtos por peso primeiro clicando no ícone de balança!");
        return;
    }
    document.getElementById('modal-venda-peso').classList.add('active');
    document.getElementById('passo-1-peso').style.display = 'block';
    document.getElementById('passo-2-peso').style.display = 'none';
    indicePesoSelecionado = 0;
    renderizarListaVendaPeso();
}

function renderizarListaVendaPeso() {
    const lista = document.getElementById('lista-peso-venda');
    if(!lista) return;
    lista.innerHTML = '';
    produtosPorPeso.forEach((prod, index) => {
        const selecionado = index === indicePesoSelecionado ? 'selecionado' : '';
        lista.innerHTML += `
            <div class="item-peso ${selecionado}" onclick="selecionarProdutoPesoParaVenda(${index})">
                <span>${prod.nome}</span>
                <span>R$ ${prod.precoKg.toFixed(2).replace('.',',')}/kg</span>
            </div>
        `;
    });
    const itemAtivo = lista.querySelector('.selecionado');
    if(itemAtivo) itemAtivo.scrollIntoView({block: "nearest"});
}

function selecionarProdutoPesoParaVenda(index) {
    produtoPesoVendaSelecionado = produtosPorPeso[index];
    document.getElementById('passo-1-peso').style.display = 'none';
    document.getElementById('passo-2-peso').style.display = 'block';
    document.getElementById('titulo-produto-selecionado').innerText = produtoPesoVendaSelecionado.nome.toUpperCase();
    document.getElementById('input-peso-kg').value = '';
    setTimeout(() => document.getElementById('input-peso-kg').focus(), 100);
}

function confirmarVendaPeso() {
    let pesoStr = document.getElementById('input-peso-kg').value.replace(/\./g, '').replace(',', '.');
    let peso = parseFloat(pesoStr);
    
    if(!peso || peso <= 0) return alert("Informe um peso válido!");

    const subtotal = produtoPesoVendaSelecionado.precoKg * peso;

    const itemVenda = {
        codigo_barras: 'PESO-' + Date.now(),
        nome: "(Kg) " + produtoPesoVendaSelecionado.nome,
        preco: produtoPesoVendaSelecionado.precoKg,
        quantidade: peso,
        subtotal: subtotal
    };

    carrinho.push(itemVenda);
    
    document.getElementById("display-nome-produto").innerText = itemVenda.nome;
    document.getElementById("display-unit").innerText = itemVenda.preco.toFixed(2).replace('.',',');
    document.getElementById("display-subtotal").innerText = itemVenda.subtotal.toFixed(2).replace('.',',');

    multiplicadorAtual = 1;
    atualizarVisorQuantidade();
    atualizarTela();
    fecharModal('modal-venda-peso');
}

// =====================================================================
// PRODUTOS AVULSOS (F8)
// =====================================================================
function abrirEscolhaAvulso() {
    document.getElementById("modal-escolha-avulso").classList.add("active");
}

function abrirListaAvulsosCadastrados() {
    fecharModal("modal-escolha-avulso");
    avulsosCadastrados = produtosDoBanco.filter(p => 
        (p.codigo_barras && String(p.codigo_barras).startsWith('AVULSO-')) || 
        p.categoria === 'AVULSOS' || 
        (p.nome && p.nome.includes('AVULSO'))
    );
    
    avulsosCadastradosFiltrados = [...avulsosCadastrados];
    indiceAvulsoSelecionado = 0;
    renderizarListaAvulsosCadastrados();
    
    document.getElementById("modal-lista-avulsos-banco").classList.add("active");
    
    setTimeout(() => {
        const inputF8 = document.getElementById("pesquisa-avulso-f8");
        if (inputF8) { inputF8.value = ""; inputF8.focus(); }
    }, 100);
}

function renderizarListaAvulsosCadastrados() {
    const container = document.getElementById("container-lista-avulsos-banco");
    container.innerHTML = "";

    if (avulsosCadastradosFiltrados.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: #ef4444; font-weight: bold; padding: 20px;">Nenhum avulso encontrado na pesquisa ou sem estoque.</p>`;
        return;
    }

    avulsosCadastradosFiltrados.forEach((prod, index) => {
        let selecionadoStyle = index === indiceAvulsoSelecionado ? "background: #0055A4; color: white;" : "background: #f0f8ff; color: #003366;";
        let precoStyle = index === indiceAvulsoSelecionado ? "white" : "#10b981";
        
        // Remove limpa a palavra (AVULSO) para mostrar bonitinho
        let nomeLimpo = prod.nome.replace(/\(AVULSO\)\s*/g, '').trim();

        container.innerHTML += `
            <button type="button" onclick="selecionarAvulsoCadastrado(${index})" style="${selecionadoStyle} padding: 14px; border: 2px solid #b3d4ff; border-radius: 8px; font-size: 1.1rem; font-weight: bold; text-align: left; cursor: pointer; transition: 0.1s; display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fa-solid fa-tag" style="margin-right: 8px;"></i> ${nomeLimpo}</span>
                <span style="color: ${precoStyle}; font-weight: 900;">R$ ${parseFloat(prod.preco || 0).toFixed(2).replace('.',',')}</span>
            </button>
        `;
    });

    const btnAtivo = container.children[indiceAvulsoSelecionado];
    if (btnAtivo) btnAtivo.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function selecionarAvulsoCadastrado(index) {
    const escolhido = avulsosCadastradosFiltrados[index];
    fecharModal("modal-lista-avulsos-banco");
    
    // Salva pendente para abrir e pedir a quantidade
    avulsoPendenteParaQuantidade = escolhido;
    abrirQuantidade();
}

function abrirModalAvulsoNaHora() {
    fecharModal("modal-escolha-avulso");
    document.getElementById("avulso-nome").value = "";
    document.getElementById("avulso-valor").value = "";
    document.getElementById("modal-avulso").classList.add("active");
    setTimeout(() => document.getElementById("avulso-nome").focus(), 100);
}

async function confirmarAvulso() {
    let nome = document.getElementById("avulso-nome").value.trim();
    let valStr = document.getElementById("avulso-valor").value.replace(/\./g, '').replace(',', '.');
    let preco = parseFloat(valStr);

    if (!nome || !preco || preco <= 0) return alert("Preencha o nome e um valor válido!");

    let codigoGerado = 'AVULSO-' + Date.now();
    // AQUI RETIRAMOS O TEXTO "(AVULSO)" DA FRENTE DA PALAVRA NA NOTA!
    let nomeFormatado = nome.toUpperCase();

    // === CADASTRO AUTOMÁTICO NO ESTOQUE ===
    const novoAvulsoEstoque = {
        codigo_barras: codigoGerado,
        nome: nomeFormatado,
        categoria: "AVULSOS",
        marca: "AVULSO",
        unidade: "UN",
        variacoes: [{ nome: nomeFormatado, preco: preco, estoque: 9999 }],
        preco: preco,
        estoque: 9999
    };

    try {
        await fetch("http://localhost:3000/api/produtos", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(novoAvulsoEstoque)
        });
        produtosDoBanco.push(novoAvulsoEstoque);
    } catch(e) { console.warn("Erro ao salvar avulso automaticamente no banco."); }
    // ======================================

    fecharModal("modal-avulso");
    
    // Deixa salvo pendente e abre a tela de pedir a quantidade
    avulsoPendenteParaQuantidade = novoAvulsoEstoque;
    abrirQuantidade();
}
// =====================================================================

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

async function confirmarCPF() {
    let cpf = document.getElementById('input-cpf-modal').value.trim();
    
    if (!cpf || cpf.length < 14) { 
        cpfNotaAtual = "";
        document.getElementById("cupom-cpf-cliente").innerText = "Não informado";
        document.getElementById("display-cpf-nota").innerText = "Não informado";
        fecharModal('modal-cpf');
        return;
    }

    try {
        const resp = await fetch('http://localhost:3000/api/fiados');
        const clientes = await resp.json();
        const clienteEncontrado = clientes.find(c => c.cpf === cpf);

        if (clienteEncontrado) {
            cpfNotaAtual = cpf;
            document.getElementById("cupom-cpf-cliente").innerText = cpf;
            document.getElementById("display-cpf-nota").innerText = `${cpf} (${clienteEncontrado.cliente})`;
            fecharModal('modal-cpf');
        } else {
            alert("CPF não encontrado! Por favor, cadastre os dados do cliente.");
            fecharModal('modal-cpf');
            
            window.cadastrandoPeloCPF = true; 
            abrirModalCadastrarFiado(cpf); 
        }
    } catch (e) { alert("Erro ao consultar CPF no banco de dados."); }
}

function abrirModalCNPJ() {
    document.getElementById('modal-cnpj').classList.add('active');
    setTimeout(() => {
        const input = document.getElementById('input-cnpj-modal');
        input.value = cnpjNotaAtual; 
        input.focus();
    }, 100);
}

async function confirmarCNPJ() {
    let cnpj = document.getElementById('input-cnpj-modal').value.trim();
    
    if (!cnpj || cnpj.length < 18) { 
        cnpjNotaAtual = "";
        nomeLojaCnpjAtual = "";
        document.getElementById("cupom-cnpj-cliente").innerText = "Não informado";
        document.getElementById("display-cnpj-nota").innerText = "Não informado";
        fecharModal('modal-cnpj');
        return;
    }

    try {
        const resp = await fetch('http://localhost:3000/api/fiados');
        const clientes = await resp.json();
        const lojaEncontrada = clientes.find(c => c.cpf === cnpj); 

        if (lojaEncontrada) {
            cnpjNotaAtual = cnpj;
            nomeLojaCnpjAtual = lojaEncontrada.cliente;
            document.getElementById("cupom-cnpj-cliente").innerText = `${cnpj} - ${nomeLojaCnpjAtual}`;
            document.getElementById("display-cnpj-nota").innerText = `${cnpj} (${nomeLojaCnpjAtual})`;
            fecharModal('modal-cnpj');
        } else {
            fecharModal('modal-cnpj');
            abrirModalCadastrarCNPJ(cnpj);
        }
    } catch (e) { alert("Erro ao consultar CNPJ no banco de dados."); }
}

function abrirModalCadastrarCNPJ(cnpjSugerido) {
    document.getElementById("novocnpj-nome").value = "";
    document.getElementById("novocnpj-cnpj").value = cnpjSugerido;
    document.getElementById('modal-cadastrar-cnpj').classList.add('active');
    setTimeout(() => document.getElementById("novocnpj-nome").focus(), 100);
}

async function salvarNovoCNPJ() {
    const nomeLoja = document.getElementById("novocnpj-nome").value.trim().toUpperCase();
    const cnpj = document.getElementById("novocnpj-cnpj").value.trim();

    if (!nomeLoja) return alert("O Nome da Loja é obrigatório!");

    const novaLoja = {
        cliente: nomeLoja, cpf: cnpj, telefone: "Não informado",
        endereco: "Cadastrado no Caixa", dataCompra: new Date().toLocaleDateString('pt-BR'),
        dataPagamento: "A combinar", total: 0, valorPago: 0, itens: [], aniversario: "Não informado"
    };

    try {
        await fetch('http://localhost:3000/api/fiados', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novaLoja)
        });
        
        fecharModal('modal-cadastrar-cnpj');
        cnpjNotaAtual = cnpj;
        nomeLojaCnpjAtual = nomeLoja;
        
        document.getElementById("cupom-cnpj-cliente").innerText = `${cnpj} - ${nomeLoja}`;
        document.getElementById("display-cnpj-nota").innerText = `${cnpj} (${nomeLoja})`;
        
    } catch(e) { alert("Erro ao cadastrar a loja no sistema."); }
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

    // Se a gente veio pelo Avulso novo, aplica ele na compra agora de forma automática
    if (avulsoPendenteParaQuantidade) {
        adicionarProduto(avulsoPendenteParaQuantidade.codigo_barras);
        avulsoPendenteParaQuantidade = null;
    }
}

function atualizarVisorQuantidade() {
    document.getElementById("display-qtd").innerText = multiplicadorAtual.toFixed(3).replace('.',',');
}

function adicionarProduto(codigoBarras) {
    const produto = produtosDoBanco.find(p => p.codigo_barras === codigoBarras);
    if (produto) {
        if (produto.variacoes && produto.variacoes.length > 1) {
            abrirModalVariacoes(produto);
        } else {
            let precoFinal = produto.preco;
            let nomeFinal = produto.nome;
            if (produto.variacoes && produto.variacoes.length === 1) {
                precoFinal = produto.variacoes[0].preco;
                nomeFinal = produto.variacoes[0].nome;
            }
            inserirNoCarrinho(produto, nomeFinal, precoFinal);
        }
    } else {
        abrirCadastroRapido(codigoBarras);
    }
}

function inserirNoCarrinho(produtoOriginal, nomeVariacao, precoVariacao) {
    // Retira qualquer rastro de "AVULSO" do nome caso seja um produto antigo cadastrado assim
    let nomeFinal = nomeVariacao.replace(/\(AVULSO\)\s*/g, '').trim();

    const itemExistente = carrinho.find(i => i.codigo_barras === produtoOriginal.codigo_barras && i.nome === nomeFinal);
    
    if (itemExistente) {
        itemExistente.quantidade += multiplicadorAtual; 
        itemExistente.subtotal = itemExistente.quantidade * itemExistente.preco;
    } else {
        carrinho.push({ 
            ...produtoOriginal, 
            nome: nomeFinal,
            preco: precoVariacao,
            quantidade: multiplicadorAtual, 
            subtotal: precoVariacao * multiplicadorAtual,
            variacaoNome: nomeFinal 
        });
    }
    
    document.getElementById("display-nome-produto").innerText = nomeFinal;
    document.getElementById("display-unit").innerText = parseFloat(precoVariacao).toFixed(2).replace('.',',');
    document.getElementById("display-subtotal").innerText = (parseFloat(precoVariacao) * multiplicadorAtual).toFixed(2).replace('.',',');
    
    atualizarTela();
    multiplicadorAtual = 1; 
    atualizarVisorQuantidade();
}

function abrirModalVariacoes(produto) {
    produtoAguardandoVariacao = produto;
    indiceVariacaoSelecionada = 0;
    document.getElementById("variacao-nome-produto").innerText = produto.nome;
    
    renderizarListaVariacoes();
    document.getElementById("modal-variacoes").classList.add("active");
}

function renderizarListaVariacoes() {
    const lista = document.getElementById("lista-variacoes");
    lista.innerHTML = "";
    
    produtoAguardandoVariacao.variacoes.forEach((v, index) => {
        let btnCor = index === indiceVariacaoSelecionada ? "background: #0055A4; color: white;" : "background: #f0f8ff; color: #003366;";
        let textoPreco = index === indiceVariacaoSelecionada ? "white" : "#10b981";
        
        lista.innerHTML += `
            <button type="button" onclick="confirmarVariacao(${index})" style="${btnCor} padding: 15px; border: 2px solid #b3d4ff; border-radius: 6px; font-size: 1.2rem; font-weight: bold; text-align: left; cursor: pointer; transition: 0.2s; display: flex; justify-content: space-between;">
                <span>${v.nome}</span>
                <span style="color: ${textoPreco};">R$ ${parseFloat(v.preco).toFixed(2).replace('.',',')}</span>
            </button>
        `;
    });
}

function confirmarVariacao(index) {
    let varEscolhida = produtoAguardandoVariacao.variacoes[index];
    fecharModal("modal-variacoes");
    inserirNoCarrinho(produtoAguardandoVariacao, varEscolhida.nome, varEscolhida.preco);
    produtoAguardandoVariacao = null;
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

    valorTotal = Math.round(valorTotal * 100) / 100;

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
    if (carrinho.length > 0 && confirm("Deseja realmente CANCELAR o carrinho atual?")) {
        limparCaixaEVisores();
    }
    setTimeout(() => { document.getElementById("venda-barras").focus(); }, 50);
}

function limparCaixaEVisores() {
    carrinho = []; valorTotal = 0; multiplicadorAtual = 1;
    contaFiadoOriginal_id = null; 
    cpfNotaAtual = "";
    nomeLojaCnpjAtual = ""; 
    modoCarrinho = false; indiceCarrinhoSelecionado = -1;
    vendaEditandoId = null;
    window.cadastrandoPeloCPF = false;
    document.getElementById("status-fiado-carregado").style.display = "none";
    document.getElementById("display-nome-produto").innerText = "CAIXA LIVRE";
    document.getElementById("display-unit").innerText = "0,00";
    document.getElementById("display-subtotal").innerText = "0,00";
    document.getElementById("cupom-cpf-cliente").innerText = "Não informado";
    document.getElementById("display-cpf-nota").innerText = "Não informado";
    document.getElementById("cupom-cnpj-cliente").innerText = "Não informado"; 
    document.getElementById("display-cnpj-nota").innerText = "Não informado"; 
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
    if (forma === 'Cartão') document.getElementById('btn-pgto-cartao').classList.add('active');
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
    
    valorFaltanteMisto = Math.round((valorTotal - totalPagoNaVenda) * 100) / 100;
    
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

function imprimirNotinha() {
    const recibo = document.getElementById("recibo-impressao");
    
    let htmlRecibo = `
        <div style="font-weight: bold; width: 95%; margin: 0 auto; padding-right: 4px;">
            <div style="text-align: center; margin-bottom: 10px;">
                <h2 style="margin: 0;">${configImpressora.nome}</h2>
                <p style="margin: 0; font-size: 11px;">CNPJ: ${configImpressora.cnpj}</p>
                <p style="margin: 0; font-size: 11px;">${configImpressora.endereco}</p>
                <p style="margin: 5px 0;">--------------------------------</p>
                <h3 style="margin: 0;">CUPOM FISCAL</h3>
                <p style="margin: 5px 0;">--------------------------------</p>
            </div>
            
            <table style="width: 100%; text-align: left; font-size: 10px; font-weight: bold; margin-bottom: 10px; border-collapse: collapse; table-layout: fixed;">
                <tr>
                    <th style="width: 15%; border-bottom: 1px dashed #000;">QTD</th>
                    <th style="width: 45%; border-bottom: 1px dashed #000;">DESC.</th>
                    <th style="width: 40%; text-align: right; border-bottom: 1px dashed #000; padding-right: 2px;">TOTAL</th>
                </tr>
    `;

    carrinho.forEach(item => {
        let qtd = Number.isInteger(item.quantidade) ? item.quantidade : item.quantidade.toFixed(3);
        let nomeLimitado = item.nome; 
        htmlRecibo += `
            <tr>
                <td style="vertical-align: top; padding-top: 3px;">${qtd}</td>
                <td style="padding-top: 3px; word-wrap: break-word;">${nomeLimitado}</td>
                <td style="text-align: right; vertical-align: top; padding-top: 3px; padding-right: 2px;">R$ ${item.subtotal.toFixed(2).replace('.',',')}</td>
            </tr>
        `;
    });

    htmlRecibo += `
            </table>
            <p style="margin: 5px 0; text-align: center;">--------------------------------</p>
            <h2 style="text-align: right; margin: 5px 0; font-size: 14px; padding-right: 2px;">TOTAL: R$ ${valorTotal.toFixed(2).replace('.',',')}</h2>
            <div style="font-size: 11px; margin-top: 10px; font-weight: bold;">
    `;
    
    pagamentosCaixa.forEach(p => {
        htmlRecibo += `<div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span style="padding-left: 2px;">PAGO EM ${p.forma.toUpperCase()}</span><span style="padding-right: 2px;">R$ ${p.valor.toFixed(2).replace('.',',')}</span></div>`;
    });
    
    let totalPago = pagamentosCaixa.reduce((acc, p) => acc + p.valor, 0);
    let troco = totalPago - valorTotal;
    let falta = valorTotal - totalPago;

    if(troco > 0) {
         htmlRecibo += `<div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px;"><span style="padding-left: 2px;">TROCO</span><span style="padding-right: 2px;">R$ ${troco.toFixed(2).replace('.',',')}</span></div>`;
    } else if (falta > 0 && contaFiadoOriginal_id) {
         htmlRecibo += `<div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px; color: #000;"><span style="padding-left: 2px;">FICOU DEVENDO</span><span style="padding-right: 2px;">R$ ${falta.toFixed(2).replace('.',',')}</span></div>`;
    }

    let textoCnpj = cnpjNotaAtual ? `${cnpjNotaAtual} (${nomeLojaCnpjAtual})` : 'Não informado';

    htmlRecibo += `
            </div>
            <p style="margin: 15px 0 5px 0; text-align: center;">--------------------------------</p>
            <p style="text-align: center; font-size: 11px;">${configImpressora.rodape}</p>
            <p style="text-align: center; font-size: 11px; margin-top: 5px; border: 1px dashed #000; padding: 4px;">CPF DO CONSUMIDOR: ${cpfNotaAtual || 'Não informado'}</p>
            <p style="text-align: center; font-size: 11px; margin-top: 5px; border: 1px dashed #000; padding: 4px;">CNPJ DA LOJA: ${textoCnpj}</p>
        </div>
    `;

    recibo.innerHTML = htmlRecibo;
    window.print();
    setTimeout(() => { document.getElementById("venda-barras").focus(); }, 100);
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
    if (!confirm(`Deseja salvar o carrinho atual na conta de ${cliente}?`)) {
        setTimeout(() => { document.getElementById("venda-barras").focus(); }, 50);
        return;
    }

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

function abrirModalCadastrarFiado(cpfSugerido = "") {
    document.getElementById("novofiado-nome").value = "";
    document.getElementById("novofiado-cpf").value = cpfSugerido; 
    document.getElementById("novofiado-telefone").value = "";
    
    const campoNasc = document.getElementById("novofiado-nascimento");
    if (campoNasc) campoNasc.value = "";

    document.getElementById('modal-cadastrar-fiado').classList.add('active');
    setTimeout(() => document.getElementById("novofiado-nome").focus(), 100);
}

async function salvarNovoFiadoNoPDV() {
    const nome = document.getElementById("novofiado-nome").value.trim();
    const cpf = document.getElementById("novofiado-cpf").value.trim();
    const telefone = document.getElementById("novofiado-telefone").value.trim();
    const nascimento = document.getElementById("novofiado-nascimento") ? document.getElementById("novofiado-nascimento").value.trim() : "";

    if (!nome) return alert("O Nome é obrigatório!");

    const itensParaConta = window.cadastrandoPeloCPF ? [] : [...carrinho];
    const totalParaConta = window.cadastrandoPeloCPF ? 0 : valorTotal;

    const novaConta = {
        cliente: nome, cpf: cpf || "Não informado", telefone: telefone || "Não informado",
        endereco: "Cadastrado no Caixa", dataCompra: new Date().toLocaleDateString('pt-BR'),
        dataPagamento: "A combinar", total: totalParaConta, valorPago: 0, itens: itensParaConta,
        aniversario: nascimento || "Não informado" 
    };

    try {
        await fetch('http://localhost:3000/api/fiados', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novaConta)
        });
        alert(`Conta/Cliente criado e vinculado para ${nome}!`);
        
        fecharModal('modal-cadastrar-fiado');
        
        if (window.cadastrandoPeloCPF) {
            cpfNotaAtual = cpf;
            document.getElementById("cupom-cpf-cliente").innerText = cpf || "Não informado";
            document.getElementById("display-cpf-nota").innerText = cpf ? `${cpf} (${nome})` : "Não informado";
            window.cadastrandoPeloCPF = false; 
        } else {
            fecharModal('modal-selecionar-conta'); 
            limparCaixaEVisores();
        }
    } catch(e) { alert("Erro ao criar conta."); }
    setTimeout(() => { document.getElementById("venda-barras").focus(); }, 100);
}

function abrirConfiguracoes() { document.getElementById('modal-taxas').classList.add('active'); }
function salvarTaxas() { fecharModal('modal-taxas'); }
function abrirConfigImpressora() { document.getElementById('modal-config-impressora').classList.add('active'); }
function salvarConfigImpressora() { fecharModal('modal-config-impressora'); }

// js/contas.js
let contaSendoPagaId = null;
let totalContaAtual = 0;
let valorPagoAtual = 0;
let nomeClientePagando = "";
document.addEventListener("DOMContentLoaded", async () => {
    // ... manter códigos de inicialização existentes ...
    forcarLetrasMaiusculas();
});

// Forçador de letras maiúsculas idêntico para manter o padrão no Contas
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

// Função chamada para renderizar as linhas do histórico de compras da pessoa
// certifique-se de ajustar a sua função que lista os itens para injetar o HTML dos botões abaixo:
function preencherLinhasDoHistorico(vendasDoCliente) {
    const containerHistorico = document.getElementById("container-itens-historico-cliente"); // ajuste para o ID do seu HTML
    if (!containerHistorico) return;
    containerHistorico.innerHTML = "";

    if (vendasDoCliente.length === 0) {
        containerHistorico.innerHTML = "<p>Nenhuma venda encontrada para este perfil.</p>";
        return;
    }

    vendasDoCliente.forEach(v => {
        let descItens = v.itens ? v.itens.map(i => `${i.quantidade}x ${i.nome}`).join(", ") : "Sem descrição";
        
        containerHistorico.innerHTML += `
            <div class="notif-item info" style="border-left: 5px solid #0055A4; margin-bottom: 10px; padding: 10px; background: #f8fafc; border-radius:6px;">
                <p><strong>Data:</strong> ${v.data} às ${v.hora} — <strong>Total:</strong> R$ ${v.total.toFixed(2).replace('.', ',')}</p>
                <small style="display:block; margin-bottom: 8px; color:#555;">Itens: ${descItens}</small>
                
                <div style="display:flex; gap: 8px;">
                    <button onclick="editarVendaNoCaixa('${v.id}')" style="background: #f59e0b; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size:0.8rem;">
                        <i class="fa-solid fa-pen"></i> Editar no Caixa
                    </button>
                    <button onclick="excluirVendaDoCliente('${v.id}')" style="background: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size:0.8rem;">
                        <i class="fa-solid fa-trash"></i> Excluir Venda
                    </button>
                </div>
            </div>
        `;
    });
}

// Redireciona para o Caixa abrindo o modo edição da venda selecionada
function editarVendaNoCaixa(idVenda) {
    if (confirm("Deseja realmente abrir esta nota no CAIXA para editá-la?")) {
        localStorage.setItem("editandoVendaId", idVenda);
        window.location.href = "vendas.html";
    }
}

// Exclui a venda da pessoa e remove AUTOMATICAMENTE dos relatórios (Firebase Firestore)
async function excluirVendaDoCliente(idVenda) {
    if (confirm("ATENÇÃO! Deseja EXCLUIR DEFINITIVAMENTE esta venda?\n\nEla será deletada automaticamente dos relatórios e do histórico.")) {
        try {
            // Remove do Firestore (interligando com o relatorios.js)
            await db.collection("vendas").doc(idVenda).delete();
            alert("Venda excluída com sucesso!");
            
            // Recarrega as contas e fecha o modal de histórico para atualizar os visores
            await renderizarContas();
            fecharModal('modal-historico-cliente');
        } catch (e) {
            alert("Erro ao tentar excluir a venda do servidor de relatórios.");
            console.error(e);
        }
    }
}
document.addEventListener("DOMContentLoaded", async () => {
    configurarMascaras();
    document.getElementById("fiado-data-compra").value = formatarDataBR(new Date());
    await renderizarContas();
    const btnConfirmar = document.getElementById("btn-confirmar-baixa");
    if(btnConfirmar) btnConfirmar.addEventListener("click", confirmarBaixa);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { fecharModal('modal-nova-conta'); fecharModal('modal-pagamento'); fecharModal('modal-historico-cliente'); }
        if (e.key === "F2") { e.preventDefault(); abrirModal('modal-nova-conta'); }
    });
    
    // Cria o HTML do Modal de Histórico na tela caso não exista
    criarModalHistoricoDinamico();
});

function configurarMascaras() {
    const configMoeda = { mask: Number, scale: 2, signed: false, thousandsSeparator: '.', padFractionalZeros: true, normalizeZeros: true, radix: ',' };
    ['fiado-data-compra', 'fiado-data-pagamento', 'data-baixa-pagamento', 'fiado-aniversario'].forEach(id => {
        const el = document.getElementById(id);
        if(el) IMask(el, { mask: '00/00/0000' });
    });
    IMask(document.getElementById('fiado-cpf'), { mask: '000.000.000-00' });
    IMask(document.getElementById('fiado-telefone'), { mask: '(00) 00000-0000' });
    if(document.getElementById('valor-pagando-agora')) IMask(document.getElementById('valor-pagando-agora'), configMoeda);
}

function formatarDataBR(date) {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function abrirModal(id) {
    document.getElementById(id).classList.add('active');
    if (id === 'modal-nova-conta') setTimeout(() => document.getElementById('fiado-nome').focus(), 100);
}

function fecharModal(id) { document.getElementById(id).classList.remove('active'); }

async function salvarConta() {
    const nome = document.getElementById("fiado-nome").value.trim();
    if (!nome) { alert("O Nome do Cliente é obrigatório!"); return document.getElementById("fiado-nome").focus(); }

    const novaConta = {
        cliente: nome,
        cpf: document.getElementById("fiado-cpf").value.trim() || "Não informado",
        telefone: document.getElementById("fiado-telefone").value.trim() || "Não informado",
        endereco: document.getElementById("fiado-endereco").value.trim() || "Não informado",
        dataCompra: document.getElementById("fiado-data-compra").value,
        dataPagamento: document.getElementById("fiado-data-pagamento").value || "A combinar",
        aniversario: (document.getElementById("fiado-aniversario")?.value.trim()) || "Não informado",
        total: 0, valorPago: 0, itens: [] 
    };

    try {
        await fetch('http://localhost:3000/api/fiados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novaConta) });
        ["fiado-nome","fiado-cpf","fiado-telefone","fiado-endereco","fiado-data-pagamento","fiado-aniversario"].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).value = "";
        });
        fecharModal('modal-nova-conta'); await renderizarContas(); 
    } catch (e) { alert("Erro ao salvar conta."); }
}

async function renderizarContas() {
    const container = document.getElementById("container-devedores");
    container.innerHTML = "<p style='text-align:center; color:#fff;'>Carregando contas...</p>";

    try {
        const resp = await fetch('http://localhost:3000/api/fiados');
        const contas = await resp.json();
        container.innerHTML = "";

        if (contas.length === 0) return container.innerHTML = `<div style="text-align: center; padding: 40px; background: #fff; border-radius: 8px;">Nenhum cliente cadastrado.</div>`;

        const hojeData = new Date();
        const diaHoje = String(hojeData.getDate()).padStart(2, '0');
        const mesHoje = String(hojeData.getMonth() + 1).padStart(2, '0');

        contas.forEach(conta => {
            let falta = conta.total - (conta.valorPago || 0);
            let avisoAniversario = "";
            
            if (conta.aniversario && conta.aniversario !== "Não informado") {
                const [diaAniv, mesAniv] = conta.aniversario.split('/'); 
                if (diaAniv === diaHoje && mesAniv === mesHoje) {
                    avisoAniversario = `<div style="background: #f59e0b; color: white; padding: 6px; border-radius: 6px; font-size: 0.85rem; font-weight: bold; margin-bottom: 10px; text-align: center;"><i class="fa-solid fa-cake-candles"></i> Hoje é aniversário! 🎉</div>`;
                }
            }

            // O botão "Ver Histórico" foi adicionado aqui!
            container.innerHTML += `
                <div class="devedor-card">
                    ${avisoAniversario}
                    <div class="devedor-header">
                        <h3><i class="fa-solid fa-user" style="color:#0055A4; margin-right:8px;"></i>${conta.cliente}</h3>
                        <span class="devedor-total">R$ ${conta.total.toFixed(2).replace('.', ',')}</span>
                    </div>

                    <div class="devedor-info">
                        <div><i class="fa-solid fa-address-card"></i> CPF: ${conta.cpf}</div>
                        <div><i class="fa-solid fa-phone"></i> ${conta.telefone}</div>
                        ${conta.aniversario && conta.aniversario !== 'Não informado' ? `<div><i class="fa-solid fa-cake-candles"></i> Nasc: ${conta.aniversario}</div>` : ''}
                        <div style="color: #ef4444; margin-top: 5px;"><i class="fa-solid fa-circle-exclamation"></i> Falta Pagar: R$ ${falta.toFixed(2).replace('.', ',')}</div>
                        
                        <button onclick="abrirHistoricoCliente('${conta.cpf}', '${conta.cliente}')" style="margin-top: 10px; width: 100%; padding: 5px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
                            <i class="fa-solid fa-clock-rotate-left"></i> Ver Histórico de Compras
                        </button>
                    </div>

                    <div style="display: flex; gap: 8px; margin-top: 10px;">
                        <button class="btn-pagar-conta" style="background: #0055A4; color: white; border: none; flex: 1;" onclick="window.location.href='vendas.html?fiado_id=${conta.id}'">
                            <i class="fa-solid fa-cash-register"></i> ABRIR NO CAIXA
                        </button>
                        <button class="btn-pagar-conta" style="background: #ef4444; color: white; border: none; width: 50px; padding: 0;" onclick="abrirModalQuitacao(${conta.id}, '${conta.cliente}', ${conta.total}, ${conta.valorPago || 0})" title="Baixa / Receber">
                            <i class="fa-solid fa-hand-holding-dollar"></i>
                        </button>
                    </div>
                </div>`;
        });
    } catch (e) { container.innerHTML = "<p style='color:red;'>Erro de conexão.</p>"; }
}

// ========= LÓGICA DE HISTÓRICO DE COMPRAS =========
function criarModalHistoricoDinamico() {
    if(document.getElementById('modal-historico-cliente')) return;
    const modalHTML = `
        <div id="modal-historico-cliente" class="modal-overlay">
            <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <h2 id="titulo-historico" style="color: #0055A4; margin-bottom: 15px;">Histórico</h2>
                <div id="lista-historico-vendas" style="display: flex; flex-direction: column; gap: 10px;"></div>
                <button onclick="fecharModal('modal-historico-cliente')" style="margin-top:20px; width:100%; padding: 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">FECHAR (ESC)</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}


async function abrirHistoricoCliente(cpf, nome) {
    if(!cpf || cpf === "Não informado" || cpf.length < 10) return alert("Cliente não possui CPF válido cadastrado para busca de histórico.");
    
    document.getElementById("titulo-historico").innerText = `Histórico: ${nome}`;
    const lista = document.getElementById("lista-historico-vendas");
    lista.innerHTML = "<p>Buscando compras...</p>";
    abrirModal('modal-historico-cliente');

    try {
        const resp = await fetch(`http://localhost:3000/api/vendas/cliente/${cpf}`);
        const vendas = await resp.json();
        
        if(vendas.length === 0) {
            lista.innerHTML = "<p style='color: red;'>Nenhuma compra registrada com este CPF.</p>";
            return;
        }

        lista.innerHTML = "";
        vendas.forEach(v => {
            let descItens = v.itens.map(i => `${i.quantidade}x ${i.nome}`).join(", ");
            lista.innerHTML += `
                <div style="border: 1px solid #ccc; padding: 10px; border-radius: 6px; background: #f8fafc;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 5px;">
                        <span>Data: ${v.data} - ${v.hora}</span>
                        <span style="color: #10b981;">R$ ${v.totalLiquido.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div style="font-size: 0.85rem; color: #555;">
                        <strong>Pagamento:</strong> ${v.pagamento}<br>
                        <strong>Itens:</strong> ${descItens}
                    </div>
                </div>
            `;
        });
    } catch(e) {
        lista.innerHTML = "<p>Erro ao buscar histórico.</p>";
    }
}

// ================= RESTANTE DAS FUNÇÕES (BAIXA) =================
function abrirModalQuitacao(idConta, nomeCliente, totalDaConta, jaPago) {
    contaSendoPagaId = idConta; totalContaAtual = totalDaConta; valorPagoAtual = jaPago || 0; nomeClientePagando = nomeCliente;
    let faltaPagar = totalContaAtual - valorPagoAtual;
    document.getElementById("texto-confirmacao-pagamento").innerHTML = `Receber de: <strong>${nomeCliente}</strong>`;
    document.getElementById("valor-devido-atual").innerText = `R$ ${faltaPagar.toFixed(2).replace('.', ',')}`;
    document.getElementById("valor-pagando-agora").value = faltaPagar.toFixed(2).replace('.', ',');
    document.getElementById("data-baixa-pagamento").value = formatarDataBR(new Date());
    abrirModal('modal-pagamento');
}

async function confirmarBaixa() {
    if (!contaSendoPagaId) return;
    let valStr = document.getElementById('valor-pagando-agora').value.replace(/\./g, '').replace(',', '.');
    let valorDigitado = parseFloat(valStr);
    if (isNaN(valorDigitado) || valorDigitado <= 0) return alert("Valor inválido!");

    let faltaPagar = totalContaAtual - valorPagoAtual;
    try {
        if (valorDigitado >= faltaPagar) {
            await fetch(`http://localhost:3000/api/fiados/${contaSendoPagaId}`, { method: 'DELETE' });
            alert("Conta totalmente quitada!");
        } else {
            const resp = await fetch(`http://localhost:3000/api/fiados/${contaSendoPagaId}`);
            const conta = await resp.json();
            conta.valorPago = valorPagoAtual + valorDigitado;
            await fetch(`http://localhost:3000/api/fiados/${contaSendoPagaId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(conta) });
            alert("Pagamento abatido!");
        }
        contaSendoPagaId = null; fecharModal('modal-pagamento'); await renderizarContas(); 
    } catch (e) { alert("Erro ao processar baixa."); }
}
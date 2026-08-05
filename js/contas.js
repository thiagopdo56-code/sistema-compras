// js/contas.js

let contaSendoPagaId = null;
let totalContaAtual = 0;
let valorPagoAtual = 0;
let nomeClientePagando = "";

document.addEventListener("DOMContentLoaded", async () => {
    configurarMascaras();

    const hoje = new Date();
    document.getElementById("fiado-data-compra").value = formatarDataBR(hoje);

    await renderizarContas();

    const btnConfirmar = document.getElementById("btn-confirmar-baixa");
    if(btnConfirmar) btnConfirmar.addEventListener("click", confirmarBaixa);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            fecharModal('modal-nova-conta');
            fecharModal('modal-pagamento');
        }
        if (e.key === "F2") {
            e.preventDefault();
            abrirModal('modal-nova-conta');
        }
    });
});

function configurarMascaras() {
    const configMoeda = { mask: Number, scale: 2, signed: false, thousandsSeparator: '.', padFractionalZeros: true, normalizeZeros: true, radix: ',' };
    IMask(document.getElementById('fiado-data-compra'), { mask: '00/00/0000' });
    IMask(document.getElementById('fiado-data-pagamento'), { mask: '00/00/0000' });
    IMask(document.getElementById('data-baixa-pagamento'), { mask: '00/00/0000' });
    IMask(document.getElementById('fiado-cpf'), { mask: '000.000.000-00' });
    IMask(document.getElementById('fiado-telefone'), { mask: '(00) 00000-0000' });
    
    if(document.getElementById('valor-pagando-agora')) IMask(document.getElementById('valor-pagando-agora'), configMoeda);
}

function formatarDataBR(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

function abrirModal(id) {
    document.getElementById(id).classList.add('active');
    if (id === 'modal-nova-conta') {
        setTimeout(() => document.getElementById('fiado-nome').focus(), 100);
    }
}

function fecharModal(id) {
    document.getElementById(id).classList.remove('active');
}

async function salvarConta() {
    const nome       = document.getElementById("fiado-nome").value.trim();
    const cpf        = document.getElementById("fiado-cpf").value.trim();
    const telefone   = document.getElementById("fiado-telefone").value.trim();
    const endereco   = document.getElementById("fiado-endereco").value.trim();
    const dataCompra = document.getElementById("fiado-data-compra").value;
    const dataPgto   = document.getElementById("fiado-data-pagamento").value;

    if (!nome) {
        alert("O Nome do Cliente é obrigatório!");
        document.getElementById("fiado-nome").focus();
        return;
    }

    const novaConta = {
        cliente:       nome,
        cpf:           cpf       || "Não informado",
        telefone:      telefone  || "Não informado",
        endereco:      endereco  || "Não informado",
        dataCompra:    dataCompra,
        dataPagamento: dataPgto  || "A combinar",
        total:         0, 
        valorPago:     0,
        itens:         [] 
    };

    try {
        await fetch('http://localhost:3000/api/fiados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaConta)
        });

        ["fiado-nome","fiado-cpf","fiado-telefone","fiado-endereco","fiado-data-pagamento"].forEach(id => {
            document.getElementById(id).value = "";
        });

        fecharModal('modal-nova-conta');
        await renderizarContas(); 

    } catch (e) {
        alert("Erro ao salvar conta. Verifique se o servidor está rodando.");
    }
}

async function renderizarContas() {
    const container = document.getElementById("container-devedores");
    container.innerHTML = "<p style='text-align:center; color:#fff; font-weight:bold;'>Carregando contas...</p>";

    let contasSalvas = [];
    try {
        const resp = await fetch('http://localhost:3000/api/fiados');
        if (resp.ok) contasSalvas = await resp.json();
    } catch (e) {
        container.innerHTML = "<p style='color:red;'>Erro de conexão com o banco.</p>";
        return;
    }

    container.innerHTML = "";

    if (contasSalvas.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #003366; background: #fff; border-radius: 8px; font-weight: bold; border: 4px solid #0055A4;">
                <i class="fa-solid fa-check-circle" style="font-size: 3rem; color: #10b981; display: block; margin-bottom: 15px;"></i>
                Nenhuma conta em aberto no momento.
            </div>`;
        return;
    }

    contasSalvas.forEach(conta => {
        let pago = conta.valorPago || 0;
        let falta = conta.total - pago;

        container.innerHTML += `
            <div class="devedor-card">
                <div class="devedor-header">
                    <h3><i class="fa-solid fa-user" style="color:#0055A4; margin-right:8px;"></i>${conta.cliente}</h3>
                    <span class="devedor-total">R$ ${conta.total.toFixed(2).replace('.', ',')}</span>
                </div>

                <div class="devedor-info">
                    <div><i class="fa-solid fa-address-card"></i> CPF: ${conta.cpf}</div>
                    <div><i class="fa-solid fa-phone"></i> ${conta.telefone}</div>
                    <div style="color: #ef4444;"><i class="fa-solid fa-circle-exclamation"></i> Falta Pagar: R$ ${falta.toFixed(2).replace('.', ',')}</div>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button class="btn-pagar-conta" style="background: #0055A4; color: white; border: none; flex: 1;" onclick="window.location.href='vendas.html?fiado_id=${conta.id}'">
                        <i class="fa-solid fa-cash-register"></i> ABRIR NO CAIXA
                    </button>
                    <button class="btn-pagar-conta" style="background: #10b981; color: white; border: none; width: 50px; padding: 0;" onclick="imprimirComprovanteConta(${conta.id})" title="Imprimir Comprovante">
                        <i class="fa-solid fa-print"></i>
                    </button>
                    <button class="btn-pagar-conta" style="background: #ef4444; color: white; border: none; width: 50px; padding: 0;" onclick="abrirModalQuitacao(${conta.id}, '${conta.cliente}', ${conta.total}, ${conta.valorPago || 0})" title="Baixa / Receber">
                        <i class="fa-solid fa-hand-holding-dollar"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

async function imprimirComprovanteConta(id) {
    try {
        const resp = await fetch(`http://localhost:3000/api/fiados`);
        const contas = await resp.json();
        const conta = contas.find(c => c.id === id);

        if (!conta) return alert("Conta não encontrada!");

        let configImpressora = { nome_estabelecimento: "MEU MERCADO", cnpj: "00.000.000/0001-00", endereco: "Endereço", frase_rodape: "Obrigado!" };
        try {
            const confResp = await fetch('http://localhost:3000/api/configuracoes_impressora');
            if (confResp.ok) configImpressora = await confResp.json();
        } catch(e) { console.warn("Usando config de impressora padrão"); }

        const recibo = document.getElementById("recibo-impressao");
        
        let htmlRecibo = `
            <div style="text-align: center; margin-bottom: 10px;">
                <h2 style="margin: 0;">${configImpressora.nome_estabelecimento}</h2>
                <p style="margin: 0; font-size: 10px;">CNPJ: ${configImpressora.cnpj}</p>
                <p style="margin: 0; font-size: 10px;">${configImpressora.endereco}</p>
                <p style="margin: 5px 0;">--------------------------------</p>
                <h3 style="margin: 0;">COMPROVANTE DE CONTA</h3>
                <p style="margin: 5px 0;">--------------------------------</p>
                <p style="margin: 0; font-size: 10px; text-align: left;"><strong>Cliente:</strong> ${conta.cliente}</p>
                <p style="margin: 0; font-size: 10px; text-align: left;"><strong>CPF:</strong> ${conta.cpf}</p>
                <p style="margin: 5px 0;">--------------------------------</p>
            </div>
            <table style="width: 100%; text-align: left; font-size: 11px; margin-bottom: 10px; border-collapse: collapse;">
                <tr><th style="border-bottom: 1px dashed #000;">QTD</th><th style="border-bottom: 1px dashed #000;">DESC.</th><th style="text-align: right; border-bottom: 1px dashed #000;">TOTAL</th></tr>
        `;

        if (conta.itens && conta.itens.length > 0) {
            conta.itens.forEach(item => {
                let qtd = Number.isInteger(item.quantidade) ? item.quantidade : parseFloat(item.quantidade).toFixed(3);
                let nomeLimitado = item.nome.substring(0, 15);
                htmlRecibo += `
                    <tr>
                        <td style="vertical-align: top; padding-top: 3px;">${qtd}</td>
                        <td style="padding-top: 3px;">${nomeLimitado}</td>
                        <td style="text-align: right; padding-top: 3px;">R$ ${parseFloat(item.subtotal).toFixed(2).replace('.',',')}</td>
                    </tr>
                `;
            });
        } else {
            htmlRecibo += `<tr><td colspan="3" style="text-align:center; padding-top:10px;">Nenhum produto registrado ainda.</td></tr>`;
        }

        let pago = conta.valorPago || 0;
        let falta = conta.total - pago;

        htmlRecibo += `
            </table>
            <p style="margin: 5px 0; text-align: center;">--------------------------------</p>
            <h3 style="text-align: right; margin: 5px 0; font-size: 12px;">TOTAL DA CONTA: R$ ${conta.total.toFixed(2).replace('.',',')}</h3>
            <div style="font-size: 11px; margin-top: 5px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #10b981;"><span>VALOR PAGO</span><span>R$ ${pago.toFixed(2).replace('.',',')}</span></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-weight: bold;"><span>FALTA PAGAR</span><span>R$ ${falta.toFixed(2).replace('.',',')}</span></div>
            </div>
            <p style="margin: 15px 0 5px 0; text-align: center;">--------------------------------</p>
            
            <div style="margin-top: 40px; text-align: center;">
                <p style="margin: 0; font-size: 12px;">__________________________________</p>
                <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: bold;">Assinatura do Cliente</p>
            </div>
            
            <p style="text-align: center; font-size: 11px; margin-top: 15px;">${configImpressora.frase_rodape}</p>
        `;

        recibo.innerHTML = htmlRecibo;
        window.print();
    } catch (e) {
        alert("Erro ao buscar dados para impressão.");
    }
}

function abrirModalQuitacao(idConta, nomeCliente, totalDaConta, jaPago) {
    contaSendoPagaId = idConta;
    totalContaAtual = totalDaConta;
    valorPagoAtual = jaPago || 0;
    nomeClientePagando = nomeCliente;
    
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

    if (isNaN(valorDigitado) || valorDigitado <= 0) {
        return alert("Insira um valor de pagamento válido!");
    }

    let faltaPagar = totalContaAtual - valorPagoAtual;
    let novoValorTotalPago = valorPagoAtual + valorDigitado;

    try {
        if (valorDigitado >= faltaPagar) {
            await fetch(`http://localhost:3000/api/fiados/${contaSendoPagaId}`, { method: 'DELETE' });
            alert("Conta totalmente quitada!");
        } else {
            const resp = await fetch(`http://localhost:3000/api/fiados/${contaSendoPagaId}`);
            const conta = await resp.json();

            conta.valorPago = novoValorTotalPago;

            await fetch(`http://localhost:3000/api/fiados/${contaSendoPagaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(conta)
            });
            alert(`Pagamento abatido! Ainda faltam R$ ${(totalContaAtual - novoValorTotalPago).toFixed(2).replace('.', ',')}`);
        }

        // --- LANÇA O PAGAMENTO DA CONTA COMO UMA VENDA NO RELATÓRIO ---
        const novaVenda = {
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
            totalBruto: valorDigitado,
            desconto: 0,
            totalLiquido: valorDigitado,
            custoTaxas: 0,
            pagamento: "Recebimento de Conta",
            detalhesPagamento: [{ forma: "Dinheiro/Pix", valor: valorDigitado }],
            itens: [{
                codigo_barras: 'PGTO-CONTA',
                nome: "Pgto. Conta: " + nomeClientePagando,
                preco: valorDigitado,
                quantidade: 1,
                subtotal: valorDigitado
            }],
            valorParaRelatorio: valorDigitado
        };

        await fetch('http://localhost:3000/api/vendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaVenda)
        });
        // --------------------------------------------------------------
        
        contaSendoPagaId = null;
        nomeClientePagando = "";
        fecharModal('modal-pagamento');
        await renderizarContas(); 
    } catch (e) {
        alert("Erro ao excluir/atualizar conta. Servidor offline.");
    }
}
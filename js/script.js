// js/script.js

document.addEventListener("DOMContentLoaded", () => {
    initClock();
    configurarAtalhosMenu();
});

/**
 * Atualiza o marcador de data e hora do Header
 */
function initClock() {
    const dateTimeEl = document.getElementById("current-date-time");
    if (!dateTimeEl) return;

    const updateTime = () => {
        const agora = new Date();
        
        const dia = String(agora.getDate()).padStart(2, '0');
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const ano = agora.getFullYear();
        
        const hora = String(agora.getHours()).padStart(2, '0');
        const minuto = String(agora.getMinutes()).padStart(2, '0');
        const segundo = String(agora.getSeconds()).padStart(2, '0');
        
        dateTimeEl.innerHTML = `${dia}/${mes}/${ano} &nbsp;|&nbsp; ${hora}:${minuto}:${segundo}`;
    };

    updateTime();
    setInterval(updateTime, 1000);
}

/**
 * Configura as Teclas de Atalho da Tela Inicial
 */
function configurarAtalhosMenu() {
    document.addEventListener("keydown", (e) => {
        
        // Evita que o navegador abra as ferramentas padrão do Windows (F1, F3, etc)
        if (["F1", "F2", "F3", "F4"].includes(e.key)) {
            e.preventDefault();
        }

        // Navegação Rápida
        if (e.key === "F1") {
            window.location.href = "vendas.html";
        }
        else if (e.key === "F2") {
            window.location.href = "estoque.html";
        }
        else if (e.key === "F3") {
            window.location.href = "contas.html";
        }
        else if (e.key === "F4") {
            window.location.href = "relatorios.html";
        }
    });
}
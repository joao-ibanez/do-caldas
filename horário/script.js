// Configurações e constantes
const TIMEZONE_OFFSET = -3; // UTC-3 para Brasília
const UPDATE_INTERVAL = 1000; // Atualizar a cada segundo

// Elementos DOM
const elements = {
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
    period: document.getElementById('period'),
    fullDate: document.getElementById('full-date'),
    dstStatus: document.getElementById('dst-status'),
    hourHand: document.getElementById('hour-hand'),
    minuteHand: document.getElementById('minute-hand'),
    secondHand: document.getElementById('second-hand'),
    worldClocks: {
        saoPaulo: document.getElementById('sao-paulo-time'),
        rio: document.getElementById('rio-time'),
        newYork: document.getElementById('ny-time'),
        london: document.getElementById('london-time'),
        tokyo: document.getElementById('tokyo-time')
    }
};

// Configurações de fusos horários para comparação mundial
const worldTimezones = {
    saoPaulo: { offset: -3, name: 'São Paulo' },
    rio: { offset: -3, name: 'Rio de Janeiro' },
    newYork: { offset: -4, name: 'Nova York', dst: true }, // EDT
    london: { offset: 1, name: 'Londres', dst: true }, // BST
    tokyo: { offset: 9, name: 'Tóquio' }
};

// Nomes dos dias da semana e meses em português
const dayNames = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado'
];

const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

// Função para obter a hora atual de Brasília
function getBrasiliaTime() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const brasiliaTime = new Date(utc + (TIMEZONE_OFFSET * 3600000));
    return brasiliaTime;
}

// Função para formatar número com zero à esquerda
function padZero(num) {
    return num.toString().padStart(2, '0');
}

// Função para obter hora em formato 12h
function getFormattedTime12h(date) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const period = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 deve ser 12
    
    return {
        hours: padZero(hours),
        minutes: padZero(minutes),
        seconds: padZero(seconds),
        period: period
    };
}

// Função para obter hora em formato 24h
function getFormattedTime24h(date) {
    return {
        hours: padZero(date.getHours()),
        minutes: padZero(date.getMinutes()),
        seconds: padZero(date.getSeconds())
    };
}

// Função para formatar data completa
function getFormattedDate(date) {
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const monthName = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName}, ${day} de ${monthName} de ${year}`;
}

// Função para calcular ângulos dos ponteiros do relógio analógico
function getClockAngles(date) {
    const hours = date.getHours() % 12;
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    
    const secondAngle = (seconds * 6) - 90; // 6 graus por segundo
    const minuteAngle = (minutes * 6) + (seconds * 0.1) - 90; // 6 graus por minuto + movimento suave
    const hourAngle = (hours * 30) + (minutes * 0.5) - 90; // 30 graus por hora + movimento suave
    
    return {
        hour: hourAngle,
        minute: minuteAngle,
        second: secondAngle
    };
}

// Função para obter hora de uma timezone específica
function getTimeForTimezone(offset, isDst = false) {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    let adjustedOffset = offset;
    
    // Ajuste simples para horário de verão (pode ser melhorado com lógica mais complexa)
    if (isDst && isCurrentlyDST()) {
        adjustedOffset += 1;
    }
    
    const timezoneTime = new Date(utc + (adjustedOffset * 3600000));
    return timezoneTime;
}

// Função simples para detectar se é período de horário de verão (aproximação)
function isCurrentlyDST() {
    const now = new Date();
    const month = now.getMonth();
    // Aproximação: março a outubro (hemisfério norte)
    return month >= 2 && month <= 9;
}

// Função para atualizar relógio digital
function updateDigitalClock() {
    const brasiliaTime = getBrasiliaTime();
    const time12h = getFormattedTime12h(brasiliaTime);
    
    // Atualizar elementos do relógio digital
    elements.hours.textContent = time12h.hours;
    elements.minutes.textContent = time12h.minutes;
    elements.seconds.textContent = time12h.seconds;
    elements.period.textContent = time12h.period;
    
    // Atualizar data
    elements.fullDate.textContent = getFormattedDate(brasiliaTime);
}

// Função para atualizar relógio analógico
function updateAnalogClock() {
    const brasiliaTime = getBrasiliaTime();
    const angles = getClockAngles(brasiliaTime);
    
    // Aplicar rotações aos ponteiros
    elements.hourHand.style.transform = `rotate(${angles.hour}deg)`;
    elements.minuteHand.style.transform = `rotate(${angles.minute}deg)`;
    elements.secondHand.style.transform = `rotate(${angles.second}deg)`;
}

// Função para atualizar relógios mundiais
function updateWorldClocks() {
    Object.keys(worldTimezones).forEach(city => {
        const config = worldTimezones[city];
        const cityTime = getTimeForTimezone(config.offset, config.dst);
        const time24h = getFormattedTime24h(cityTime);
        
        const timeString = `${time24h.hours}:${time24h.minutes}:${time24h.seconds}`;
        
        if (elements.worldClocks[city]) {
            elements.worldClocks[city].textContent = timeString;
        }
    });
}

// Função para verificar status do horário de verão
function updateDSTStatus() {
    // Brasil não usa mais horário de verão desde 2019
    elements.dstStatus.textContent = 'Não aplicado';
}

// Função principal de atualização
function updateAllClocks() {
    updateDigitalClock();
    updateAnalogClock();
    updateWorldClocks();
}

// Função para inicializar animações suaves
function initializeAnimations() {
    // Adicionar classe de carregamento concluído
    document.body.classList.add('loaded');
    
    // Animação inicial dos ponteiros
    const brasiliaTime = getBrasiliaTime();
    const angles = getClockAngles(brasiliaTime);
    
    // Definir posições iniciais sem transição
    elements.hourHand.style.transition = 'none';
    elements.minuteHand.style.transition = 'none';
    elements.secondHand.style.transition = 'none';
    
    elements.hourHand.style.transform = `rotate(${angles.hour}deg)`;
    elements.minuteHand.style.transform = `rotate(${angles.minute}deg)`;
    elements.secondHand.style.transform = `rotate(${angles.second}deg)`;
    
    // Reativar transições após um frame
    requestAnimationFrame(() => {
        elements.hourHand.style.transition = '';
        elements.minuteHand.style.transition = '';
        elements.secondHand.style.transition = '';
    });
}

// Função para adicionar efeitos de hover e interatividade
function addInteractiveEffects() {
    // Efeito de hover no relógio analógico
    const analogClock = document.querySelector('.analog-clock');
    if (analogClock) {
        analogClock.addEventListener('mouseenter', () => {
            analogClock.style.transform = 'scale(1.05)';
            analogClock.style.transition = 'transform 0.3s ease';
        });
        
        analogClock.addEventListener('mouseleave', () => {
            analogClock.style.transform = 'scale(1)';
        });
    }
    
    // Efeito de clique no relógio digital para alternar formato 12h/24h
    let is24HourFormat = false;
    const digitalClock = document.querySelector('.digital-clock');
    
    if (digitalClock) {
        digitalClock.addEventListener('click', () => {
            is24HourFormat = !is24HourFormat;
            digitalClock.style.transform = 'scale(0.95)';
            
            setTimeout(() => {
                digitalClock.style.transform = 'scale(1)';
                updateDigitalClockFormat(is24HourFormat);
            }, 150);
        });
        
        // Adicionar cursor pointer para indicar interatividade
        digitalClock.style.cursor = 'pointer';
        digitalClock.title = 'Clique para alternar entre formato 12h/24h';
    }
}

// Função para atualizar formato do relógio digital
function updateDigitalClockFormat(is24Hour) {
    const brasiliaTime = getBrasiliaTime();
    
    if (is24Hour) {
        const time24h = getFormattedTime24h(brasiliaTime);
        elements.hours.textContent = time24h.hours;
        elements.minutes.textContent = time24h.minutes;
        elements.seconds.textContent = time24h.seconds;
        elements.period.style.display = 'none';
    } else {
        const time12h = getFormattedTime12h(brasiliaTime);
        elements.hours.textContent = time12h.hours;
        elements.minutes.textContent = time12h.minutes;
        elements.seconds.textContent = time12h.seconds;
        elements.period.textContent = time12h.period;
        elements.period.style.display = 'block';
    }
}

// Função para lidar com visibilidade da página (otimização de performance)
function handleVisibilityChange() {
    if (document.hidden) {
        // Página não está visível, reduzir frequência de atualização
        clearInterval(window.clockInterval);
        window.clockInterval = setInterval(updateAllClocks, 5000); // 5 segundos
    } else {
        // Página está visível, voltar à frequência normal
        clearInterval(window.clockInterval);
        window.clockInterval = setInterval(updateAllClocks, UPDATE_INTERVAL);
        updateAllClocks(); // Atualização imediata
    }
}

// Função para detectar e aplicar tema escuro
function initializeTheme() {
    // Detectar preferência do sistema
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-theme');
    }
    
    // Escutar mudanças na preferência do tema
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (e.matches) {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
        });
    }
}

// Função de inicialização principal
function initialize() {
    // Verificar se todos os elementos necessários existem
    const requiredElements = [
        'hours', 'minutes', 'seconds', 'period', 'full-date',
        'hour-hand', 'minute-hand', 'second-hand'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('Elementos DOM necessários não encontrados:', missingElements);
        return;
    }
    
    // Inicializar tema
    initializeTheme();
    
    // Atualização inicial
    updateAllClocks();
    updateDSTStatus();
    
    // Configurar atualizações periódicas
    window.clockInterval = setInterval(updateAllClocks, UPDATE_INTERVAL);
    
    // Inicializar animações
    initializeAnimations();
    
    // Adicionar efeitos interativos
    addInteractiveEffects();
    
    // Configurar otimização de performance
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Log de inicialização
    console.log('Relógio de Brasília inicializado com sucesso!');
    console.log(`Horário atual: ${getBrasiliaTime().toLocaleString('pt-BR')}`);
}

// Função para limpeza ao sair da página
function cleanup() {
    if (window.clockInterval) {
        clearInterval(window.clockInterval);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', initialize);
window.addEventListener('beforeunload', cleanup);

// Tratamento de erros global
window.addEventListener('error', (event) => {
    console.error('Erro no relógio:', event.error);
    // Tentar reinicializar em caso de erro
    setTimeout(() => {
        try {
            initialize();
        } catch (e) {
            console.error('Falha ao reinicializar:', e);
        }
    }, 1000);
});

// Exportar funções para uso externo (se necessário)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getBrasiliaTime,
        getFormattedTime12h,
        getFormattedTime24h,
        getFormattedDate,
        updateAllClocks
    };
}

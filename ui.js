// ==========================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ИНТЕРФЕЙСА
// ==========================================
window.currentMachineUid = null; 
let notificationQueue = [];
let notificationModalActive = false;

// ==========================================
// АНТИЧИТ И ЗАЩИТА
// ==========================================
function showCheaterBanner() {
    if (document.getElementById('cheaterBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'cheaterBanner';
    banner.className = 'cheater-banner';
    banner.innerText = '🚫 Я ЧИТЕР 🚫';
    document.body.appendChild(banner);
    document.getElementById('gameWrapper').classList.add('blurred');
    document.querySelectorAll('button:not(.close-modal)').forEach(b => b.disabled = true);
    cheaterDetected = true;
}

setInterval(() => {
    if (game && !cheaterDetected) {
        if (game.cash < -1500 || game.cash > 1000000) showCheaterBanner(); 
        if (game.equipment.length > 50) showCheaterBanner();
        if (game.activeLoans.length > 5) showCheaterBanner();
        if (isNaN(game.cash) || isNaN(game.day)) showCheaterBanner();
    }
}, 1500);

// ==========================================
// СИСТЕМА УВЕДОМЛЕНИЙ
// ==========================================
window.showNotification = function(message) {
    notificationQueue.push(message);
    if (!notificationModalActive) showNextNotification();
};

function showNextNotification() {
    if (notificationQueue.length === 0) {
        notificationModalActive = false;
        return;
    }
    notificationModalActive = true;
    const msg = notificationQueue.shift();
    document.getElementById('notificationMessage').innerText = msg;
    document.getElementById('notificationModal').classList.add('active');
}

window.closeNotification = function() {
    document.getElementById('notificationModal').classList.remove('active');
    notificationModalActive = false;
    showNextNotification();
};

// ==========================================
// ГЛАВНАЯ ФУНКЦИЯ ОТРИСОВКИ (RENDER)
// ==========================================
window.render = function() {
    if (cheaterDetected) return;
    if (typeof recalcRating === 'function') recalcRating(); 

    // 1. ВЕРХНЯЯ ПАНЕЛЬ
    const cashDisplay = document.getElementById('cashDisplay');
    cashDisplay.innerText = game.cash;
    if (game.cash < 0) {
        cashDisplay.style.color = '#c0392b'; 
        cashDisplay.style.fontWeight = '900';
    } else {
        cashDisplay.style.color = 'inherit';
        cashDisplay.style.fontWeight = 'inherit';
    }

    document.getElementById('dayDisplay').innerText = game.day;
    document.getElementById('ratingDisplay').innerText = game.rating;
    
    const dailyCostIndicator = document.getElementById('dailyCostIndicator');
    if (dailyCostIndicator) {
        dailyCostIndicator.innerText = `💰 Плата за день: ${getDailyCost()} монет`;
    }

    // 2. ДОСТУПНЫЕ ЗАКАЗЫ (РЫНОК)
    const ordersDiv = document.getElementById('ordersContainer');
    let marketHtml = '';
    if (game.market) {
        marketHtml = `<div style="display: flex; gap: 10px; margin-bottom: 10px; font-size: 1rem; flex-wrap: wrap;">`;
        for (let type in game.market) {
            let index = game.market[type];
            let percent = Math.round(index * 100);
            let color = index >= 1.05 ? '#27ae60' : (index <= 0.95 ? '#c0392b' : '#34495e');
            let icon = index >= 1.05 ? '📈' : (index <= 0.95 ? '📉' : '📊');
            marketHtml += `<div style="background: white; padding: 5px 10px; border-radius: 15px; border: 1px solid #d3e2ef; color: ${color}; font-weight: bold;">
                ${PRODUCT_TYPES[type].icon} ${percent}%
            </div>`;
        }
        marketHtml += `</div>`;
    }

    if (game.availableOrders.length === 0) {
        ordersDiv.innerHTML = marketHtml + '<div class="order-card">😴 Клиенты молчат...</div>';
    } else {
        let ordersHtml = game.availableOrders.map(order => {
            const canTake = hasWorkingMachine(order.productType);
            return `<div class="order-card" style="background:${!canTake ? '#ffe0e0' : '#f0f7fe'}">
                <div class="order-header">
                    <span>${getProductName(order.productType)}</span>
                    <span>${order.quantity} шт</span>
                </div>
                <div class="order-detail">
                    <span>💰 ${order.pricePerUnit} мон/шт</span>
                    <span>💵 Вся партия: ${order.totalValue}</span>
                </div>
                <div class="order-detail">
                    <span style="font-weight:bold; color:${order.daysLeft <= 3 ? '#c0392b' : 'inherit'};">⏳ Осталось дней: ${order.daysLeft}</span>
                    <button class="take-btn" data-id="${order.id}" ${!canTake ? 'disabled' : ''}>✅ Беру!</button>
                </div>
            </div>`;
        }).join('');
        ordersDiv.innerHTML = marketHtml + ordersHtml;
    }

    // 3. ТЕКУЩИЕ ЗАКАЗЫ (В ЗАПУСКЕ)
    const myOrdersDiv = document.getElementById('myOrdersContainer');
    if (game.myOrders.length === 0) {
        myOrdersDiv.innerHTML = '<div class="order-card">📭 Вы свободны. Возьмите заказ!</div>';
    } else {
        myOrdersDiv.innerHTML = game.myOrders.map(order => {
            const penalty = Math.max(1, Math.floor(order.totalValue * order.penaltyRate));
            return `<div class="order-card">
                <div class="order-header">
                    <span>${getProductName(order.productType)}</span>
                    <span>${order.quantity} шт</span>
                </div>
                <div class="order-detail">
                    <span>💵 Ждем: ${order.totalValue} монет</span>
                    <span style="font-weight:bold; color:${order.daysLeft <= 3 ? '#c0392b' : 'inherit'};">⏳ Дней: ${order.daysLeft}</span>
                </div>
                <div style="font-size: 0.9rem; color: #555; text-align:right;">
                    Готово: ${Math.min(game.storage[order.productType], order.quantity)} / ${order.quantity}
                </div>
                <button class="cancel-btn" onclick="window.cancelOrder('${order.id}')" title="Штраф 10%">❌ Отказаться (-${penalty}💰)</button>
            </div>`;
        }).join('');
    }

    // 4. ВКЛАДКА "ЦЕХ" (СТАНКИ И НЕДВИЖИМОСТЬ)
    const machinesDiv = document.getElementById('machinesTab');
    let factoryHtml = '';
    const currentStage = STAGES[game.stageLevel || 0];

    // --- ДИНАМИЧЕСКАЯ СМЕНА ЦВЕТОВОЙ ТЕМЫ ---
    let styleTag = document.getElementById('dynamic-theme');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-theme';
        document.head.appendChild(styleTag);
    }
    // Внедряем CSS-перекраску и фоновые изображения
    styleTag.innerHTML = `
        body { 
            background-color: ${currentStage.theme.bodyBg} !important;
            background-image: ${currentStage.theme.bgImage} !important;
            background-size: cover !important;
            background-position: center !important;
            background-attachment: fixed !important;
            transition: background-image 0.8s ease, background-color 0.8s ease; 
        }
        #gameWrapper { background: ${currentStage.theme.wrapBg} !important; box-shadow: 0 10px 40px ${currentStage.theme.shadow} !important; transition: background 0.8s ease, box-shadow 0.8s ease; backdrop-filter: blur(5px); }
        h2 { color: ${currentStage.theme.text} !important; border-bottom-color: ${currentStage.theme.border} !important; transition: 0.8s ease; }
        .order-card { background: ${currentStage.theme.panelBg} !important; border-color: ${currentStage.theme.border} !important; transition: 0.5s ease; }
        .tab-content { background: ${currentStage.theme.panelBg} !important; border-color: ${currentStage.theme.border} !important; transition: 0.5s ease; }
        .tab.active { background: ${currentStage.theme.panelBg} !important; border-color: ${currentStage.theme.border} !important; border-bottom-color: ${currentStage.theme.panelBg} !important; color: ${currentStage.theme.text} !important; transition: 0.5s ease; }
        .storage-item { border-bottom-color: ${currentStage.theme.border} !important; }
        .loan-item { border-left-color: ${currentStage.theme.border} !important; background: ${currentStage.theme.panelBg} !important; }
    `;

    // --- ЕСЛИ ЗДАНИЯ НЕТ (УРОВЕНЬ 0) ---
    if ((game.stageLevel || 0) === 0) {
        factoryHtml += `<div style="text-align:center; padding: 30px; background: #ffe0e0; border-radius: 20px; border: 3px dashed #c0392b; margin-bottom: 20px;">
            <div style="font-size: 4rem; margin-bottom: 10px;">⛺</div>
            <h3 style="color: #c0392b; margin-bottom: 10px;">У вас нет помещения!</h3>
            <p style="margin-bottom: 15px; color: #1e3c5a; font-weight: bold;">Станки нельзя ставить на улице.<br>Возьмите стартовый кредит в банке и арендуйте гараж.</p>
            <button onclick="window.openBuildingsModal()" style="font-size: 1.3rem; padding: 15px 30px; background: #2ecc71; box-shadow: 0 6px 0 #27ae60; border: none; border-radius: 40px; color: white; cursor: pointer; font-weight: bold;">🏢 Рынок недвижимости</button>
        </div>`;
    } 
    // --- ЕСЛИ ЗДАНИЕ ЕСТЬ (УРОВЕНЬ 1+) ---
    else {
        // Панель здания теперь перекрашивается сама
        factoryHtml += `<div style="background: ${currentStage.theme.panelBg}; border: 2px solid ${currentStage.theme.border}; border-radius: 20px; padding: 15px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; transition: 0.5s ease;">
            <div style="display: flex; gap: 15px; align-items: center;">
                <img src="${currentStage.img}" style="width: 80px; height: 80px; object-fit: contain; background: ${currentStage.theme.wrapBg}; border-radius: 10px; border: 2px solid ${currentStage.theme.border};">
                <div>
                    <div style="font-size: 1.4rem; font-weight: 800; color: ${currentStage.theme.text};">${currentStage.name}</div>
                    <div style="color: #555; font-size: 1rem;">Аренда: ${currentStage.rent} 💰/день | Мест: ${game.equipment.length} / ${currentStage.maxMachines}</div>
                </div>
            </div>
            ${game.stageLevel < STAGES.length - 1 ? 
                `<button onclick="window.openBuildingsModal()" style="margin: 0; background: #3498db; box-shadow: 0 4px 0 #2980b9; color: white; font-weight: bold; border-radius: 30px; font-size: 1.1rem; padding: 10px 20px; cursor: pointer; border: none;">Агентство недвижимости</button>` 
                : `<div style="color: #27ae60; font-weight: bold; font-size: 1.1rem;">Максимальное расширение</div>`}
        </div>`;

        // Сводка мощностей
        if (game.equipment.length > 0) {
            const groups = {};
            game.equipment.forEach(m => {
                if (!groups[m.productType]) groups[m.productType] = { count: 0, totalOutput: 0 };
                groups[m.productType].count++;
                const perf = m.performance || 1.0;
                groups[m.productType].totalOutput += Math.floor((m.baseOutputPerDay || m.outputPerDay) * perf);
            });
            factoryHtml += '<div class="machine-summary">';
            for (let type in groups) {
                factoryHtml += `<div class="summary-item">${PRODUCT_TYPES[type].icon} ${groups[type].totalOutput} шт/день</div>`;
            }
            factoryHtml += '</div>';
        }

        // Сетка станков
        factoryHtml += `<div class="factory-grid">`;
        const totalSlots = currentStage.maxMachines; 

        for (let i = 0; i < totalSlots; i++) {
            if (i < game.equipment.length) {
                let m = game.equipment[i];
                let isCritical = m.health < 30;
                let perf = m.performance || 1.0;
                let currentOut = Math.floor((m.baseOutputPerDay || m.outputPerDay) * perf);
                let tooltip = `${m.name} | Здоровье: ${m.health}% | ⚡ ${currentOut} шт/дн | Нагрузка: x${perf}`;
                
                factoryHtml += `
                <div class="machine-sprite ${isCritical ? 'needs-repair' : ''}" 
                    data-uid="${m.uid}" 
                    data-tooltip="${tooltip}" 
                    onclick="window.openMachineModal('${m.uid}')">
                    <div class="machine-smoke">💨</div>
                    <img src="${PRODUCT_TYPES[m.productType].img}" style="width: 100%; height: 100%; object-fit: contain; padding: 10px; pointer-events: none;" alt="Станок">
                    <div class="machine-health-mini">
                        <div class="health-mini-fill ${isCritical ? 'health-critical' : ''}" style="width: ${m.health}%;"></div>
                    </div>
                </div>`;
            } else {
                factoryHtml += `
                <div class="machine-sprite empty-slot" onclick="window.openModal('shopModal')" data-tooltip="Купить новый станок">
                    +
                </div>`;
            }
        }
        factoryHtml += `</div>`;
        
        if(game.equipment.length > 0) {
            factoryHtml += `<div style="text-align:center; color:#7fa6c2; font-size: 1rem; margin-bottom:10px;">⚙️ Кликни по станку для настройки или ремонта.</div>`;
        }
    }
    machinesDiv.innerHTML = factoryHtml;

    // 5. ВКЛАДКА "СКЛАД"
    const storageDiv = document.getElementById('storageTab');
    const nonEmpty = Object.entries(game.storage).filter(([_, v]) => v > 0);
    if (nonEmpty.length === 0) {
        storageDiv.innerHTML = '<div style="text-align:center; margin-top: 20px;">🕸️ На складе гуляет ветер</div>';
    } else {
        storageDiv.innerHTML = nonEmpty.map(([type, amount]) => {
            const cost = typeof getRawMaterialCost === 'function' ? getRawMaterialCost(type) : BASE_COSTS[type];
            return `<div class="storage-item">
                <span>${getProductName(type)}</span>
                <span><strong style="font-size: 1.3rem;">📦 ${amount} шт</strong> <span style="color:#555; font-size:0.9rem;">(себест. ${cost} мон)</span></span>
            </div>`;
        }).join('');
    }

    // 6. ВКЛАДКА "ЗАТРАТЫ"
    const costsDiv = document.getElementById('costsTab');
    if (game.equipment.length === 0) {
        costsDiv.innerHTML = '<div style="text-align:center; margin-top: 20px;">🕸️ Нет станков — нет затрат</div>';
    } else {
        let costsByType = {};
        let totalDailyCost = 0;
        
        game.equipment.forEach(m => {
            if (m.health > 0) {
                if (!costsByType[m.productType]) costsByType[m.productType] = { amount: 0, cost: 0 };
                
                const perf = m.performance || 1.0;
                const currentOut = Math.floor((m.baseOutputPerDay || m.outputPerDay) * perf);
                const dailyCost = currentOut * (typeof getRawMaterialCost === 'function' ? getRawMaterialCost(m.productType) : BASE_COSTS[m.productType]);
                
                costsByType[m.productType].amount += currentOut;
                costsByType[m.productType].cost += dailyCost;
                totalDailyCost += dailyCost;
            }
        });
        
        let costsHtml = Object.entries(costsByType).map(([type, data]) => {
            return `<div class="storage-item">
                <span>${getProductName(type)} <span style="color:#555; font-size:0.9rem;">(произв. ${data.amount} шт)</span></span>
                <span><strong style="color: #c0392b;">-${data.cost} 💰</strong></span>
            </div>`;
        }).join('');
        
        costsHtml += `<div class="storage-item" style="border-top: 3px solid #1e3c5a; margin-top: 10px; padding-top: 15px;">
            <span style="font-weight: 800; font-size: 1.2rem;">ИТОГО СЫРЬЕ ЗА ДЕНЬ:</span>
            <span style="font-weight: 800; font-size: 1.3rem; color: #c0392b;">-${totalDailyCost} 💰</span>
        </div>`;
        
        costsDiv.innerHTML = costsHtml;
    }

    // 7. КРЕДИТЫ (ФИНАНСЫ)
    const loansDiv = document.getElementById('activeLoansContainer');
    if (game.activeLoans.length === 0) {
        loansDiv.innerHTML = '<div>✅ Долгов нет</div>';
    } else {
        loansDiv.innerHTML = game.activeLoans.map(loan => {
            return `<div class="loan-item">
                <span>💰 ${Math.round(loan.amount)} мон</span>
                <span>⏳ ${loan.daysLeft} дн.</span>
            </div>`;
        }).join('');
    }

    // Привязываем клик к кнопке взятия заказа
    document.querySelectorAll('.take-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            if (typeof window.takeOrder === 'function') window.takeOrder(e.target.dataset.id);
        });
    });

    window.saveGame();
};

// ==========================================
// УПРАВЛЕНИЕ МОДАЛЬНЫМИ ОКНАМИ
// ==========================================
window.openModal = function(id) {
    document.getElementById(id).classList.add('active');
    if (id === 'shopModal') fillShopModal();
    if (id === 'loanModal') fillLoanModal();
};

window.closeModal = function(id) {
    document.getElementById(id).classList.remove('active');
};

// --- ОКНО РЫНКА НЕДВИЖИМОСТИ ---
window.openBuildingsModal = function() {
    if (cheaterDetected) return;
    const list = document.getElementById('buildingsList');
    // Замените блок формирования list.innerHTML внутри window.openBuildingsModal
    list.innerHTML = STAGES.filter(s => s.level > 0).map(s => {
        const isPurchased = game.stageLevel >= s.level;
        const isNext = s.level === (game.stageLevel || 0) + 1;
        
        let btnHtml = '';
        if (isPurchased) {
            btnHtml = `<span style="font-weight:bold; color:#27ae60; font-size:1.2rem;">✅ Приобретено</span>`;
        } else if (isNext) {
            btnHtml = `<button onclick="window.buyBuilding(${s.level})" style="margin:0;">Купить за ${s.price} 💰</button>`;
        } else {
            btnHtml = `<button disabled style="background:#bdc3c7; box-shadow: 0 4px 0 #95a5a6; margin:0;">Сначала купите пред. уровень</button>`;
        }

        return `<div class="machine-shop-item" style="display:flex; gap:15px; align-items:center; ${isPurchased ? 'opacity: 0.6;' : ''} background: ${s.theme.wrapBg} !important; border-color: ${s.theme.border} !important;">
            <div>
                <img src="${s.img}" alt="${s.name}" style="display:block; width: 100px; height: 100px; object-fit: contain; background: ${s.theme.panelBg}; border-radius: 10px; border: 2px solid ${s.theme.border};">
            </div>
            <div style="flex-grow:1;">
                <strong style="font-size:1.3rem; color: ${s.theme.text};">${s.name}</strong><br>
                <span style="color:#555;">Вместимость: ${s.maxMachines} станков | Аренда: ${s.rent} мон/день</span>
            </div>
            <div>${btnHtml}</div>
        </div>`;
    }).join('');
    
    document.getElementById('buildingsModal').classList.add('active');
};

function fillShopModal() {
    const list = document.getElementById('machineShopList');
    list.innerHTML = MACHINES.map(m => {
        const imgSrc = PRODUCT_TYPES[m.productType].img;
        return `<div class="machine-shop-item" style="display:flex; gap:15px; align-items:center;">
            <div>
                <img src="${imgSrc}" alt="${m.name}" style="display:block;">
            </div>
            <div style="flex-grow:1;">
                <strong>${m.name}</strong><br>
                <span style="color:#555;">Мощность: ${m.outputPerDay}/день | Затраты: ${m.costPerItem} мон/шт</span><br>
                <span style="font-weight:bold; color:#b86824;">Цена: ${m.price} монет</span>
            </div>
            <button onclick="window.buyMachine('${m.id}')">Купить</button>
        </div>`;
    }).join('');
}

function fillLoanModal() {
    const list = document.getElementById('loanOfferList');
    list.innerHTML = LOAN_OFFERS.map(offer => {
        return `<div class="loan-offer-item">
            <div>
                <strong>${offer.name}</strong><br>
                Ставка: ${offer.interestRate*100}% в день<br>
                Срок: ${offer.termDays} дней
            </div>
            <button onclick="window.promptLoan('${offer.id}', ${offer.maxAmount})">Взять</button>
        </div>`;
    }).join('');
}

window.promptLoan = function(offerId, maxAmount) {
    if (cheaterDetected) return;
    let amount = prompt(`Сумма кредита (от 10 до ${maxAmount}):`, maxAmount);
    if (amount === null) return;
    amount = parseInt(amount);
    if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
        window.showNotification('❌ Ошибка: Введена неверная сумма!');
        return;
    }
    if (typeof window.takeLoan === 'function') window.takeLoan(offerId, amount);
};

window.openTaxModal = function() {
    if (cheaterDetected) return;
    const container = document.getElementById('taxChartContainer');
    
    if (!game.taxHistory || game.taxHistory.length === 0) {
        container.innerHTML = '<div style="margin: auto; font-size: 1.5rem; color: #7fa6c2;">📊 Данные появятся в начале следующего месяца (на 31-й день)</div>';
    } else {
        const maxIncome = Math.max(...game.taxHistory.map(h => h.income));
        container.innerHTML = game.taxHistory.map(h => {
            const heightPercent = maxIncome > 0 ? (h.income / maxIncome) * 100 : 0; 
            const taxPercent = h.income > 0 ? (h.tax / h.income) * 100 : 0;
            const netPercent = 100 - taxPercent;
            const taxLabel = h.tax > 0 ? `<span style="font-size: 0.8rem; font-weight: 900;">-${h.tax}</span>` : '';
            
            return `
            <div class="chart-col" title="Месяц ${h.month}&#10;Заработано: ${h.income}💰&#10;Налог: ${h.tax}🔴">
                <div style="font-weight: 800; font-size: 0.9rem; color: #1e3c5a; margin-bottom: 5px;">${h.income}</div>
                <div class="bar-group" style="height: ${heightPercent}%">
                    <div class="bar-tax" style="height: ${taxPercent}%; display: flex; align-items: center; justify-content: center; overflow: hidden;">${taxLabel}</div>
                    <div class="bar-income" style="height: ${netPercent}%"></div>
                </div>
                <div class="chart-label">${h.month}м</div>
            </div>`;
        }).join('');
    }
    document.getElementById('taxModal').classList.add('active');
};

window.openMachineModal = function(uid) {
    if (cheaterDetected) return;
    const machine = game.equipment.find(m => m.uid === uid);
    if (!machine) return;
    
    window.currentMachineUid = uid;
    
    document.getElementById('machineModalTitle').innerText = machine.name;
    document.getElementById('machineModalHealth').innerText = machine.health;
    document.getElementById('machineModalBaseOutput').innerText = machine.baseOutputPerDay;
    
    const slider = document.getElementById('machineModalSlider');
    slider.value = machine.performance || 1.0;
    
    const updateSliderLabels = () => {
        const perf = parseFloat(slider.value);
        document.getElementById('machineModalCurrentOutput').innerText = Math.floor(machine.baseOutputPerDay * perf);
        
        let wearText = "Нормальный (х1.0)";
        if (perf < 1.0) wearText = `Сниженный (x${perf.toFixed(1)})`;
        if (perf > 1.0) wearText = `Ускоренный (x${perf.toFixed(1)})`;
        document.getElementById('machineModalWearRate').innerText = wearText;
    };
    
    slider.oninput = updateSliderLabels;
    slider.onchange = () => {
        machine.performance = parseFloat(slider.value);
        window.saveGame();
        window.render(); 
    };
    updateSliderLabels();

    const repairCost = Math.floor(machine.price * 0.3);
    document.getElementById('machineModalRepairBtn').innerText = `🔧 Починить (${repairCost} 💰)`;
    
    const sellPrice = Math.floor(machine.price * 0.5 * (machine.health / 100)); 
    document.getElementById('machineModalSellBtn').innerText = `💰 Продать (${sellPrice > 0 ? sellPrice : 0} 💰)`;

    document.getElementById('machineModal').classList.add('active');
};

window.openUpgradesModal = function() {
    if (cheaterDetected) return;
    const list = document.getElementById('upgradesList');
    
    list.innerHTML = UPGRADES.map(u => {
        const isPurchased = game.upgrades && game.upgrades.includes(u.id);
        return `<div class="upgrade-item ${isPurchased ? 'purchased' : ''}">
            <div style="flex-grow:1;">
                <strong>${u.name}</strong><br>
                <span style="color:#555; font-size: 1rem;">${u.desc}</span><br>
                ${!isPurchased ? `<span style="font-weight:bold; color:#b86824;">Цена: ${u.price} монет</span>` : `<span style="font-weight:bold; color:#27ae60;">✅ Куплено</span>`}
            </div>
            ${!isPurchased ? `<button onclick="window.buyUpgrade('${u.id}')">Купить</button>` : ''}
        </div>`;
    }).join('');
    
    document.getElementById('upgradesModal').classList.add('active');
};

// ==========================================
// ОБУЧАЮЩИЙ ТУР
// ==========================================
const tourSteps = [
    { element: '.money', text: '💰 Твой капитал. Зарабатывай деньги, выполняя заказы, но следи за расходами!' },
    { element: '#takeLoanBtn', text: '🏦 Банк. На старте у тебя 0 монет и нет помещения. Возьми "Средний кредит", чтобы начать бизнес!' },
    { element: '#tabMachines', text: '🏭 Вкладка "ЦЕХ". Зайди на "Рынок недвижимости" и купи Гараж. Только после этого ты сможешь купить свой первый станок.' },
    { element: '#ordersContainer', text: '📋 Рынок и заказы. Внимательно следи за ценами! Если спрос падает, заказы становятся дешевле.' },
    { element: '#myOrdersContainer', text: '⏳ Твои заказы. Отсюда товары уходят клиентам. Если станок сломался и ты не успеваешь — заказ можно отменить (с уплатой неустойки).' },
    { element: '#tabStorage', text: '📦 Вкладка "СКЛАД". Здесь копится произведенная продукция, если для нее пока нет подходящих заказов.' },
    { element: '#tabCosts', text: '📉 Вкладка "ЗАТРАТЫ". Показывает, какую сумму ежедневно съедает закупка сырья.' },
    { element: '#openUpgradesBtn', text: '🚀 Улучшения. Когда накопишь капитал, инвестируй в логистику, масло или бренд, чтобы получать мощные бонусы.' },
    { element: '#showTaxBtn', text: '📊 Налоги. Помни: каждый 30-й день государство забирает 13% от всех заработанных за месяц денег.' },
    { element: '#dailyCostIndicator', text: '💸 Плата за день. Чем больше станков и чем круче здание — тем выше аренда и траты на обслуживание!' },
    { element: '#newDayBtn', text: '➡️ НОВЫЙ ДЕНЬ. Запускает производство, списывает ежедневную плату и приносит новые заказы.' },
    { element: '#restartBtn', text: '🔄 Если бизнес окончательно прогорел и коллекторы стучат в дверь, эта кнопка позволит начать игру заново.' }
];

let currentTourStep = 0;

function updateTourHighlight() {
    const tourHighlight = document.getElementById('tourHighlight');
    const tourTooltip = document.getElementById('tourTooltip');
    const tourText = document.getElementById('tourText');
    const step = tourSteps[currentTourStep];
    const element = document.querySelector(step.element);
    
    if (!element) {
        currentTourStep++;
        if (currentTourStep < tourSteps.length) updateTourHighlight();
        else window.endTour();
        return;
    }
    const rect = element.getBoundingClientRect();
    tourHighlight.style.top = rect.top + window.scrollY + 'px';
    tourHighlight.style.left = rect.left + window.scrollX + 'px';
    tourHighlight.style.width = rect.width + 'px';
    tourHighlight.style.height = rect.height + 'px';
    tourHighlight.classList.add('active');

    tourText.innerText = step.text;

    const tooltipX = rect.right + 20;
    const tooltipY = rect.top + window.scrollY;
    if (tooltipX + 400 > window.innerWidth) {
        tourTooltip.style.left = (rect.left - 420) + 'px';
    } else {
        tourTooltip.style.left = (rect.right + 20) + 'px';
    }
    tourTooltip.style.top = tooltipY + 'px';
    tourTooltip.classList.add('active');
}

window.startTour = function() {
    if (!game || !game.playerName) {
        window.showNotification('Сначала войдите в игру');
        return;
    }
    document.getElementById('helpBtn').classList.remove('help-icon-attention');
    currentTourStep = 0;
    document.getElementById('tourOverlay').classList.add('active');
    document.getElementById('tourTooltip').classList.add('active');
    updateTourHighlight();
};

window.endTour = function() {
    document.getElementById('tourOverlay').classList.remove('active');
    document.getElementById('tourHighlight').classList.remove('active');
    document.getElementById('tourTooltip').classList.remove('active');
    if (game && game.playerName) {
        localStorage.setItem('tourShown_' + game.playerName, 'true');
        updateHelpButtonAnimation();
    }
};

function updateHelpButtonAnimation() {
    if (!game || !game.playerName) return;
    const tourKey = 'tourShown_' + game.playerName;
    if (!localStorage.getItem(tourKey)) {
        document.getElementById('helpBtn').classList.add('help-icon-attention');
    } else {
        document.getElementById('helpBtn').classList.remove('help-icon-attention');
    }
}

// ==========================================
// СОХРАНЕНИЕ И ЗАГРУЗКА ПРОГРЕССА
// ==========================================
function getSaveKey(name) { return 'little_entrepreneur_' + (name || 'default'); }

window.saveGame = function() {
    if (!game || !game.playerName) return;
    try {
        localStorage.setItem(getSaveKey(game.playerName), JSON.stringify(game));
        window.loadProfileList();
    } catch (e) {}
};

window.loadProfileList = function() {
    const select = document.getElementById('profileSelect');
    if(!select) return;
    select.innerHTML = '<option value="">-- Выберите существующий профиль --</option>';
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('little_entrepreneur_')) {
            const name = key.replace('little_entrepreneur_', '');
            if (name && name !== 'default') {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                select.appendChild(option);
            }
        }
    }
};

window.loadGame = function(name) {
    if (!name) return;
    let isNewPlayer = false; 
    
    const saved = localStorage.getItem(getSaveKey(name));
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            game = parsed;
            game.equipment.forEach((m, index) => {
                if (!m.uid) m.uid = m.id + '_' + Date.now() + '_' + index;
                if (!m.baseOutputPerDay) m.baseOutputPerDay = m.outputPerDay;
                if (!m.performance) m.performance = 1.0;
            });
            if (!game.taxHistory) { game.taxHistory = []; game.monthlyIncome = 0; }
            if (!game.upgrades) game.upgrades = [];
            if (game.stageLevel === undefined) game.stageLevel = 0; // Защита старых сохранений
        } catch (e) { game = null; }
    }
    
    if (!game) {
        isNewPlayer = true; 
        game = {
            day: 1, cash: 0, rating: 0,
            equipment: [], storage: { toy: 0, furniture: 0, food: 0 }, activeLoans: [],
            myOrders: [], availableOrders: [], completedOrders: 0, failedOrders: 0,
            playerName: name, market: { toy: 1.0, furniture: 1.0, food: 1.0 },
            monthlyIncome: 0, taxHistory: [], upgrades: [], stageLevel: 0 // Уровень 0 = Нет здания
        };
        // Первые заказы
        if (typeof generateRandomOrder === 'function') {
            for (let i = 0; i < 3; i++) game.availableOrders.push(generateRandomOrder());
        }
    }
    
    if (!game.market) game.market = { toy: 1.0, furniture: 1.0, food: 1.0 };
    if (game.monthlyIncome === undefined) { game.monthlyIncome = 0; game.taxHistory = []; }
    if (!game.upgrades) game.upgrades = [];
    if (game.stageLevel === undefined) game.stageLevel = 0; 

    document.getElementById('playerNameDisplay').innerText = game.playerName;
    document.getElementById('loginModal').classList.remove('active');
    
    window.render();
    updateHelpButtonAnimation();

    if (isNewPlayer) {
        setTimeout(() => { window.startTour(); }, 500);
    }
};

window.restartGame = function() {
    if (!game || !game.playerName) return;
    const isConfirmed = confirm(`🚨 ВНИМАНИЕ!\n\nВы уверены, что хотите начать игру с самого начала? \nВсе ваши деньги, здания, станки и рейтинг будут навсегда удалены!`);
    
    if (isConfirmed) {
        const currentName = game.playerName;
        localStorage.removeItem(getSaveKey(currentName)); 
        localStorage.removeItem('tourShown_' + currentName); 
        game = null; 
        window.loadGame(currentName); 
        window.showNotification('🔄 Игра начата с чистого листа. Удачи, предприниматель!');
    }
};

// ==========================================
// ИНИЦИАЛИЗАЦИЯ И СЛУШАТЕЛИ СОБЫТИЙ ПРИ ЗАГРУЗКЕ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    window.loadProfileList();

    // 1. Окно входа
    document.getElementById('loginBtn').addEventListener('click', () => {
        const selected = document.getElementById('profileSelect').value;
        if (selected) { window.loadGame(selected); } 
        else { alert('Сначала выберите профиль из списка!'); }
    });

    document.getElementById('newGameBtn').addEventListener('click', () => {
        const newName = document.getElementById('newPlayerName').value.trim();
        if (newName) {
            if (localStorage.getItem(getSaveKey(newName))) {
                alert('⚠️ Игрок с таким именем уже существует! Выберите его в верхнем списке или придумайте другое имя.');
            } else { window.loadGame(newName); }
        } else { alert('Пожалуйста, введите ваше имя!'); }
    });

    // 2. Модальные окна (базовые)
    document.getElementById('closeNotificationBtn').addEventListener('click', window.closeNotification);
    document.getElementById('closeShopModal').addEventListener('click', () => window.closeModal('shopModal'));
    document.getElementById('closeLoanModal').addEventListener('click', () => window.closeModal('loanModal'));
    
    // Новое окно зданий
    if (document.getElementById('closeBuildingsModal')) {
        document.getElementById('closeBuildingsModal').addEventListener('click', () => window.closeModal('buildingsModal'));
    }
    
    // Окно управления станком
    if (document.getElementById('closeMachineModal')) {
        document.getElementById('closeMachineModal').addEventListener('click', () => window.closeModal('machineModal'));
        document.getElementById('machineModalRepairBtn').addEventListener('click', () => {
            if (typeof window.repairMachineFromModal === 'function') window.repairMachineFromModal();
        });
        document.getElementById('machineModalSellBtn').addEventListener('click', () => {
            if (typeof window.sellMachine === 'function') window.sellMachine();
        });
    }
    
    // Налоги и улучшения
    if (document.getElementById('showTaxBtn')) {
        document.getElementById('showTaxBtn').addEventListener('click', window.openTaxModal);
        document.getElementById('closeTaxModal').addEventListener('click', () => window.closeModal('taxModal'));
    }
    if (document.getElementById('openUpgradesBtn')) {
        document.getElementById('openUpgradesBtn').addEventListener('click', window.openUpgradesModal);
        document.getElementById('closeUpgradesModal').addEventListener('click', () => window.closeModal('upgradesModal'));
    }

    // 3. Вкладки (Цех, Склад, Затраты)
    const tabs = ['Machines', 'Storage', 'Costs'];
    tabs.forEach(tabName => {
        const btn = document.getElementById('tab' + tabName);
        if (btn) {
            btn.addEventListener('click', () => {
                tabs.forEach(t => {
                    const elTab = document.getElementById('tab' + t);
                    const elContent = document.getElementById(t.toLowerCase() + 'Tab');
                    if(elTab) elTab.classList.remove('active');
                    if(elContent) elContent.style.display = 'none';
                });
                document.getElementById('tab' + tabName).classList.add('active');
                document.getElementById(tabName.toLowerCase() + 'Tab').style.display = 'block';
            });
        }
    });

    // 4. Глобальные действия (Рестарт, Кредит, Новый день)
    if (document.getElementById('restartBtn')) {
        document.getElementById('restartBtn').addEventListener('click', window.restartGame);
    }
    document.getElementById('takeLoanBtn').addEventListener('click', () => window.openModal('loanModal'));
    document.getElementById('newDayBtn').addEventListener('click', () => {
        if (typeof window.nextDay === 'function') window.nextDay();
    });
    
    // 5. Обучающий тур
    document.getElementById('helpBtn').addEventListener('click', window.startTour);
    document.getElementById('tourNext').addEventListener('click', () => {
        currentTourStep++;
        if (currentTourStep < tourSteps.length) updateTourHighlight(); 
        else window.endTour();
    });
    document.getElementById('tourSkip').addEventListener('click', window.endTour);
    window.addEventListener('resize', () => {
        if (document.getElementById('tourOverlay').classList.contains('active')) updateTourHighlight();
    });
});
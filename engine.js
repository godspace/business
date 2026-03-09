// Глобальные переменные состояния игры
let game = null;
let cheaterDetected = false;

function getDailyCost() {
    if (!game) return DAILY_COST;
    let base = DAILY_COST;
    let machinesCost = game.equipment.length * 15; 
    
    // + Аренда текущего здания
    let stageRent = STAGES[game.stageLevel || 0].rent; 
    
    let total = base + machinesCost + stageRent;
    if (game.upgrades && game.upgrades.includes('logistics')) {
        total = Math.floor(total * 0.9);
    }
    return total;
}

function getRawMaterialCost(type) {
    let cost = BASE_COSTS[type];
    if (game && game.upgrades && game.upgrades.includes('logistics')) {
        cost = Math.max(1, Math.floor(cost * 0.9));
    }
    return cost;
}

function handleDailyEvent() {
    const r = Math.random();
    let cumulative = 0;
    for (let event of EVENTS) {
        cumulative += event.probability;
        if (r < cumulative) {
            const message = event.execute(game);
            if (message) window.showNotification(`❗️ ${event.name}\n\n${message}`);
            return; 
        }
    }
}

function simulateMarketDay() {
    if (!game || !game.market) return;
    for (let type in game.market) {
        let currentI = game.market[type];
        let deviation = currentI - 1.0; 
        let dynamicReturnSpeed = MARKET_RETURN_SPEED + Math.abs(deviation) * 0.25; 
        currentI -= deviation * dynamicReturnSpeed;
        let shock = (Math.random() * 2 - 1) * MARKET_PARAMS[type].volatility;
        currentI += shock;
        game.market[type] = Math.max(MARKET_MIN, Math.min(MARKET_MAX, currentI));
    }
}

function applyPlayerMarketImpact(type, volume) {
    if (!game || !game.market || !game.market[type]) return;
    let drop = volume * MARKET_PARAMS[type].k;
    game.market[type] -= drop;
    game.market[type] = Math.max(MARKET_MIN, Math.min(MARKET_MAX, game.market[type]));
}

function generateRandomOrder() {
    const types = ['toy', 'furniture', 'food'];
    const type = types[Math.floor(Math.random() * types.length)];
    const basePrice = BASE_PRICES[type];
    
    let marketIndex = (game && game.market && game.market[type]) ? game.market[type] : 1.0;
    if (game && game.upgrades && game.upgrades.includes('marketing')) {
        marketIndex *= 1.15;
    }
    
    // --- 1. МАСШТАБИРОВАНИЕ ЗАКАЗОВ ---
    // Чем больше станков, тем крупнее базовые заказы (на 15% за каждый станок)
    const factoryScale = game ? 1 + (game.equipment.length * 0.15) : 1; 

    let baseQuantity;
    const r = Math.random();
    if (r < 0.3) {
        if (type === 'toy') baseQuantity = 5 + Math.floor(Math.random() * 15);
        else if (type === 'furniture') baseQuantity = 2 + Math.floor(Math.random() * 4);
        else baseQuantity = 10 + Math.floor(Math.random() * 20);
    } else if (r < 0.7) {
        if (type === 'toy') baseQuantity = 20 + Math.floor(Math.random() * 40);
        else if (type === 'furniture') baseQuantity = 5 + Math.floor(Math.random() * 10);
        else baseQuantity = 30 + Math.floor(Math.random() * 50);
    } else {
        if (type === 'toy') baseQuantity = 60 + Math.floor(Math.random() * 100);
        else if (type === 'furniture') baseQuantity = 15 + Math.floor(Math.random() * 30);
        else baseQuantity = 80 + Math.floor(Math.random() * 150);
    }

    let quantity = Math.floor(baseQuantity * factoryScale);

    // --- 2. ИСПРАВЛЕННЫЙ ЗАКОН СПРОСА ---
    // Если индекс высокий (тренд) - покупают ЧУТЬ больше (подтверждаем текст события)
    // Если индекс низкий (кризис) - заказы становятся меньше
    quantity = Math.max(2, Math.floor(quantity * (0.5 + marketIndex / 2)));

    const daysLeft = 2 + Math.floor(Math.random() * 9);
    
    // --- 3. СБАЛАНСИРОВАННАЯ СРОЧНОСТЬ ---
    // Теперь максимальная наценка за 2 дня составит +40%, а не +86%
    const urgencyMultiplier = 1.0 + (10 - daysLeft) * 0.05; 
    
    // Оптовые скидки (адаптированы под новые, более крупные объемы заказов)
    let sizeMultiplier;
    if (type === 'toy') { sizeMultiplier = quantity < 30 ? 1.2 : (quantity < 100 ? 1.0 : 0.85); } 
    else if (type === 'furniture') { sizeMultiplier = quantity < 10 ? 1.25 : (quantity < 25 ? 1.0 : 0.8); } 
    else { sizeMultiplier = quantity < 40 ? 1.15 : (quantity < 120 ? 1.0 : 0.9); }

    const pricePerUnit = Math.floor(basePrice * urgencyMultiplier * sizeMultiplier * marketIndex);
    
    return {
        id: 'order_' + Date.now() + Math.random(),
        productType: type,
        quantity: quantity,
        pricePerUnit: pricePerUnit,
        daysLeft: daysLeft,
        penaltyRate: 0.1,
        totalValue: quantity * pricePerUnit
    };
}

function recalcRating() {
    const totalDebt = game.activeLoans.reduce((sum, loan) => sum + loan.amount, 0);
    const netWorth = game.cash - totalDebt;
    let rating = Math.floor(netWorth / 10);
    rating += game.equipment.filter(m => m.health > 0).length * 30;
    rating += game.completedOrders * 20;
    rating -= game.failedOrders * 30;
    rating += game.day;
    rating += (game.upgrades ? game.upgrades.length * 100 : 0);
    game.rating = Math.max(0, rating);
}

function hasWorkingMachine(type) {
    return game.equipment.some(m => m.productType === type && m.health > 0);
}

function getProductName(type) {
    return PRODUCT_TYPES[type]?.name || type;
}

// Глобальные игровые действия
window.takeOrder = function(orderId) {
    if (cheaterDetected) return;
    const index = game.availableOrders.findIndex(o => o.id === orderId);
    if (index === -1) return;
    const order = game.availableOrders[index];
    if (!hasWorkingMachine(order.productType)) {
        window.showNotification('❌ У вас нет станков для этого товара! Купите станок.');
        return;
    }
    game.myOrders.push({ ...order });
    game.availableOrders.splice(index, 1);
    window.showNotification(`✅ Заказ принят! Товары будут отправлены автоматически.`);
    window.render();
};

window.cancelOrder = function(orderId) {
    if (cheaterDetected) return;
    const index = game.myOrders.findIndex(o => o.id === orderId);
    if (index === -1) return;
    
    const order = game.myOrders[index];
    const penalty = Math.max(1, Math.floor(order.totalValue * order.penaltyRate));
    const confirmCancel = confirm(`Вы уверены, что хотите отказаться от заказа?\nВам придется выплатить неустойку: ${penalty} монет.`);
    
    if (confirmCancel) {
        game.cash -= penalty;
        game.failedOrders++;
        game.myOrders.splice(index, 1);
        window.showNotification(`📉 Вы отказались от заказа. Уплачена неустойка ${penalty} монет.`);
        window.render();
    }
};

window.buyMachine = function(machineId) {
    if (cheaterDetected) return;
    // --- ПРОВЕРКА ЛИМИТА ПОМЕЩЕНИЯ ---
    const currentStage = STAGES[game.stageLevel || 0];
    if (game.equipment.length >= currentStage.maxMachines) {
        window.showNotification(`🏢 Нет места!\n\nВаше здание (${currentStage.name}) вмещает максимум ${currentStage.maxMachines} станка.\nКупите новое помещение во вкладке "ЦЕХ".`);
        return;
    }
    // --- КОНЕЦ ПРОВЕРКИ ---

    const machineTemplate = MACHINES.find(m => m.id === machineId);
    if (!machineTemplate) return;
    if (game.cash < machineTemplate.price) {
        window.showNotification('💰 Недостаточно денег для покупки!');
        return;
    }
    game.cash -= machineTemplate.price;
    const newMachine = {
        ...machineTemplate,
        baseOutputPerDay: machineTemplate.outputPerDay, 
        performance: 1.0, 
        health: 100,
        uid: machineTemplate.id + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8)
    };
    game.equipment.push(newMachine);
    window.showNotification(`✨ Отлично! На фабрику установлен ${machineTemplate.name}`);
    window.render();
    window.closeModal('shopModal');
};

// --- ПОКУПКА ЗДАНИЯ ---
window.buyBuilding = function(level) {
    if (cheaterDetected) return;
    const stage = STAGES.find(s => s.level === level);
    if (!stage) return;
    
    if (game.cash < stage.price) {
        window.showNotification(`💰 Недостаточно денег на счету! Нужно ${stage.price} монет.`);
        return;
    }
    
    game.cash -= stage.price;
    game.stageLevel = level;
    
    window.showNotification(`🎉 Поздравляем с переездом!\n\nВы приобрели "${stage.name}".\nЛимит станков: ${stage.maxMachines} шт.`);
    window.render();
    window.closeModal('buildingsModal');
};

window.upgradeBuilding = function() {
    if (cheaterDetected) return;
    const level = game.stageLevel || 0;
    const currentStage = STAGES[level];
    
    if (currentStage.upgradeCost === null) {
        window.showNotification('🏢 У вас уже самое современное производство!');
        return;
    }
    
    if (game.cash < currentStage.upgradeCost) {
        window.showNotification(`💰 Не хватает денег на расширение! Нужно ${currentStage.upgradeCost} монет.`);
        return;
    }
    
    const confirmUpgrade = confirm(`Вы хотите переехать в новое здание?\n\nСтоимость переезда: ${currentStage.upgradeCost} монет.\nАренда возрастет до ${STAGES[level+1].rent} монет в день.`);
    
    if (confirmUpgrade) {
        game.cash -= currentStage.upgradeCost;
        game.stageLevel = level + 1;
        window.showNotification(`🎉 Поздравляем!\n\nВы переехали в ${STAGES[game.stageLevel].name}! Теперь у вас больше места для станков.`);
        window.render();
    }
};

window.repairMachineFromModal = function() {
    if (cheaterDetected || !window.currentMachineUid) return;
    const machine = game.equipment.find(m => m.uid === window.currentMachineUid);
    if (!machine) return;
    
    if (machine.health >= 100) {
        window.showNotification('✨ Станок и так в идеальном состоянии!');
        return;
    }
    const repairCost = Math.floor(machine.price * 0.3);
    if (game.cash < repairCost) {
        window.showNotification(`💰 Нужно ${repairCost} монет на ремонт. Не хватает!`);
        return;
    }
    game.cash -= repairCost;
    machine.health = 100;
    window.showNotification(`🔧 Станок отремонтирован! (-${repairCost} монет)`);
    
    document.getElementById('machineModalHealth').innerText = machine.health;
    const sellPrice = Math.floor(machine.price * 0.5 * (machine.health / 100));
    document.getElementById('machineModalSellBtn').innerText = `💰 Продать (${sellPrice} 💰)`;
    window.render();
};

window.sellMachine = function() {
    if (cheaterDetected || !window.currentMachineUid) return;
    const index = game.equipment.findIndex(m => m.uid === window.currentMachineUid);
    if (index === -1) return;
    
    const machine = game.equipment[index];
    const sellPrice = Math.floor(machine.price * 0.5 * (machine.health / 100));
    game.cash += sellPrice;
    game.equipment.splice(index, 1);
    
    window.showNotification(`🤝 Станок продан за ${sellPrice} монет.`);
    window.closeModal('machineModal');
    window.render();
};

window.buyUpgrade = function(upgradeId) {
    if (cheaterDetected) return;
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return;
    
    if (game.cash < upgrade.price) {
        window.showNotification('💰 Недостаточно денег для инвестиций!');
        return;
    }
    
    game.cash -= upgrade.price;
    if (!game.upgrades) game.upgrades = [];
    game.upgrades.push(upgrade.id);
    
    window.showNotification(`🚀 Улучшение "${upgrade.name}" успешно внедрено на фабрике!`);
    window.openUpgradesModal();
    window.render();
};

window.takeLoan = function(offerId, amount) {
    if (cheaterDetected) return;
    if (game.activeLoans.length >= MAX_LOANS) {
        window.showNotification(`❌ Нельзя взять больше ${MAX_LOANS} кредитов одновременно`);
        return;
    }
    const offer = LOAN_OFFERS.find(o => o.id === offerId);
    if (!offer) return;
    if (amount > offer.maxAmount || amount <= 0) return;
    game.cash += amount;
    game.activeLoans.push({ amount: amount, interestRate: offer.interestRate, daysLeft: offer.termDays });
    window.showNotification(`💳 Кредит на ${amount} монет успешно оформлен.`);
    window.render();
    window.closeModal('loanModal');
};

window.nextDay = function() {
    if (cheaterDetected) return;

    const currentDailyCost = getDailyCost();
    game.cash -= currentDailyCost;

    if (game.cash < 0) {
        const penalty = Math.ceil(Math.abs(game.cash) * 0.05); 
        game.cash -= penalty;
        window.showNotification(`🚨 Отрицательный баланс!\n\nВаш счет ушел в минус. Банк начислил штраф ${penalty} монет за овердрафт.\nСрочно отгрузите готовые заказы или возьмите кредит!`);
        
        if (game.cash <= -1000) {
            window.showNotification(`💥 БАНКРОТСТВО!\n\nВаш долг превысил -1000 монет. Судебные приставы опечатали фабрику. Игра окончена.`);
            document.querySelectorAll('button:not(.close-modal)').forEach(b => b.disabled = true);
            return;
        }
    }

    if (game.day > 1 && game.day % 30 === 1) { 
        let tax = 0;
        if (game.monthlyIncome > 0) {
            tax = Math.floor(game.monthlyIncome * 0.13); 
            game.cash -= tax; 
            window.showNotification(`📝 Налоговая декларация\n\nМесяц завершен! Вы заработали ${game.monthlyIncome} монет.\nУдержан налог (13%): ${tax} монет.`);
        }
        game.taxHistory.push({ month: Math.floor(game.day / 30), income: game.monthlyIncome, tax: tax });
        game.monthlyIncome = 0; 
    }

    handleDailyEvent();

    game.equipment.forEach(m => {
        if (m.health <= 0) return;
        const type = m.productType;
        const perf = m.performance || 1.0;
        const out = Math.floor((m.baseOutputPerDay || m.outputPerDay) * perf); 
        
        const cost = getRawMaterialCost(type) * out;
        
        if (game.cash >= cost) {
            game.cash -= cost;
            game.storage[type] += out;
        } else {
            window.showNotification(`⚠️ Станок (${PRODUCT_TYPES[type].icon}) простаивает: не хватило денег на сырье!`);
        }
    });

    game.equipment.forEach(m => {
        if (m.health <= 0) return;
        const perf = m.performance || 1.0;
        let wear = Math.floor((4 + Math.random() * 9) * perf); 
        
        if (game.upgrades && game.upgrades.includes('maintenance')) {
            wear = Math.floor(wear * 0.75);
        }
        
        m.health = Math.max(0, m.health - wear);
        if (m.health <= 0) {
            window.showNotification(`💥 КАТАСТРОФА! Станок ${m.name} не выдержал нагрузки, сломался и был сдан в металлолом!`);
        } 
    });
    game.equipment = game.equipment.filter(m => m.health > 0);

    game.myOrders.sort((a, b) => a.daysLeft - b.daysLeft);

    let blockedProductTypes = {};

    for (let i = 0; i < game.myOrders.length; ) {
        const order = game.myOrders[i];
        if (blockedProductTypes[order.productType]) { i++; continue; }

        if (game.storage[order.productType] >= order.quantity) {
            game.storage[order.productType] -= order.quantity;
            const income = order.quantity * order.pricePerUnit;
            game.cash += income;
            game.monthlyIncome += income; 
            
            applyPlayerMarketImpact(order.productType, order.quantity);

            game.myOrders.splice(i, 1);
            game.completedOrders++;
            
            window.showNotification(`🎉 Выполнен заказ: ${order.quantity} шт. ${getProductName(order.productType)}.\nПрибыль: +${income} монет!`);
        } else {
            blockedProductTypes[order.productType] = true;
            i++;
        }
    }

    for (let i = game.myOrders.length - 1; i >= 0; i--) {
        const order = game.myOrders[i];
        order.daysLeft -= 1;
        if (order.daysLeft < 0) {
            const penalty = Math.floor(order.quantity * order.pricePerUnit * order.penaltyRate);
            game.cash -= penalty; 
            game.myOrders.splice(i, 1);
            game.failedOrders++;
            window.showNotification(`💔 Вы подвели клиента. Заказ просрочен, штраф: ${penalty} монет.`);
        }
    }

    for (let i = game.activeLoans.length - 1; i >= 0; i--) {
        const loan = game.activeLoans[i];
        const interest = Math.floor(loan.amount * loan.interestRate);
        loan.amount += interest;
        loan.daysLeft -= 1;

        if (loan.daysLeft <= 0) {
            const paidAmount = Math.round(loan.amount);
            game.cash -= paidAmount; 
            game.activeLoans.splice(i, 1); 
            
            if (game.cash < 0) {
                window.showNotification(`⚠️ СРОК КРЕДИТА ИСТЕК!\n\nБанк принудительно списал ${paidAmount} монет. Ваш счет ушел в минус!`);
            } else {
                window.showNotification(`✅ Банк списал долг по кредиту (${paidAmount} монет).`);
            }
        }
    }

    for (let i = game.availableOrders.length - 1; i >= 0; i--) {
        const order = game.availableOrders[i];
        order.daysLeft -= 1;
        if (order.daysLeft <= 0) game.availableOrders.splice(i, 1);
    }

    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
        game.availableOrders.push(generateRandomOrder());
    }

    simulateMarketDay();
    game.day += 1;
    window.render();
};
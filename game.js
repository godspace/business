(function() {
    let game = null;
    let cheaterDetected = false;
    let currentMachineUid = null; 

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

    const BASE_PRICES = { toy: 22, furniture: 45, food: 12 };
    const BASE_COSTS = { toy: 5, furniture: 20, food: 3 };

    // --- ПРОГРЕССИВНАЯ ЕЖЕДНЕВНАЯ ПЛАТА ---
    function getDailyCost() {
        if (!game) return 30;
        let base = 30;
        let machinesCost = game.equipment.length * 15; // +15 монет за каждый станок
        let total = base + machinesCost;
        
        // Скидка от логистики
        if (game.upgrades && game.upgrades.includes('logistics')) {
            total = Math.floor(total * 0.9); // -10%
        }
        return total;
    }

    // --- ОТДЕЛ УЛУЧШЕНИЙ ---
    const UPGRADES = [
        { id: 'marketing', name: '📢 Бренд-менеджмент', desc: 'Все новые заказы стоят на 15% дороже', price: 2000 },
        { id: 'maintenance', name: '🛠️ Качественное масло', desc: 'Станки изнашиваются на 25% медленнее', price: 1500 },
        { id: 'logistics', name: '🚚 Своя фура', desc: 'Снижает плату за день и стоимость сырья на 10%', price: 2500 }
    ];

    function getRawMaterialCost(type) {
        let cost = BASE_COSTS[type];
        if (game && game.upgrades && game.upgrades.includes('logistics')) {
            cost = Math.max(1, Math.floor(cost * 0.9));
        }
        return cost;
    }

    const PRODUCT_TYPES = {
        toy: { name: '🧸 Игрушки', cost: BASE_COSTS.toy, img: 'https://raw.githubusercontent.com/godspace/business/main/BUTTONS/toy_button.png', icon: '🧸' },
        furniture: { name: '🪑 Мебель', cost: BASE_COSTS.furniture, img: 'https://raw.githubusercontent.com/godspace/business/main/BUTTONS/wood_button.png', icon: '🪑' },
        food: { name: '🍫 Еда', cost: BASE_COSTS.food, img: 'https://raw.githubusercontent.com/godspace/business/main/BUTTONS/food_button.png', icon: '🍫' }
    };

    const MACHINES = [
        { id: 'machine_toy', name: 'Станок Игрушек', productType: 'toy', price: 600, outputPerDay: 10, costPerItem: BASE_COSTS.toy },
        { id: 'machine_furniture', name: 'Станок Мебели', productType: 'furniture', price: 1000, outputPerDay: 5, costPerItem: BASE_COSTS.furniture },
        { id: 'machine_food', name: 'Пищевой Станок', productType: 'food', price: 800, outputPerDay: 15, costPerItem: BASE_COSTS.food }
    ];

    const LOAN_OFFERS = [
        { id: 'loan_small', name: '🐣 Быстрый займ (до 500)', maxAmount: 500, interestRate: 0.02, termDays: 7 },
        { id: 'loan_medium', name: '🦊 Развитие (до 1000)', maxAmount: 1000, interestRate: 0.025, termDays: 10 },
        { id: 'loan_big', name: '🐻 Капитал (до 2000)', maxAmount: 2000, interestRate: 0.03, termDays: 15 }
    ];

    const MAX_LOANS = 2;
    const MARKET_MIN = 0.4;  
    const MARKET_MAX = 2.5;  
    const MARKET_RETURN_SPEED = 0.1; 

    const MARKET_PARAMS = {
        toy: { k: 0.002, volatility: 0.04 },
        furniture: { k: 0.015, volatility: 0.06 }, 
        food: { k: 0.0005, volatility: 0.02 }      
    };

    const EVENTS = [
        {
            name: "🎉 Государственный грант",
            probability: 0.08, 
            execute: (game) => {
                const bonus = Math.floor(game.cash * 0.20);
                const finalBonus = Math.min(bonus, 400);
                if (finalBonus <= 0) return null;
                game.cash += finalBonus;
                return `Программа поддержки малого бизнеса дарит вам +20% к капиталу!\nВы получили ${finalBonus} монет.`;
            }
        },
        {
            name: "⚡ Авария на электростанции",
            probability: 0.08, 
            execute: (game) => {
                const fine = Math.floor(game.cash * 0.05) + 30;
                game.cash -= fine; 
                return `Из-за скачка напряжения сгорели предохранители. Замена обошлась вам в ${fine} монет.`;
            }
        },
        {
            name: "🧯 Пожарная инспекция",
            probability: 0.10, 
            execute: (game) => {
                const machinesCount = game.equipment.filter(m => m.health > 0).length;
                if (machinesCount === 0) return null; 
                const fine = machinesCount * 25; 
                game.cash -= fine;
                return `Инспектор выписал штраф за нарушение техники безопасности: по 25 монет за каждый работающий станок.\nУдержано ${fine} монет.`;
            }
        },
        {
            name: "🤝 Программа рефинансирования",
            probability: 0.12, 
            execute: (game) => {
                if (game.cash >= 0) return null; 
                const help = Math.floor(Math.abs(game.cash) * 0.50); 
                game.cash += help;
                return `Антикризисный фонд помогает должникам! Вам безвозмездно погасили 50% вашего овердрафта.\nСписано ${help} монет долга.`;
            }
        },
        {
            name: "🐀 Крысы на складе",
            probability: 0.08, 
            execute: (game) => {
                if (game.storage.food > 0) {
                    const lostFood = Math.ceil(game.storage.food * 0.20);
                    game.storage.food -= lostFood;
                    const lostValue = lostFood * BASE_COSTS.food;
                    return `Грызуны пробрались на склад и испортили 20% ваших запасов еды!\nСписано ${lostFood} шт. (убыток по себестоимости: ${lostValue} 💰).`;
                }
                return null; 
            }
        },
        {
            name: "🏆 Премия 'Лучший работодатель'",
            probability: 0.05, 
            execute: (game) => {
                const machinesCount = game.equipment.filter(m => m.health > 0).length;
                if (machinesCount < 3) return null; 
                const bonus = 150;
                game.cash += bonus;
                return `Мэрия наградила вашу фабрику за создание рабочих мест!\nПризовой фонд: +${bonus} монет.`;
            }
        },
        {
            name: "📈 Вирусный тренд",
            probability: 0.08, 
            execute: (game) => {
                game.market.toy = Math.min(2.5, game.market.toy + 0.8);
                return `Известный блогер сделал обзор на ваши игрушки! Спрос взлетел до небес.\nИндекс рынка игрушек резко вырос. Успейте продать их по максимальной цене, пока тренд не прошел!`;
            }
        },
        {
            name: "📉 Кризис недвижимости",
            probability: 0.08, 
            execute: (game) => {
                game.market.furniture = Math.max(0.4, game.market.furniture - 0.5);
                return `Люди перестали покупать новые квартиры, и спрос на мебель рухнул.\nЦены на рынке мебели сильно упали. Лучше пока придержать готовые стулья на складе!`;
            }
        },
        {
            name: "🥦 Мода на ЗОЖ",
            probability: 0.07, 
            execute: (game) => {
                game.market.food = Math.max(0.4, game.market.food - 0.4);
                return `В соцсетях завирусился тренд на здоровое питание. Спрос на шоколад и сладости резко упал!\nИндекс рынка еды снизился. Производство еды временно менее выгодно.`;
            }
        },
        {
            name: "🎈 Городской фестиваль",
            probability: 0.08, 
            execute: (game) => {
                game.market.toy = Math.min(2.5, game.market.toy + 0.4);
                game.market.food = Math.min(2.5, game.market.food + 0.3);
                return `Мэрия объявила неделю детских праздников! Толпы туристов скупают сувениры.\nСпрос на игрушки и сладости сильно вырос. Отличный шанс продать запасы со склада по высокой цене!`;
            }
        },
        {
            name: "🏗️ Бум новостроек",
            probability: 0.07, 
            execute: (game) => {
                game.market.furniture = Math.min(2.5, game.market.furniture + 0.6);
                return `В городе сдали новый огромный жилой микрорайон. Всем новоселам срочно нужна мебель!\nИндекс рынка мебели взлетел. Самое время брать крупные заказы на стулья.`;
            }
        }
    ];

    function handleDailyEvent() {
        const r = Math.random();
        let cumulative = 0;
        for (let event of EVENTS) {
            cumulative += event.probability;
            if (r < cumulative) {
                const message = event.execute(game);
                if (message) {
                    showNotification(`❗️ ${event.name}\n\n${message}`);
                }
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

    let notificationQueue = [];
    let notificationModalActive = false;

    function getSaveKey(name) { return 'little_entrepreneur_' + (name || 'default'); }

    function loadProfileList() {
        const select = document.getElementById('profileSelect');
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
    }

    function saveGame() {
        if (!game || !game.playerName) return;
        try {
            localStorage.setItem(getSaveKey(game.playerName), JSON.stringify(game));
            loadProfileList();
        } catch (e) {}
    }

    function generateRandomOrder() {
        const types = ['toy', 'furniture', 'food'];
        const type = types[Math.floor(Math.random() * types.length)];
        const basePrice = BASE_PRICES[type];
        
        let marketIndex = (game && game.market && game.market[type]) ? game.market[type] : 1.0;
        
        // Бонус от маркетинга
        if (game && game.upgrades && game.upgrades.includes('marketing')) {
            marketIndex *= 1.15;
        }
        
        let quantity;
        const r = Math.random();
        if (r < 0.3) {
            if (type === 'toy') quantity = 5 + Math.floor(Math.random() * 15);
            else if (type === 'furniture') quantity = 2 + Math.floor(Math.random() * 4);
            else quantity = 10 + Math.floor(Math.random() * 20);
        } else if (r < 0.7) {
            if (type === 'toy') quantity = 20 + Math.floor(Math.random() * 40);
            else if (type === 'furniture') quantity = 5 + Math.floor(Math.random() * 10);
            else quantity = 30 + Math.floor(Math.random() * 50);
        } else {
            if (type === 'toy') quantity = 60 + Math.floor(Math.random() * 100);
            else if (type === 'furniture') quantity = 15 + Math.floor(Math.random() * 30);
            else quantity = 80 + Math.floor(Math.random() * 150);
        }

        quantity = Math.max(2, Math.floor(quantity / marketIndex));

        const daysLeft = 2 + Math.floor(Math.random() * 9);
        const urgencyMultiplier = 0.9 + (10 - daysLeft) * 0.12;
        
        let sizeMultiplier;
        if (type === 'toy') { sizeMultiplier = quantity < 20 ? 1.2 : (quantity < 60 ? 1.0 : 0.85); } 
        else if (type === 'furniture') { sizeMultiplier = quantity < 7 ? 1.25 : (quantity < 15 ? 1.0 : 0.8); } 
        else { sizeMultiplier = quantity < 30 ? 1.15 : (quantity < 80 ? 1.0 : 0.9); }

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
        
        // Бонус за улучшения
        rating += (game.upgrades ? game.upgrades.length * 100 : 0);
        
        game.rating = Math.max(0, rating);
    }

    function hasWorkingMachine(type) {
        return game.equipment.some(m => m.productType === type && m.health > 0);
    }

    function getProductName(type) {
        return PRODUCT_TYPES[type]?.name || type;
    }

    function showNotification(message) {
        notificationQueue.push(message);
        if (!notificationModalActive) showNextNotification();
    }

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

    function closeNotification() {
        document.getElementById('notificationModal').classList.remove('active');
        notificationModalActive = false;
        showNextNotification();
    }

    function takeOrder(orderId) {
        if (cheaterDetected) return;
        const index = game.availableOrders.findIndex(o => o.id === orderId);
        if (index === -1) return;
        const order = game.availableOrders[index];
        if (!hasWorkingMachine(order.productType)) {
            showNotification('❌ У вас нет станков для этого товара! Купите станок.');
            return;
        }
        game.myOrders.push({ ...order });
        game.availableOrders.splice(index, 1);
        showNotification(`✅ Заказ принят! Товары будут отправлены автоматически.`);
        render();
    }

    // --- ОТМЕНА ЗАКАЗА ---
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
            showNotification(`📉 Вы отказались от заказа. Уплачена неустойка ${penalty} монет.`);
            render();
        }
    };

    window.buyMachine = function(machineId) {
        if (cheaterDetected) return;
        const machineTemplate = MACHINES.find(m => m.id === machineId);
        if (!machineTemplate) return;
        if (game.cash < machineTemplate.price) {
            showNotification('💰 Недостаточно денег для покупки!');
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
        showNotification(`✨ Отлично! На фабрику установлен ${machineTemplate.name}`);
        render();
        closeModal('shopModal');
    };

    window.openMachineModal = function(uid) {
        if (cheaterDetected) return;
        const machine = game.equipment.find(m => m.uid === uid);
        if (!machine) return;
        
        currentMachineUid = uid;
        
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
            saveGame();
            render(); 
        };
        updateSliderLabels();

        const repairCost = Math.floor(machine.price * 0.3);
        document.getElementById('machineModalRepairBtn').innerText = `🔧 Починить (${repairCost} 💰)`;
        
        const sellPrice = Math.floor(machine.price * 0.5 * (machine.health / 100)); 
        document.getElementById('machineModalSellBtn').innerText = `💰 Продать (${sellPrice > 0 ? sellPrice : 0} 💰)`;

        document.getElementById('machineModal').classList.add('active');
    };

    window.repairMachineFromModal = function() {
        if (cheaterDetected || !currentMachineUid) return;
        const machine = game.equipment.find(m => m.uid === currentMachineUid);
        if (!machine) return;
        
        if (machine.health >= 100) {
            showNotification('✨ Станок и так в идеальном состоянии!');
            return;
        }
        const repairCost = Math.floor(machine.price * 0.3);
        if (game.cash < repairCost) {
            showNotification(`💰 Нужно ${repairCost} монет на ремонт. Не хватает!`);
            return;
        }
        game.cash -= repairCost;
        machine.health = 100;
        showNotification(`🔧 Станок отремонтирован! (-${repairCost} монет)`);
        
        document.getElementById('machineModalHealth').innerText = machine.health;
        const sellPrice = Math.floor(machine.price * 0.5 * (machine.health / 100));
        document.getElementById('machineModalSellBtn').innerText = `💰 Продать (${sellPrice} 💰)`;
        
        render();
    };

    window.sellMachine = function() {
        if (cheaterDetected || !currentMachineUid) return;
        const index = game.equipment.findIndex(m => m.uid === currentMachineUid);
        if (index === -1) return;
        
        const machine = game.equipment[index];
        const sellPrice = Math.floor(machine.price * 0.5 * (machine.health / 100));
        game.cash += sellPrice;
        game.equipment.splice(index, 1);
        
        showNotification(`🤝 Станок продан за ${sellPrice} монет.`);
        closeModal('machineModal');
        render();
    };

    function takeLoan(offerId, amount) {
        if (cheaterDetected) return;
        if (game.activeLoans.length >= MAX_LOANS) {
            showNotification(`❌ Нельзя взять больше ${MAX_LOANS} кредитов одновременно`);
            return;
        }
        const offer = LOAN_OFFERS.find(o => o.id === offerId);
        if (!offer) return;
        if (amount > offer.maxAmount || amount <= 0) return;
        game.cash += amount;
        game.activeLoans.push({ amount: amount, interestRate: offer.interestRate, daysLeft: offer.termDays });
        showNotification(`💳 Кредит на ${amount} монет успешно оформлен.`);
        render();
        closeModal('loanModal');
    }

    function nextDay() {
        if (cheaterDetected) return;

        // Взимаем прогрессивную плату
        const currentDailyCost = getDailyCost();
        game.cash -= currentDailyCost;

        if (game.cash < 0) {
            const penalty = Math.ceil(Math.abs(game.cash) * 0.05); 
            game.cash -= penalty;
            
            showNotification(`🚨 Отрицательный баланс!\n\nВаш счет ушел в минус. Банк начислил штраф ${penalty} монет за овердрафт.\nСрочно отгрузите готовые заказы или возьмите кредит!`);
            
            if (game.cash <= -1000) {
                showNotification(`💥 БАНКРОТСТВО!\n\nВаш долг превысил -1000 монет. Судебные приставы опечатали фабрику. Игра окончена.`);
                document.querySelectorAll('button:not(.close-modal)').forEach(b => b.disabled = true);
                return;
            }
        }

        if (game.day > 1 && game.day % 30 === 1) { 
            let tax = 0;
            if (game.monthlyIncome > 0) {
                tax = Math.floor(game.monthlyIncome * 0.13); 
                game.cash -= tax; 
                showNotification(`📝 Налоговая декларация\n\nМесяц завершен! Вы заработали ${game.monthlyIncome} монет.\nУдержан налог (13%): ${tax} монет.`);
            }
            
            game.taxHistory.push({
                month: Math.floor(game.day / 30),
                income: game.monthlyIncome,
                tax: tax
            });
            
            game.monthlyIncome = 0; 
        }

        handleDailyEvent();

        game.equipment.forEach(m => {
            if (m.health <= 0) return;
            const type = m.productType;
            const perf = m.performance || 1.0;
            const out = Math.floor((m.baseOutputPerDay || m.outputPerDay) * perf); 
            
            // Затраты на сырье с учетом логистики
            const cost = getRawMaterialCost(type) * out;
            
            if (game.cash >= cost) {
                game.cash -= cost;
                game.storage[type] += out;
            } else {
                showNotification(`⚠️ Станок (${PRODUCT_TYPES[type].icon}) простаивает: не хватило денег на сырье!`);
            }
        });

        game.equipment.forEach(m => {
            if (m.health <= 0) return;
            const perf = m.performance || 1.0;
            let wear = Math.floor((4 + Math.random() * 9) * perf); 
            
            // Бонус рембазы (износ медленнее)
            if (game.upgrades && game.upgrades.includes('maintenance')) {
                wear = Math.floor(wear * 0.75);
            }
            
            m.health = Math.max(0, m.health - wear);
            if (m.health <= 0) {
                showNotification(`💥 КАТАСТРОФА! Станок ${m.name} не выдержал нагрузки, сломался и был сдан в металлолом!`);
            } 
        });
        game.equipment = game.equipment.filter(m => m.health > 0);

        game.myOrders.sort((a, b) => a.daysLeft - b.daysLeft);

        let blockedProductTypes = {};

        for (let i = 0; i < game.myOrders.length; ) {
            const order = game.myOrders[i];
            
            if (blockedProductTypes[order.productType]) {
                i++; 
                continue;
            }

            if (game.storage[order.productType] >= order.quantity) {
                game.storage[order.productType] -= order.quantity;
                const income = order.quantity * order.pricePerUnit;
                game.cash += income;
                game.monthlyIncome += income; 
                
                applyPlayerMarketImpact(order.productType, order.quantity);

                game.myOrders.splice(i, 1);
                game.completedOrders++;
                
                showNotification(`🎉 Выполнен заказ: ${order.quantity} шт. ${getProductName(order.productType)}.\nПрибыль: +${income} монет!`);
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
                showNotification(`💔 Вы подвели клиента. Заказ просрочен, штраф: ${penalty} монет.`);
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
                    showNotification(`⚠️ СРОК КРЕДИТА ИСТЕК!\n\nБанк принудительно списал ${paidAmount} монет. Ваш счет ушел в минус!`);
                } else {
                    showNotification(`✅ Банк списал долг по кредиту (${paidAmount} монет).`);
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
        render();
    }

    function render() {
        if (cheaterDetected) return;
        recalcRating();

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

        const machinesDiv = document.getElementById('machinesTab');
        let factoryHtml = '';

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

        factoryHtml += `<div class="factory-grid">`;
        const totalSlots = Math.max(8, game.equipment.length + (4 - (game.equipment.length % 4))); 

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
                <div class="machine-sprite empty-slot" onclick="openModal('shopModal')" data-tooltip="Купить новый станок">
                    +
                </div>`;
            }
        }
        factoryHtml += `</div>`;
        
        if(game.equipment.length > 0) {
             factoryHtml += `<div style="text-align:center; color:#7fa6c2; font-size: 1rem; margin-bottom:10px;">⚙️ Кликни по станку для настройки или ремонта.</div>`;
        }
        machinesDiv.innerHTML = factoryHtml;

        const storageDiv = document.getElementById('storageTab');
        const nonEmpty = Object.entries(game.storage).filter(([_, v]) => v > 0);
        if (nonEmpty.length === 0) {
            storageDiv.innerHTML = '<div style="text-align:center; margin-top: 20px;">🕸️ На складе гуляет ветер</div>';
        } else {
            storageDiv.innerHTML = nonEmpty.map(([type, amount]) => {
                const cost = getRawMaterialCost(type);
                return `<div class="storage-item">
                    <span>${getProductName(type)}</span>
                    <span><strong style="font-size: 1.3rem;">📦 ${amount} шт</strong> <span style="color:#555; font-size:0.9rem;">(себест. ${cost} мон)</span></span>
                </div>`;
            }).join('');
        }

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
                    const dailyCost = currentOut * getRawMaterialCost(m.productType);
                    
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

        document.querySelectorAll('.take-btn').forEach(btn => {
            btn.addEventListener('click', (e) => takeOrder(e.target.dataset.id));
        });

        saveGame();
    }

    // --- ФУНКЦИИ УЛУЧШЕНИЙ ---
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

    window.buyUpgrade = function(upgradeId) {
        if (cheaterDetected) return;
        const upgrade = UPGRADES.find(u => u.id === upgradeId);
        if (!upgrade) return;
        
        if (game.cash < upgrade.price) {
            showNotification('💰 Недостаточно денег для инвестиций!');
            return;
        }
        
        game.cash -= upgrade.price;
        if (!game.upgrades) game.upgrades = [];
        game.upgrades.push(upgrade.id);
        
        showNotification(`🚀 Улучшение "${upgrade.name}" успешно внедрено на фабрике!`);
        window.openUpgradesModal();
        render();
    };

    window.openModal = function(id) {
        document.getElementById(id).classList.add('active');
        if (id === 'shopModal') fillShopModal();
        if (id === 'loanModal') fillLoanModal();
    };

    function closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }

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
            showNotification('❌ Ошибка: Введена неверная сумма!');
            return;
        }
        takeLoan(offerId, amount);
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

    const tourSteps = [
        { element: '.money', text: '💰 Здесь твои деньги. Зарабатывай их, выполняя заказы!' },
        { element: '.day', text: '📅 Каждый день нажимай кнопку "НОВЫЙ ДЕНЬ", чтобы производить товары и получать новые заказы.' },
        { element: '.rating', text: '⭐ Рейтинг показывает, насколько успешно ты ведёшь дело. Растёт от прибыли и выполненных заказов.' },
        { element: '#restartBtn', text: '🔄 Если долги тянут на дно, эта кнопка позволит сбросить прогресс и начать игру с чистого листа.' },
        { element: '#ordersContainer', text: '📋 Рынок и заказы. Следи за процентами рынка: если цена падает, лучше не брать заказы на этот товар!' },
        { element: '#myOrdersContainer', text: '⏳ Взятые заказы. В первую очередь выполняются те заказы, у которых меньше всего дней до просрочки.' },
        { element: '#tabMachines', text: '🏭 Вкладка "ЦЕХ". Нажимай на станки для настройки нагрузки, ремонта или продажи.' },
        { element: '#tabStorage', text: '📦 Вкладка "СКЛАД" — здесь хранится готовая продукция и видна её себестоимость.' },
        { element: '#tabCosts', text: '📉 Вкладка "ЗАТРАТЫ" показывает, какую сумму ежедневно съедает закупка сырья для твоих станков.' },
        { element: '#activeLoansContainer', text: '🏦 Активные кредиты. Не бери больше двух сразу, иначе рейтинг упадёт.' },
        { element: '#showTaxBtn', text: '📊 График "Доходы и Налоги". Помни: каждый 30-й день государство забирает 13% от твоих доходов за месяц!' },
        { element: '#newDayBtn', text: '➡️ НОВЫЙ ДЕНЬ. Запускает производство, списывает ежедневную плату и приносит заказы.' }
    ];

    let currentTourStep = 0;
    const tourOverlay = document.getElementById('tourOverlay');
    const tourHighlight = document.getElementById('tourHighlight');
    const tourTooltip = document.getElementById('tourTooltip');
    const tourText = document.getElementById('tourText');
    const tourNext = document.getElementById('tourNext');
    const tourSkip = document.getElementById('tourSkip');
    const helpBtn = document.getElementById('helpBtn');

    function updateTourHighlight() {
        const step = tourSteps[currentTourStep];
        const element = document.querySelector(step.element);
        if (!element) {
            currentTourStep++;
            if (currentTourStep < tourSteps.length) updateTourHighlight();
            else endTour();
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

    function startTour() {
        if (!game || !game.playerName) {
            showNotification('Сначала войдите в игру');
            return;
        }
        helpBtn.classList.remove('help-icon-attention');
        currentTourStep = 0;
        tourOverlay.classList.add('active');
        tourTooltip.classList.add('active');
        updateTourHighlight();
    }

    function endTour() {
        tourOverlay.classList.remove('active');
        tourHighlight.classList.remove('active');
        tourTooltip.classList.remove('active');
        if (game && game.playerName) {
            localStorage.setItem('tourShown_' + game.playerName, 'true');
            updateHelpButtonAnimation();
        }
    }

    tourNext.addEventListener('click', () => {
        currentTourStep++;
        if (currentTourStep < tourSteps.length) {
            updateTourHighlight();
        } else {
            endTour();
        }
    });

    tourSkip.addEventListener('click', endTour);

    window.addEventListener('resize', () => {
        if (tourOverlay.classList.contains('active')) {
            updateTourHighlight();
        }
    });

    function updateHelpButtonAnimation() {
        if (!game || !game.playerName) return;
        const tourKey = 'tourShown_' + game.playerName;
        if (!localStorage.getItem(tourKey)) {
            helpBtn.classList.add('help-icon-attention');
        } else {
            helpBtn.classList.remove('help-icon-attention');
        }
    }

    helpBtn.addEventListener('click', startTour);

    function loadGame(name) {
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
            } catch (e) { game = null; }
        }
        
        if (!game) {
            isNewPlayer = true; 
            game = {
                day: 1, cash: 0, rating: 0,
                equipment: [], storage: { toy: 0, furniture: 0, food: 0 }, activeLoans: [],
                myOrders: [], availableOrders: [], completedOrders: 0, failedOrders: 0,
                playerName: name, market: { toy: 1.0, furniture: 1.0, food: 1.0 },
                monthlyIncome: 0, taxHistory: [], upgrades: []
            };
            for (let i = 0; i < 3; i++) game.availableOrders.push(generateRandomOrder());
        }
        if (!game.market) game.market = { toy: 1.0, furniture: 1.0, food: 1.0 };
        if (game.monthlyIncome === undefined) { game.monthlyIncome = 0; game.taxHistory = []; }
        if (!game.upgrades) game.upgrades = [];

        document.getElementById('playerNameDisplay').innerText = game.playerName;
        document.getElementById('loginModal').classList.remove('active');
        render();
        updateHelpButtonAnimation();

        if (isNewPlayer) {
            setTimeout(() => {
                startTour();
            }, 500);
        }
    }

    window.restartGame = function() {
        if (!game || !game.playerName) return;
        
        const isConfirmed = confirm(`🚨 ВНИМАНИЕ!\n\nВы уверены, что хотите начать игру с самого начала? \nВсе ваши деньги, станки и рейтинг будут навсегда удалены!`);
        
        if (isConfirmed) {
            const currentName = game.playerName;
            localStorage.removeItem(getSaveKey(currentName)); 
            localStorage.removeItem('tourShown_' + currentName); 
            game = null; 
            loadGame(currentName); 
            showNotification('🔄 Игра начата с чистого листа. Удачи, предприниматель!');
        }
    };

    loadProfileList();

    document.getElementById('loginBtn').addEventListener('click', () => {
        const selected = document.getElementById('profileSelect').value;
        if (selected) {
            loadGame(selected);
        } else {
            alert('Сначала выберите профиль из списка!');
        }
    });

    document.getElementById('newGameBtn').addEventListener('click', () => {
        const newName = document.getElementById('newPlayerName').value.trim();
        if (newName) {
            if (localStorage.getItem(getSaveKey(newName))) {
                alert('⚠️ Игрок с таким именем уже существует! Выберите его в верхнем списке или придумайте другое имя.');
            } else {
                loadGame(newName);
            }
        } else {
            alert('Пожалуйста, введите ваше имя!');
        }
    });

    document.getElementById('closeNotificationBtn').addEventListener('click', closeNotification);
    document.getElementById('closeShopModal').addEventListener('click', () => closeModal('shopModal'));
    document.getElementById('closeLoanModal').addEventListener('click', () => closeModal('loanModal'));
    
    if (document.getElementById('closeMachineModal')) {
        document.getElementById('closeMachineModal').addEventListener('click', () => closeModal('machineModal'));
        document.getElementById('machineModalRepairBtn').addEventListener('click', window.repairMachineFromModal);
        document.getElementById('machineModalSellBtn').addEventListener('click', window.sellMachine);
    }
    
    if (document.getElementById('showTaxBtn')) {
        document.getElementById('showTaxBtn').addEventListener('click', openTaxModal);
        document.getElementById('closeTaxModal').addEventListener('click', () => closeModal('taxModal'));
    }

    if (document.getElementById('openUpgradesBtn')) {
        document.getElementById('openUpgradesBtn').addEventListener('click', window.openUpgradesModal);
        document.getElementById('closeUpgradesModal').addEventListener('click', () => closeModal('upgradesModal'));
    }

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

    if (document.getElementById('restartBtn')) {
        document.getElementById('restartBtn').addEventListener('click', window.restartGame);
    }

    document.getElementById('takeLoanBtn').addEventListener('click', () => window.openModal('loanModal'));
    document.getElementById('newDayBtn').addEventListener('click', nextDay);

})();
// --- БАЗОВЫЕ НАСТРОЙКИ ---
const BASE_PRICES = { toy: 25, furniture: 70, food: 15 };
const BASE_COSTS = { toy: 10, furniture: 30, food: 4 };
const DAILY_COST = 30;

// --- ЭВОЛЮЦИЯ ЗДАНИЙ И ЯРКИЕ ЦВЕТОВЫЕ ТЕМЫ ---
const STAGES = [
    { 
        level: 0, id: 'street', name: 'Улица', 
        maxMachines: 0, rent: 0, price: 0, img: '', 
        // Асфальт и серость. Чувство "начинаю с нуля на обочине"
        theme: { bodyBg: '#7f8c8d', wrapBg: '#f5f7f8', panelBg: '#e8ecef', border: '#bdc3c7', text: '#2c3e50', shadow: 'rgba(0,0,0,0.2)' }
    },
    { 
        level: 1, id: 'garage', name: 'Гараж', 
        maxMachines: 1, rent: 0, price: 200, 
        img: 'https://raw.githubusercontent.com/godspace/business/main/BUTTONS/building_01_button.png', 
        // Теплые древесные, картонные оттенки. Уютный стартап.
        theme: { bodyBg: '#e3b795', wrapBg: '#fdf8f4', panelBg: '#f9ecd8', border: '#d4a373', text: '#5e3a21', shadow: 'rgba(139, 69, 19, 0.15)' }
    },
    { 
        level: 2, id: 'workshop', name: 'Арендованный Цех', 
        maxMachines: 3, rent: 50, price: 5000, 
        img: 'https://raw.githubusercontent.com/godspace/business/main/BUTTONS/building_02_button.png', 
        // Индустриальный мятно-бетонный. Просторное рабочее помещение.
        theme: { bodyBg: '#8cbab0', wrapBg: '#f2fafa', panelBg: '#e0f2ec', border: '#5c968a', text: '#194d40', shadow: 'rgba(25, 77, 64, 0.15)' }
    },
    { 
        level: 3, id: 'factory', name: 'Собственный Завод', 
        maxMachines: 10, rent: 200, price: 25000, 
        img: 'https://raw.githubusercontent.com/godspace/business/main/BUTTONS/building_03_button.png', 
        // Премиальный темно-синий фон "корпорации" с контрастными светлыми панелями. Элита.
        theme: { bodyBg: '#192a56', wrapBg: '#f0f5fa', panelBg: '#e1eaf2', border: '#273c75', text: '#192a56', shadow: 'rgba(0, 168, 255, 0.3)' }
    }
];

const UPGRADES = [
    { id: 'marketing', name: '📢 Бренд-менеджмент', desc: 'Все новые заказы стоят на 15% дороже', price: 2000 },
    { id: 'maintenance', name: '🛠️ Качественное масло', desc: 'Станки изнашиваются на 25% медленнее', price: 1500 },
    { id: 'logistics', name: '🚚 Своя фура', desc: 'Снижает плату за день и стоимость сырья на 10%', price: 2500 }
];

const PRODUCT_TYPES = {
    toy: { name: '🧸 Игрушки', cost: BASE_COSTS.toy, img: 'https://raw.githubusercontent.com/godspace/business/main/BUTTONS/toy_button.png', icon: '🧸' },
    furniture: { name: '🪑 Мебель', cost: BASE_COSTS.furniture, img: 'https://raw.githubusercontent.com/godspace/business/main/BUTTONS/wood_button.png', icon: '🪑' },
    food: { name: '🍫 Еда', cost: BASE_COSTS.food, img: 'https://raw.githubusercontent.com/godspace/business/main/BUTTONS/food_button.png', icon: '🍫' }
};

const MACHINES = [
    // Игрушки: быстрый старт, окупаемость 4 дня (Прибыль 150/день)
    { id: 'machine_toy', name: 'Станок Игрушек', productType: 'toy', price: 600, outputPerDay: 10, costPerItem: BASE_COSTS.toy },
    // Еда: золотая середина, окупаемость 4.5 дня (Прибыль 198/день)
    { id: 'machine_food', name: 'Пищевой Станок', productType: 'food', price: 900, outputPerDay: 18, costPerItem: BASE_COSTS.food },
    // Мебель: дорогая инвестиция для поздней игры, окупаемость 5.8 дней (Прибыль 240/день)
    { id: 'machine_furniture', name: 'Станок Мебели', productType: 'furniture', price: 1400, outputPerDay: 6, costPerItem: BASE_COSTS.furniture }
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

// --- СЛУЧАЙНЫЕ СОБЫТИЯ ---
const EVENTS = [
    { name: "🎉 Государственный грант", probability: 0.08, execute: (game) => { const bonus = Math.floor(game.cash * 0.20); const finalBonus = Math.min(bonus, 400); if (finalBonus <= 0) return null; game.cash += finalBonus; return `Программа поддержки малого бизнеса дарит вам +20% к капиталу!\nВы получили ${finalBonus} монет.`; } },
    { name: "⚡ Авария на электростанции", probability: 0.08, execute: (game) => { const fine = Math.floor(game.cash * 0.05) + 30; game.cash -= fine; return `Из-за скачка напряжения сгорели предохранители. Замена обошлась вам в ${fine} монет.`; } },
    { name: "🧯 Пожарная инспекция", probability: 0.10, execute: (game) => { const machinesCount = game.equipment.filter(m => m.health > 0).length; if (machinesCount === 0) return null; const fine = machinesCount * 25; game.cash -= fine; return `Инспектор выписал штраф за нарушение техники безопасности: по 25 монет за каждый работающий станок.\nУдержано ${fine} монет.`; } },
    { name: "🤝 Программа рефинансирования", probability: 0.12, execute: (game) => { if (game.cash >= 0) return null; const help = Math.floor(Math.abs(game.cash) * 0.50); game.cash += help; return `Антикризисный фонд помогает должникам! Вам безвозмездно погасили 50% вашего овердрафта.\nСписано ${help} монет долга.`; } },
    { name: "🐀 Крысы на складе", probability: 0.08, execute: (game) => { if (game.storage.food > 0) { const lostFood = Math.ceil(game.storage.food * 0.20); game.storage.food -= lostFood; const lostValue = lostFood * BASE_COSTS.food; return `Грызуны пробрались на склад и испортили 20% ваших запасов еды!\nСписано ${lostFood} шт. (убыток по себестоимости: ${lostValue} 💰).`; } return null; } },
    { name: "🏆 Премия 'Лучший работодатель'", probability: 0.05, execute: (game) => { const machinesCount = game.equipment.filter(m => m.health > 0).length; if (machinesCount < 3) return null; const bonus = 150; game.cash += bonus; return `Мэрия наградила вашу фабрику за создание рабочих мест!\nПризовой фонд: +${bonus} монет.`; } },
    { name: "📈 Вирусный тренд", probability: 0.08, execute: (game) => { game.market.toy = Math.min(2.5, game.market.toy + 0.8); return `Известный блогер сделал обзор на ваши игрушки! Спрос взлетел до небес.\nИндекс рынка игрушек резко вырос. Успейте продать их по максимальной цене, пока тренд не прошел!`; } },
    { name: "📉 Кризис недвижимости", probability: 0.08, execute: (game) => { game.market.furniture = Math.max(0.4, game.market.furniture - 0.5); return `Люди перестали покупать новые квартиры, и спрос на мебель рухнул.\nЦены на рынке мебели сильно упали. Лучше пока придержать готовые стулья на складе!`; } },
    { name: "🥦 Мода на ЗОЖ", probability: 0.07, execute: (game) => { game.market.food = Math.max(0.4, game.market.food - 0.4); return `В соцсетях завирусился тренд на здоровое питание. Спрос на шоколад и сладости резко упал!\nИндекс рынка еды снизился. Производство еды временно менее выгодно.`; } },
    { name: "🎈 Городской фестиваль", probability: 0.08, execute: (game) => { game.market.toy = Math.min(2.5, game.market.toy + 0.4); game.market.food = Math.min(2.5, game.market.food + 0.3); return `Мэрия объявила неделю детских праздников! Толпы туристов скупают сувениры.\nСпрос на игрушки и сладости сильно вырос. Отличный шанс продать запасы со склада по высокой цене!`; } },
    { name: "🏗️ Бум новостроек", probability: 0.07, execute: (game) => { game.market.furniture = Math.min(2.5, game.market.furniture + 0.6); return `В городе сдали новый огромный жилой микрорайон. Всем новоселам срочно нужна мебель!\nИндекс рынка мебели взлетел. Самое время брать крупные заказы на стулья.`; } }
];
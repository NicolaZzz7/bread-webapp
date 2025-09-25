/ Глобальные переменные
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let selectedWeights = {};

// Инициализация Telegram Web App
Telegram.WebApp.ready();
Telegram.WebApp.expand();

// Загрузка каталога
async function loadCatalog() {
  console.log('Начало загрузки каталога'); // Лог 1
  try {
    const response = await fetch('/api/catalog');
    console.log('Response status:', response.status); // Лог 2
    if (!response.ok) {
      throw new Error('Ошибка загрузки данных: ' + response.status);
    }
    const data = await response.json();
    console.log('Данные получены:', data); // Лог 3
    products = data;
    renderProducts(products);
    updateCartIndicator();
  } catch (error) {
    console.error('Ошибка загрузки данных:', error); // Лог 4
    document.getElementById('productGrid').innerHTML = `
      <div class="empty-state">
        <div class="icon">😕</div>
        <div>Не удалось загрузить каталог</div>
        <div style="margin-top: 8px; font-size: 14px;">${error.message}</div>
      </div>
    `;
  }
}

// Отображение продуктов
function renderProducts(productsToRender) {
    const grid = document.getElementById('productGrid');

    if (!productsToRender || Object.keys(productsToRender).length === 0) {
        grid.innerHTML = getEmptyStateHTML('🔍', 'Ничего не найдено', 'Попробуйте изменить поисковый запрос');
        return;
    }

    grid.innerHTML = Object.entries(productsToRender).map(([productId, product]) =>
        createProductCard(productId, product)
    ).join('');
}

// Создание карточки товара
function createProductCard(productId, product) {
    const availableWeights = getAvailableWeights(product);
    const defaultWeight = availableWeights.length > 0 ? availableWeights[0].weight : null;
    selectedWeights[productId] = selectedWeights[productId] || defaultWeight;

    return `
        <div class="product-card" data-product-id="${productId}">
            <div class="product-header">
                <div class="product-emoji">${getBreadEmoji(product.name)}</div>
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-ingredients">${product.ingredients || 'Состав не указан'}</div>
                    <div class="product-meta">
                        <div class="meta-item">⏰ ${product.prep_time || '1-2 дня'}</div>
                        ${product.addons ? `<div class="meta-item">✨ ${product.addons}</div>` : ''}
                    </div>
                </div>
            </div>
            
            ${availableWeights.length > 0 ? `
                <div class="price-section">
                    <div class="price-options">
                        ${availableWeights.map(({weight, price}) => `
                            <div class="price-option ${selectedWeights[productId] === weight ? 'selected' : ''}" 
                                 onclick="selectWeight('${productId}', '${weight}')">
                                <div class="weight">${weight}г</div>
                                <div class="price">${price}₽</div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <button class="add-button" onclick="addToCart('${productId}')">
                        🛒 Добавить в корзину • ${getProductPrice(productId)}₽
                    </button>
                </div>
            ` : `
                <div style="text-align: center; color: #718096; padding: 10px;">
                    Нет в наличии
                </div>
            `}
        </div>
    `;
}

// Получить доступные веса
function getAvailableWeights(product) {
    return Object.entries(product.prices || {})
        .filter(([weight, price]) => price > 0)
        .map(([weight, price]) => ({ weight, price }));
}

// Получить эмодзи для хлеба
function getBreadEmoji(name) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('ржаной')) return '🍞';
    if (nameLower.includes('пшеничный')) return '🥖';
    if (nameLower.includes('бородинский')) return '🥨';
    if (nameLower.includes('зерновой') || nameLower.includes('цельнозерновой')) return '🌾';
    if (nameLower.includes('сыр')) return '🧀';
    if (nameLower.includes('клюкв')) return '🫐';
    if (nameLower.includes('шоколад')) return '🍫';
    if (nameLower.includes('деревенск')) return '🏡';
    return '🍞';
}

// Выбор веса
function selectWeight(productId, weight) {
    selectedWeights[productId] = weight;
    updateProductCard(productId);
}

// Обновление карточки товара
function updateProductCard(productId) {
    const productElement = document.querySelector(`[data-product-id="${productId}"]`);
    if (!productElement) return;

    // Обновляем выбранный вес
    const priceOptions = productElement.querySelectorAll('.price-option');
    priceOptions.forEach(option => {
        const optionWeight = option.querySelector('.weight').textContent.replace('г', '');
        option.classList.toggle('selected', optionWeight === selectedWeights[productId]);
    });

    // Обновляем кнопку
    const button = productElement.querySelector('.add-button');
    if (button) {
        button.innerHTML = `🛒 Добавить в корзину • ${getProductPrice(productId)}₽`;
    }
}

// Получить цену продукта
function getProductPrice(productId) {
    const product = products[productId];
    const weight = selectedWeights[productId];
    return product.prices[weight] || 0;
}

// Добавить в корзину
function addToCart(productId) {
    const product = products[productId];
    const weight = selectedWeights[productId];
    const price = getProductPrice(productId);

    if (!weight || !price) {
        showNotification('Выберите вес продукта', 'error');
        return;
    }

    const cartItem = {
        id: productId,
        name: product.name,
        weight: weight,
        price: price,
        emoji: getBreadEmoji(product.name),
        timestamp: Date.now()
    };

    cart.push(cartItem);
    saveCart();
    updateCartIndicator();

    Telegram.WebApp.HapticFeedback.impactOccurred('light');
    showNotification(`${product.name} (${weight}г) добавлен в корзину!`, 'success');
}

// Сохранить корзину
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Обновить индикатор корзины
function updateCartIndicator() {
    const indicator = document.getElementById('cartIndicator');
    const countElement = document.getElementById('cartCount');

    if (indicator && countElement) {
        countElement.textContent = cart.length;
        indicator.style.display = cart.length > 0 ? 'flex' : 'none';
    }
}

// Поиск товаров
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();

    if (!searchTerm) {
        renderProducts(products);
        return;
    }

    const filteredProducts = Object.entries(products).reduce((acc, [id, product]) => {
        if (product.name.toLowerCase().includes(searchTerm) ||
            (product.ingredients && product.ingredients.toLowerCase().includes(searchTerm))) {
            acc[id] = product;
        }
        return acc;
    }, {});

    renderProducts(filteredProducts);
}

// Открыть корзину
function openCart() {
    if (cart.length === 0) {
        showNotification('Корзина пуста', 'info');
        return;
    }

    const cartSummary = cart.map(item =>
        `${item.emoji} ${item.name} (${item.weight}г) - ${item.price}₽`
    ).join('\n');

    const total = cart.reduce((sum, item) => sum + item.price, 0);

    Telegram.WebApp.showConfirm(
        `Ваша корзина:\n\n${cartSummary}\n\n💎 Итого: ${total}₽`,
        'Оформить заказ?',
        (confirmed) => {
            if (confirmed) {
                Telegram.WebApp.sendData(JSON.stringify({
                    action: 'checkout',
                    cart: cart,
                    total: total
                }));
            }
        }
    );
}

// Показать уведомление
function showNotification(message, type = 'info') {
    Telegram.WebApp.showPopup({
        title: type === 'success' ? '✅ Успешно' : '⚠️ Внимание',
        message: message,
        buttons: [{ type: 'ok' }]
    });
}

// Показать состояние ошибки
function showErrorState(message) {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = getEmptyStateHTML('😕', 'Не удалось загрузить каталог', message);
}

// HTML для пустого состояния
function getEmptyStateHTML(icon, title, subtitle) {
    return `
        <div class="empty-state">
            <div class="icon">${icon}</div>
            <div>${title}</div>
            ${subtitle ? `<div style="margin-top: 8px; font-size: 14px;">${subtitle}</div>` : ''}
        </div>
    `;
}

// HTML для загрузки
function getLoadingHTML() {
    return `
        <div class="loading">
            <div class="spinner">⏳</div>
            <div>Загружаем каталог...</div>
        </div>
    `;
}

loadCatalog();
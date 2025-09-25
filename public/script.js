// Глобальные переменные
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let selectedWeights = {};
let currentProduct = null;
let quantities = {};

// Инициализация Telegram Web App
Telegram.WebApp.ready();
Telegram.WebApp.expand();

// Загрузка каталога
async function loadCatalog() {
    console.log('Начало загрузки каталога');
    try {
        const response = await fetch('/api/catalog');
        console.log('Response status:', response.status);
        if (!response.ok) {
            throw new Error('Ошибка загрузки данных: ' + response.status);
        }
        const data = await response.json();
        console.log('Данные получены:', data);
        products = data;
        renderProducts(products);
        updateCartIndicator();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showErrorState(error.message);
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
    const minPrice = availableWeights.length > 0 ? Math.min(...availableWeights.map(w => w.price)) : 0;

    return `
        <div class="product-card" onclick="openProductModal('${productId}')">
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
                <div style="text-align: center;">
                    <div class="price-badge">от ${minPrice}₽</div>
                </div>
            ` : ''}
        </div>
    `;
}

// Открытие модального окна товара
function openProductModal(productId) {
    currentProduct = productId;
    const product = products[productId];
    const availableWeights = getAvailableWeights(product);

    // Устанавливаем первый доступный вес по умолчанию
    if (availableWeights.length > 0 && !selectedWeights[productId]) {
        selectedWeights[productId] = availableWeights[0].weight;
    }

    // Инициализируем количество
    if (!quantities[productId]) {
        quantities[productId] = {};
    }
    if (!quantities[productId][selectedWeights[productId]]) {
        quantities[productId][selectedWeights[productId]] = 1;
    }

    const modalHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-title">${product.name}</div>
                <button class="close-modal" onclick="closeProductModal()">×</button>
            </div>
            
            <div class="modal-emoji">${getBreadEmoji(product.name)}</div>
            
            <div class="modal-details">
                <div class="detail-item">
                    <span class="detail-label">Состав:</span> ${product.ingredients || 'Не указан'}
                </div>
                ${product.addons ? `
                    <div class="detail-item">
                        <span class="detail-label">Добавки:</span> ${product.addons}
                    </div>
                ` : ''}
                <div class="detail-item">
                    <span class="detail-label">Срок изготовления:</span> ${product.prep_time || '1-2 дня'}
                </div>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">Выберите вес:</span>
            </div>
            
            ${availableWeights.map(({weight, price}) => `
                <div class="weight-option ${selectedWeights[productId] === weight ? 'selected' : ''}" 
                     onclick="selectWeight('${weight}')">
                    <div class="weight-info">
                        <span>${weight}г</span>
                    </div>
                    <div class="weight-price">${price}₽</div>
                </div>
            `).join('')}
            
            ${availableWeights.length > 0 ? `
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="changeQuantity(-1)">-</button>
                    <span class="quantity-value" id="quantityValue">${quantities[productId][selectedWeights[productId]]}</span>
                    <button class="quantity-btn" onclick="changeQuantity(1)">+</button>
                </div>
                
                <div class="modal-total" id="modalTotal">
                    Итого: ${calculateTotal(productId)}₽
                </div>
                
                <button class="add-to-cart-btn" onclick="addToCart()">
                    🛒 Добавить в корзину
                </button>
            ` : ''}
        </div>
    `;

    document.getElementById('productModal').innerHTML = modalHTML;
    document.getElementById('productModal').style.display = 'block';
}

// Закрытие модального окна
function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
    currentProduct = null;
}

// Выбор веса
function selectWeight(weight) {
    if (!currentProduct) return;

    selectedWeights[currentProduct] = weight;

    // Инициализируем количество для выбранного веса
    if (!quantities[currentProduct][weight]) {
        quantities[currentProduct][weight] = 1;
    }

    // Обновляем отображение
    document.querySelectorAll('.weight-option').forEach(option => {
        const optionWeight = option.querySelector('.weight-info span').textContent.replace('г', '');
        option.classList.toggle('selected', optionWeight === weight);
    });

    updateModalTotal();
}

// Изменение количества
function changeQuantity(delta) {
    if (!currentProduct) return;

    const currentWeight = selectedWeights[currentProduct];
    const currentQty = quantities[currentProduct][currentWeight] || 1;
    const newQty = Math.max(1, currentQty + delta);

    quantities[currentProduct][currentWeight] = newQty;

    document.getElementById('quantityValue').textContent = newQty;
    updateModalTotal();
}

// Обновление общей суммы в модальном окне
function updateModalTotal() {
    if (!currentProduct) return;

    const total = calculateTotal(currentProduct);
    document.getElementById('modalTotal').textContent = `Итого: ${total}₽`;
}

// Расчет общей суммы
function calculateTotal(productId) {
    const product = products[productId];
    const weight = selectedWeights[productId];
    const quantity = quantities[productId][weight] || 1;
    const price = product.prices[weight] || 0;

    return price * quantity;
}

// Добавление в корзину
function addToCart() {
    if (!currentProduct) return;

    const product = products[currentProduct];
    const weight = selectedWeights[currentProduct];
    const quantity = quantities[currentProduct][weight] || 1;
    const price = product.prices[weight] || 0;
    const totalPrice = price * quantity;

    if (!weight || !price) {
        showNotification('Выберите вес продукта', 'error');
        return;
    }

    const cartItem = {
        id: currentProduct,
        name: product.name,
        weight: weight,
        price: price,
        quantity: quantity,
        total: totalPrice,
        emoji: getBreadEmoji(product.name),
        timestamp: Date.now()
    };

    // Проверяем, есть ли уже такой товар в корзине
    const existingIndex = cart.findIndex(item =>
        item.id === currentProduct && item.weight === weight
    );

    if (existingIndex > -1) {
        // Обновляем количество существующего товара
        cart[existingIndex].quantity += quantity;
        cart[existingIndex].total = cart[existingIndex].price * cart[existingIndex].quantity;
    } else {
        // Добавляем новый товар
        cart.push(cartItem);
    }

    saveCart();
    updateCartIndicator();
    closeProductModal();

    Telegram.WebApp.HapticFeedback.impactOccurred('light');
    showNotification(`${product.name} (${weight}г) x${quantity} добавлено в корзину!`, 'success');
}

// Вспомогательные функции
function getAvailableWeights(product) {
    return Object.entries(product.prices || {})
        .filter(([weight, price]) => price > 0)
        .map(([weight, price]) => ({ weight, price }));
}

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

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartIndicator() {
    const indicator = document.getElementById('cartIndicator');
    const countElement = document.getElementById('cartCount');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (indicator && countElement) {
        countElement.textContent = totalItems;
        indicator.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

function showErrorState(message) {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = getEmptyStateHTML('😕', 'Не удалось загрузить каталог', message);
}

function getEmptyStateHTML(icon, title, subtitle) {
    return `
        <div class="empty-state">
            <div class="icon">${icon}</div>
            <div>${title}</div>
            ${subtitle ? `<div style="margin-top: 8px; font-size: 14px;">${subtitle}</div>` : ''}
        </div>
    `;
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

// Открытие корзины
function openCart() {
    if (cart.length === 0) {
        showNotification('Корзина пуста', 'info');
        return;
    }

    const cartSummary = cart.map(item =>
        `${item.emoji} ${item.name} (${item.weight}г) x${item.quantity} - ${item.total}₽`
    ).join('\n');

    const total = cart.reduce((sum, item) => sum + item.total, 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    Telegram.WebApp.showConfirm(
        `🛒 Ваша корзина (${totalItems} товаров):\n\n${cartSummary}\n\n💎 Итого: ${total}₽`,
        'Оформить заказ?',
        (confirmed) => {
            if (confirmed) {
                Telegram.WebApp.sendData(JSON.stringify({
                    action: 'checkout',
                    cart: cart,
                    total: total,
                    totalItems: totalItems
                }));
            }
        }
    );
}

function showNotification(message, type = 'info') {
    Telegram.WebApp.showPopup({
        title: type === 'success' ? '✅ Успешно' : '⚠️ Внимание',
        message: message,
        buttons: [{ type: 'ok' }]
    });
}

// Закрытие модального окна при клике вне его
document.addEventListener('click', function(e) {
    const modal = document.getElementById('productModal');
    if (e.target === modal) {
        closeProductModal();
    }
});

// Привязка события поиска
document.getElementById('searchInput').addEventListener('input', handleSearch);

// Загружаем каталог при старте
loadCatalog();
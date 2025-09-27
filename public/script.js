// ===== GLOBAL STATE =====
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentProduct = null;
let quantities = {};

// ===== INITIALIZATION =====
function initApp() {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();

    // Очистка корзины от мусора
    cart = cart.filter(item => item && item.id && item.name && item.name !== 'undefined');
    saveCart();

    updateCartIndicator();

    // Загружаем каталог если на главной странице
    if (document.getElementById('productGrid')) {
        loadCatalog();
    }

    // Рендерим корзину если на странице корзины
    if (document.getElementById('cartGrid')) {
        renderCart();
        setupCheckoutButton();
    }
}

// ===== CART MANAGEMENT =====
function updateCartIndicator() {
    const indicator = document.getElementById('cartIndicator');
    const countElement = document.getElementById('cartCount');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const goToCartBtn = document.getElementById('goToCartBtn');

    const totalItems = cart.length;

    // Индикатор корзины
    if (indicator && countElement) {
        countElement.textContent = totalItems;
        if (totalItems > 0) {
            indicator.classList.add('visible');
        } else {
            indicator.classList.remove('visible');
        }
    }

    // Кнопка оформления заказа
    if (checkoutBtn) {
        if (totalItems > 0) {
            checkoutBtn.disabled = false;
            checkoutBtn.style.display = 'block';
        } else {
            checkoutBtn.disabled = true;
            checkoutBtn.style.display = 'none';
        }
    }

    // Кнопка перехода в корзину (в модалке)
    if (goToCartBtn) {
        if (totalItems > 0) {
            goToCartBtn.style.display = 'block';
        } else {
            goToCartBtn.style.display = 'none';
        }
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function getTotalPrice() {
    return cart.reduce((sum, item) => sum + (item.total || 0), 0);
}

function getTotalItems() {
    return cart.length;
}

// ===== CATALOG FUNCTIONS =====
async function loadCatalog() {
    try {
        showLoadingState();
        const response = await fetch('/api/catalog');

        if (!response.ok) {
            throw new Error(`Ошибка загрузки: ${response.status}`);
        }

        products = await response.json();
        renderProducts(products);

    } catch (error) {
        showErrorState('Не удалось загрузить каталог', error.message);
    }
}

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

function createProductCard(productId, product) {
    const quantityInCart = cart.filter(item => item.id === productId).length;
    const hasAddons = product.addons && parseInt(product.addons) > 0;

    return `
        <div class="product-card" onclick="openProductModal('${productId}')">
            <div class="product-header">
                <div class="product-emoji">${getBreadEmoji(product.name)}</div>
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-ingredients">${product.ingredients || 'Состав не указан'}</div>
                    <div class="product-meta">
                        <div class="meta-item">⏰ ${product.prep_time || '1-2 дня'}</div>
                        ${hasAddons ? `<div class="meta-item">✨ Добавки +${product.addons}₽</div>` : ''}
                    </div>
                </div>
            </div>
            
            ${quantityInCart > 0 ? `
                <div class="product-quantity-indicator">
                    ${quantityInCart}
                </div>
            ` : ''}
            
            <div class="price-badge">
                от ${Math.min(...Object.values(product.prices).filter(p => p > 0))}₽
            </div>
        </div>
    `;
}

// ===== MODAL FUNCTIONS =====
function openProductModal(productId) {
    currentProduct = productId;
    const product = products[productId];

    if (!quantities[productId]) {
        quantities[productId] = {};
    }

    // Загружаем актуальные количества из корзины
    const availableWeights = getAvailableWeights(product);
    availableWeights.forEach(({weight}) => {
        quantities[productId][weight] = cart.filter(item =>
            item.id === productId && item.weight === weight
        ).length;
    });

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
                <div class="detail-item">
                    <span class="detail-label">Срок изготовления:</span> ${product.prep_time || '1-2 дня'}
                </div>
            </div>
            
            <div class="weight-section">
                <div class="section-title">Выберите вес и количество:</div>
                ${availableWeights.map(({weight, price}) => {
                    const currentQty = quantities[productId][weight] || 0;
                    return `
                        <div class="weight-row">
                            <div class="weight-info">
                                <span class="weight-label">${weight}г</span>
                                <span class="weight-price">${price}₽</span>
                            </div>
                            <div class="quantity-controls">
                                <button class="quantity-btn" onclick="changeQuantity('${weight}', -1)">-</button>
                                <span class="quantity-value">${currentQty}</span>
                                <button class="quantity-btn" onclick="changeQuantity('${weight}', 1)">+</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            ${product.addons && parseInt(product.addons) > 0 ? `
                <div class="addons-section">
                    <label class="addons-checkbox">
                        <input type="checkbox" id="addonsCheckbox" onchange="toggleAddons(this.checked)">
                        <span class="checkmark"></span>
                        Добавки (семена льна, семечки, тыква) +${product.addons}₽
                    </label>
                </div>
            ` : ''}
            
            <div class="modal-summary">
                <div class="summary-item">
                    <span>Товаров в корзине:</span>
                    <span id="modalTotalItems">${getTotalItems()} шт</span>
                </div>
                <div class="summary-item total">
                    <span>Общая сумма:</span>
                    <span id="modalTotalPrice">${getTotalPrice()}₽</span>
                </div>
            </div>
            
            <button class="add-to-cart-btn" id="goToCartBtn" onclick="goToCart()" 
                    style="${getTotalItems() > 0 ? '' : 'display: none;'}">
                🛒 Перейти в корзину (${getTotalItems()} шт)
            </button>
        </div>
    `;

    document.getElementById('productModal').innerHTML = modalHTML;
    document.getElementById('productModal').style.display = 'block';
}

function changeQuantity(weight, delta) {
    if (!currentProduct) return;

    const product = products[currentProduct];
    const currentQty = quantities[currentProduct][weight] || 0;
    const newQty = Math.max(0, currentQty + delta);

    quantities[currentProduct][weight] = newQty;

    // Обновляем корзину
    updateCartForProduct(currentProduct, weight, delta);

    // Обновляем отображение
    document.querySelector(`.weight-row .weight-label:contains ('${weight}г')`)
        .closest('.weight-row')
        .querySelector('.quantity-value').textContent = newQty;

    // Обновляем сводку
    updateModalSummary();

    // Показываем уведомление
    if (delta > 0) {
        showNotification(`Добавлен ${product.name} (${weight}г)`, 'success');
    } else if (delta < 0 && currentQty > 0) {
        showNotification(`Удалён ${product.name} (${weight}г)`, 'success');
    }
}

function updateCartForProduct(productId, weight, delta) {
    const product = products[productId];
    const price = product.prices[weight] || 0;
    const addonsPrice = document.getElementById('addonsCheckbox')?.checked ?
        parseInt(product.addons) || 0 : 0;
    const finalPrice = price + addonsPrice;

    if (delta > 0) {
        // Добавляем товар
        cart.push({
            id: productId,
            name: product.name,
            weight: weight,
            quantity: 1,
            price: price,
            addonsPrice: addonsPrice,
            finalPrice: finalPrice,
            total: finalPrice,
            hasAddons: addonsPrice > 0,
            emoji: getBreadEmoji(product.name),
            timestamp: Date.now()
        });
    } else if (delta < 0) {
        // Удаляем один товар
        const index = cart.findIndex(item =>
            item.id === productId && item.weight === weight
        );
        if (index !== -1) {
            cart.splice(index, 1);
        }
    }

    saveCart();
    updateCartIndicator();
    renderProducts(products);
}

function toggleAddons(checked) {
    if (!currentProduct) return;

    // Обновляем все товары этого продукта в корзине
    cart.forEach(item => {
        if (item.id === currentProduct) {
            const product = products[currentProduct];
            item.hasAddons = checked;
            item.addonsPrice = checked ? parseInt(product.addons) || 0 : 0;
            item.finalPrice = item.price + item.addonsPrice;
            item.total = item.finalPrice;
        }
    });

    saveCart();
    updateCartIndicator();
    updateModalSummary();
    renderProducts(products);

    showNotification(`Добавки ${checked ? 'включены' : 'отключены'}`, 'success');
}

function updateModalSummary() {
    document.getElementById('modalTotalItems').textContent = `${getTotalItems()} шт`;
    document.getElementById('modalTotalPrice').textContent = `${getTotalPrice()}₽`;

    const goToCartBtn = document.getElementById('goToCartBtn');
    if (goToCartBtn) {
        if (getTotalItems() > 0) {
            goToCartBtn.style.display = 'block';
            goToCartBtn.innerHTML = `🛒 Перейти в корзину (${getTotalItems()} шт)`;
        } else {
            goToCartBtn.style.display = 'none';
        }
    }
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
    currentProduct = null;
}

function goToCart() {
    closeProductModal();
    window.location.href = '/cart.html';
}

// ===== CART PAGE FUNCTIONS =====
function renderCart() {
    const grid = document.getElementById('cartGrid');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (!grid) return;

    if (cart.length === 0) {
        grid.innerHTML = getEmptyStateHTML('🛒', 'Корзина пуста', 'Добавьте товары из каталога');
        if (checkoutBtn) checkoutBtn.style.display = 'none';
        return;
    }

    grid.innerHTML = cart.map((item, index) => {
        const product = products[item.id];
        const hasAddonsOption = product.addons && parseInt(product.addons) > 0;

        return `
            <div class="product-card">
                <div class="product-header">
                    <div class="product-emoji">${item.emoji}</div>
                    <div class="product-info">
                        <div class="product-name">${item.name}</div>
                        <div class="product-ingredients">${item.weight}г • ${item.finalPrice}₽</div>
                        <div class="product-meta">
                            <div class="meta-item">${item.total}₽</div>
                        </div>
                    </div>
                </div>
                
                ${hasAddonsOption ? `
                    <label class="addons-checkbox">
                        <input type="checkbox" ${item.hasAddons ? 'checked' : ''} 
                               onchange="updateCartItemAddons(${index}, this.checked)">
                        <span class="checkmark"></span>
                        Добавки +${product.addons}₽
                    </label>
                ` : ''}
                
                <button class="remove-btn" onclick="removeFromCart(${index})">
                    Удалить
                </button>
            </div>
        `;
    }).join('');

    if (checkoutBtn) {
        checkoutBtn.style.display = 'block';
        checkoutBtn.disabled = false;
    }
}

function updateCartItemAddons(index, hasAddons) {
    if (cart[index]) {
        const product = products[cart[index].id];
        cart[index].hasAddons = hasAddons;
        cart[index].addonsPrice = hasAddons ? parseInt(product.addons) || 0 : 0;
        cart[index].finalPrice = cart[index].price + cart[index].addonsPrice;
        cart[index].total = cart[index].finalPrice;

        saveCart();
        renderCart();
        updateCartIndicator();
        showNotification('Добавки обновлены', 'success');
    }
}

function removeFromCart(index) {
    if (cart[index]) {
        const removedItem = cart[index];
        cart.splice(index, 1);
        saveCart();
        renderCart();
        updateCartIndicator();
        showNotification(`Удалён ${removedItem.name}`, 'success');

        // Обновляем модалку если она открыта
        if (currentProduct === removedItem.id) {
            quantities[currentProduct][removedItem.weight] =
                (quantities[currentProduct][removedItem.weight] || 1) - 1;
            updateModalSummary();
        }

        // Обновляем каталог
        if (document.getElementById('productGrid')) {
            renderProducts(products);
        }
    }
}

function setupCheckoutButton() {
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                showNotification('Корзина пуста', 'error');
                return;
            }

            const cartSummary = cart.map(item =>
                `${item.emoji} ${item.name} (${item.weight}г) ${item.hasAddons ? 'с добавками' : ''} - ${item.total}₽`
            ).join('\n');

            Telegram.WebApp.showConfirm(
                `🛒 Ваш заказ:\n\n${cartSummary}\n\n💎 Итого: ${getTotalPrice()}₽`,
                'Подтвердить заказ?',
                (confirmed) => {
                    if (confirmed) {
                        Telegram.WebApp.sendData(JSON.stringify({
                            action: 'checkout',
                            cart: cart,
                            total: getTotalPrice(),
                            totalItems: getTotalItems()
                        }));
                    }
                }
            );
        });
    }
}

// ===== UTILITY FUNCTIONS =====
function getAvailableWeights(product) {
    return Object.entries(product.prices || {})
        .filter(([_, price]) => price > 0)
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
    if (nameLower.includes('гриссини') || nameLower.includes('палочки')) return '🥖';
    return '🍞';
}

function showLoadingState() {
    const grid = document.getElementById('productGrid');
    if (grid) {
        grid.innerHTML = `
            <div class="loading">
                <div class="spinner">🍞</div>
                <div>Загружаем каталог...</div>
            </div>
        `;
    }
}

function showErrorState(title, message) {
    const grid = document.getElementById('productGrid') || document.getElementById('cartGrid');
    if (grid) {
        grid.innerHTML = getEmptyStateHTML('😕', title, message);
    }
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

function showNotification(message, type = 'info') {
    // Создаем или находим уведомление
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.className = `notification ${type} visible`;

    setTimeout(() => {
        notification.classList.remove('visible');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== EVENT HANDLERS =====
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

function openCartPage() {
    if (cart.length === 0) {
        showNotification('Корзина пуста', 'info');
        return;
    }
    window.location.href = '/cart.html';
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', initApp);

document.addEventListener('click', function(e) {
    // Закрытие модалки при клике вне её
    const modal = document.getElementById('productModal');
    if (e.target === modal) {
        closeProductModal();
    }
});

// Поиск
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
}
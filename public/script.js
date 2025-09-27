// Глобальные переменные
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
cart = cart.filter(item => item && item.name && item.name !== 'undefined'); // Очистка корзины
let selectedWeights = {};
let currentProduct = null;
let quantities = {};
let addonsSelected = {};

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
    document.getElementById('productGrid').innerHTML = getEmptyStateHTML('😕', 'Не удалось загрузить каталог', error.message);
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
  return `
    <div class="product-card" data-product-id="${productId}" onclick="openProductModal('${productId}')">
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
    </div>
  `;
}

// Открытие модального окна товара
function openProductModal(productId) {
  currentProduct = productId;
  const product = products[productId];

  if (!quantities[productId]) quantities[productId] = {};
  if (!addonsSelected[productId]) addonsSelected[productId] = {};

  const availableWeights = getAvailableWeights(product);
  const hasAddons = product.addons && product.addons !== '';

  // Загрузка актуального количества из корзины
  availableWeights.forEach(({weight}) => {
    const matchingItems = cart.filter(item => item.id === productId && item.weight === weight && item.hasAddons === (addonsSelected[productId][weight] || false));
    quantities[productId][weight] = matchingItems.length;
    addonsSelected[productId][weight] = matchingItems.length > 0 ? matchingItems[0].hasAddons : false;
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
          const isSelected = addonsSelected[productId][weight] || false;
          return `
            <div class="weight-row">
              <div class="weight-info">
                <span class="weight-label">${weight}г</span>
                <span class="weight-price">${price}₽</span>
              </div>
              <div class="quantity-controls">
                <button class="quantity-btn" onclick="changeWeightQuantity('${productId}', '${weight}', -1)">-</button>
                <span class="quantity-value" id="qty-${productId}-${weight}">${currentQty}</span>
                <button class="quantity-btn" onclick="changeWeightQuantity('${productId}', '${weight}', 1)">+</button>
              </div>
              ${hasAddons ? `
                <label class="addons-checkbox" style="margin-left: 10px;">
                  <input type="checkbox" id="addon-${productId}-${weight}" ${isSelected ? 'checked' : ''} onchange="toggleAddons('${productId}', '${weight}', this.checked)">
                  <span class="checkmark"></span>
                  +${product.addons}₽
                </label>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
      <div class="modal-summary">
        <div class="summary-item">
          <span>Товаров:</span>
          <span id="totalItems">0 шт</span>
        </div>
        <div class="summary-item total">
          <span>Итого:</span>
          <span id="modalTotal">0₽</span>
        </div>
      </div>
      <button class="add-to-cart-btn" id="addToCartBtn" onclick="addToCart('${productId}')">
        🛒 Перейти в корзину
      </button>
    </div>
  `;

  document.getElementById('productModal').innerHTML = modalHTML;
  document.getElementById('productModal').style.display = 'block';
  updateModalSummary(productId);
}

// Изменение количества для конкретного веса
function changeWeightQuantity(productId, weight, delta) {
  const product = products[productId];
  const currentQty = quantities[productId][weight] || 0;
  const newQty = Math.max(0, currentQty + delta);
  quantities[productId][weight] = newQty;

  // Обновляем корзину
  updateCartItem(productId, weight, delta);

  // Обновляем отображение
  document.getElementById(`qty-${productId}-${weight}`).textContent = newQty;

  // Уведомление
  if (delta > 0) {
    showNotification(`Добавлен ${product.name} (${weight}г)`, 'success');
  } else if (delta < 0 && currentQty > 0) {
    showNotification(`Удалён ${product.name} (${weight}г)`, 'success');
  }

  updateModalSummary(productId);
}

// Переключение чекбокса добавок
function toggleAddons(productId, weight, checked) {
  if (!addonsSelected[productId]) addonsSelected[productId] = {};
  addonsSelected[productId][weight] = checked;

  // Удаляем все items для этого веса и пересоздаём
  const currentQty = quantities[productId][weight] || 0;
  cart = cart.filter(item => !(item.id === productId && item.weight === weight));
  updateCartItem(productId, weight, currentQty);
  updateModalSummary(productId);
}

// Обновление сводки в модальном окне
function updateModalSummary(productId) {
  const product = products[productId];
  const availableWeights = getAvailableWeights(product);

  let totalItems = 0;
  let totalPrice = 0;

  availableWeights.forEach(({weight, price}) => {
    const qty = quantities[productId][weight] || 0;
    if (qty > 0) {
      const addonsPrice = addonsSelected[productId]?.[weight] ? parseInt(product.addons || 0) : 0;
      totalItems += qty;
      totalPrice += (price + addonsPrice) * qty;
    }
  });

  document.getElementById('totalItems').textContent = `${totalItems} шт`;
  document.getElementById('modalTotal').textContent = `${totalPrice}₽`;
  document.getElementById('addToCartBtn').disabled = totalItems === 0;
}

// Обновление корзины (каждый хлеб — отдельный item)
function updateCartItem(productId, weight, delta) {
  const product = products[productId];
  const price = product.prices[weight] || 0;
  const hasAddons = addonsSelected[productId]?.[weight] || false;
  const addonsPrice = hasAddons ? parseInt(product.addons || 0) : 0;
  const itemPrice = price + addonsPrice;

  // Находим все items для этого id, weight и hasAddons
  const matchingItems = cart.filter(item => item.id === productId && item.weight === weight && item.hasAddons === hasAddons);

  if (delta > 0) {
    // Добавляем ровно один item
    cart.push({
      id: productId,
      name: product.name,
      weight: weight,
      quantity: 1,
      price: itemPrice,
      hasAddons: hasAddons,
      total: itemPrice,
      emoji: getBreadEmoji(product.name),
      timestamp: Date.now() // Убрали Math.random(), используем точное время
    });
  } else if (delta < 0 && matchingItems.length > 0) {
    // Удаляем один item
    const index = cart.findIndex(item => item.id === productId && item.weight === weight && item.hasAddons === hasAddons);
    if (index !== -1) cart.splice(index, 1);
  }

  saveCart();
  updateCartIndicator();
  if (document.getElementById('cartGrid')) renderCart();
}

// Перейти в корзину
function addToCart(productId) {
  showNotification('Переходим в корзину...', 'success');
  setTimeout(() => {
    closeProductModal();
    window.location.href = '/cart.html';
  }, 1000);
}

// Закрытие модального окна
function closeProductModal() {
  document.getElementById('productModal').style.display = 'none';
  currentProduct = null;
}

// Вспомогательные функции
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

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartIndicator() {
  const indicator = document.getElementById('cartIndicator');
  const countElement = document.getElementById('cartCount');
  const totalItems = getTotalItems();

  if (indicator && countElement) {
    countElement.textContent = totalItems;
    indicator.style.display = totalItems > 0 ? 'flex' : 'none';
  }
}

function getTotalItems() {
  return cart.length;
}

function getTotalPrice() {
  return cart.reduce((sum, item) => sum + item.total, 0);
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
  window.location.href = '/cart.html';
}

// Показ уведомления
function showNotification(message, type = 'info') {
  let notification = document.getElementById('notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'notification';
    document.body.appendChild(notification);
  }

  notification.classList.remove('success', 'error', 'info');
  notification.classList.add(type);

  notification.textContent = message;
  notification.style.opacity = '1';

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) notification.parentNode.removeChild(notification);
    }, 300);
  }, 3000);
}

// Закрытие модального окна при клике вне его
document.addEventListener('click', function(e) {
  const modal = document.getElementById('productModal');
  if (e.target === modal) {
    closeProductModal();
  }
});

// Привязка события поиска
document.getElementById('searchInput')?.addEventListener('input', handleSearch);

// Рендеринг корзины на cart.html
function renderCart() {
  const grid = document.getElementById('cartGrid');
  if (!grid) return;

  if (cart.length === 0) {
    grid.innerHTML = getEmptyStateHTML('🛒', 'Корзина пуста', 'Добавьте товары из каталога');
    document.getElementById('cartTotal').textContent = '0₽';
    return;
  }

  grid.innerHTML = cart.map(item => `
    <div class="product-card" data-cart-id="${item.timestamp}">
      <div class="product-header">
        <div class="product-emoji">${item.emoji}</div>
        <div class="product-info">
          <div class="product-name">${item.name}</div>
          <div class="product-ingredients">${item.weight}г</div>
          <div class="product-meta">
            <div class="meta-item">${item.total}₽</div>
          </div>
        </div>
      </div>
      ${products[item.id]?.addons ? `
        <label class="addons-checkbox" style="margin: 10px;">
          <input type="checkbox" id="addon-${item.timestamp}" ${item.hasAddons ? 'checked' : ''} onchange="toggleCartAddon('${item.timestamp}', this.checked)">
          <span class="checkmark"></span>
          Добавки (+${products[item.id].addons}₽)
        </label>
      ` : ''}
      <button class="remove-btn" onclick="removeCartItem(${item.timestamp})">Удалить</button>
    </div>
  `).join('');

  document.getElementById('cartTotal').textContent = `${getTotalPrice()}₽`;
}

// Удаление товара из корзины
function removeCartItem(timestamp) {
  const index = cart.findIndex(item => item.timestamp === Number(timestamp));
  if (index !== -1) {
    const removedItem = cart[index];
    cart.splice(index, 1);
    saveCart();
    renderCart();
    updateCartIndicator();
    showNotification(`Удалён ${removedItem.name} (${removedItem.weight}г)`, 'success');
    // Если в модалке, обновляем
    if (currentProduct && currentProduct === removedItem.id) {
      quantities[currentProduct][removedItem.weight] = (quantities[currentProduct][removedItem.weight] || 1) - 1;
      document.getElementById(`qty-${currentProduct}-${removedItem.weight}`).textContent = quantities[currentProduct][removedItem.weight];
      updateModalSummary(currentProduct);
    }
  }
}

// Переключение добавок в корзине
function toggleCartAddon(timestamp, checked) {
  const item = cart.find(item => item.timestamp === Number(timestamp));
  if (item && products[item.id]?.addons) {
    item.hasAddons = checked;
    const price = products[item.id].prices[item.weight] || 0;
    const addonsPrice = checked ? parseInt(products[item.id].addons || 0) : 0;
    item.total = price + addonsPrice;
    saveCart();
    renderCart();
    updateCartIndicator();
    showNotification(`${checked ? 'Добавлены' : 'Убраны'} добавки для ${item.name} (${item.weight}г)`, 'success');
    // Если в модалке, обновляем
    if (currentProduct && currentProduct === item.id) {
      addonsSelected[item.id][item.weight] = checked;
      updateModalSummary(item.id);
    }
  }
}

// Загрузка корзины при старте на cart.html
if (document.getElementById('cartGrid')) {
  renderCart();
}

// Загружаем каталог при старте на index.html
if (document.getElementById('productGrid')) loadCatalog();

// Очистка кэша
function clearCache() {
  localStorage.removeItem('catalog');
  loadCatalog();
}
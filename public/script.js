// Глобальные переменные
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
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

// Создание карточки товара с восстановленным onclick
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
        🛒 Добавить в корзину
      </button>
    </div>
  `;

  document.getElementById('productModal').innerHTML = modalHTML;
  document.getElementById('productModal').style.display = 'block';
  updateModalSummary(productId);
}

// Изменение количества для конкретного веса
function changeWeightQuantity(productId, weight, delta) {
  const currentQty = quantities[productId][weight] || 0;
  const newQty = Math.max(0, currentQty + delta);
  quantities[productId][weight] = newQty;

  // Обновляем корзину
  updateCartItem(productId, weight, newQty);

  document.getElementById(`qty-${productId}-${weight}`).textContent = newQty;
  updateModalSummary(productId);
}

// Переключение чекбокса добавок
function toggleAddons(productId, weight, checked) {
  if (!addonsSelected[productId]) addonsSelected[productId] = {};
  addonsSelected[productId][weight] = checked;
  updateCartItem(productId, weight, quantities[productId][weight] || 0);
  updateModalSummary(productId);
}

// Обновление или создание элемента корзины
function updateCartItem(productId, weight, quantity) {
  const product = products[productId];
  const price = product.prices[weight] || 0;
  const addonsPrice = addonsSelected[productId]?.[weight] ? parseInt(product.addons) || 0 : 0;
  const itemTotal = (price + addonsPrice) * quantity;

  const existingIndex = cart.findIndex(item => item.id === productId && item.weight === weight);
  if (quantity === 0 && existingIndex !== -1) {
    cart.splice(existingIndex, 1); // Удаляем, если количество стало 0
  } else if (quantity > 0) {
    const cartItem = {
      id: productId,
      name: product.name,
      weight: weight,
      quantity: quantity,
      price: itemTotal,
      hasAddons: addonsSelected[productId]?.[weight] || false,
      total: itemTotal,
      emoji: getBreadEmoji(product.name),
      timestamp: Date.now()
    };
    if (existingIndex !== -1) {
      cart[existingIndex] = cartItem; // Обновляем
    } else {
      cart.push(cartItem); // Добавляем новый
    }
  }
  saveCart();
  updateCartIndicator();
}

// Обновление сводки в модальном окне
function updateModalSummary(productId) {
  const product = products[productId];
  let totalItems = 0;
  let totalPrice = 0;
  const weights = getAvailableWeights(product);

  weights.forEach(({weight}) => {
    const qty = quantities[productId][weight] || 0;
    if (qty > 0) {
      const price = product.prices[weight] || 0;
      const addonsPrice = addonsSelected[productId]?.[weight] ? parseInt(product.addons) || 0 : 0;
      totalItems += qty;
      totalPrice += (price + addonsPrice) * qty;
    }
  });

  document.getElementById('totalItems').textContent = `${totalItems} шт`;
  document.getElementById('modalTotal').textContent = `${totalPrice}₽`;
  document.getElementById('addToCartBtn').disabled = totalItems === 0;
}

// Добавление в корзину
function addToCart(productId) {
  const product = products[productId];
  const weights = getAvailableWeights(product);
  let addedItems = 0;
  let addedPrice = 0;

  weights.forEach(({weight}) => {
    const qty = quantities[productId][weight] || 0;
    if (qty > 0) {
      updateCartItem(productId, weight, qty);
      const price = product.prices[weight] || 0;
      const addonsPrice = addonsSelected[productId]?.[weight] ? parseInt(product.addons) || 0 : 0;
      addedItems += qty;
      addedPrice += (price + addonsPrice) * qty;
    }
  });

  closeProductModal();
  showNotification(`${addedItems} x ${product.name} добавлено в корзину за ${addedPrice}₽!`, 'success');
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
  return cart.reduce((sum, item) => sum + item.quantity, 0);
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
    alert('Корзина пуста');
    return;
  }

  const cartSummary = cart.map(item =>
    `${item.emoji} ${item.name} (${item.weight}г) ${item.hasAddons ? 'с добавками ' : ''}x${item.quantity} - ${item.total}₽`
  ).join('\n');

  const total = getTotalPrice();
  const totalItems = getTotalItems();

  alert(`🛒 Ваша корзина (${totalItems} товаров):\n\n${cartSummary}\n\n💎 Итого: ${total}₽`);
}

// Показ уведомления
function showNotification(message, type = 'info') {
  alert(message); // Замена showPopup для совместимости
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

// Загружаем каталог при старте
if (document.getElementById('productGrid')) {
  loadCatalog();
}
// Глобальные переменные
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let selectedWeights = {};
let selectedQuantities = {}; // Для хранения выбранного количества

// Инициализация Telegram Web App
Telegram.WebApp.ready();
Telegram.WebApp.expand();

// Загрузка каталога
async function loadCatalog() {
  console.log('Начало загрузки каталога');
  try {
    const response = await fetch('/api/catalog');
    console.log('Response status:', response.status);
    if (!response.ok) throw new Error('Ошибка загрузки данных: ' + response.status);
    const rawData = await response.json();
    console.log('Данные получены:', rawData);

    // Преобразование данных
    products = Object.fromEntries(
      Object.entries(rawData).map(([id, product]) => [
        id,
        {
          ...product,
          prices: {
            100: product.price_100 || 0,
            500: product.price_500 || 0,
            750: product.price_750 || 0
          }
        }
      ])
    );
    renderProducts(products);
    updateCartIndicator();
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
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
  selectedQuantities[productId] = selectedQuantities[productId] || 1; // По умолчанию 1

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
          
          <div class="quantity-section">
            <label>Количество:</label>
            <button onclick="changeQuantity('${productId}', -1)">-</button>
            <span id="quantity-${productId}">${selectedQuantities[productId]}</span>
            <button onclick="changeQuantity('${productId}', 1)">+</button>
          </div>
          
          <button class="add-button" onclick="addToCart('${productId}')">
            🛒 Добавить в корзину • ${getTotalPrice(productId)}₽
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
    .map(([weight, price]) => ({ weight: parseInt(weight), price }));
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

  const priceOptions = productElement.querySelectorAll('.price-option');
  priceOptions.forEach(option => {
    const optionWeight = option.querySelector('.weight').textContent.replace('г', '');
    option.classList.toggle('selected', optionWeight === selectedWeights[productId]);
  });

  const button = productElement.querySelector('.add-button');
  if (button) button.innerHTML = `🛒 Добавить в корзину • ${getTotalPrice(productId)}₽`;
}

// Изменение количества
function changeQuantity(productId, delta) {
  let quantity = selectedQuantities[productId] || 1;
  quantity = Math.max(1, quantity + delta); // Не меньше 1
  selectedQuantities[productId] = quantity;
  updateProductCard(productId);
  document.getElementById(`quantity-${productId}`).textContent = quantity;
}

// Получить общую цену (цена за вес * количество)
function getTotalPrice(productId) {
  const product = products[productId];
  const weight = selectedWeights[productId];
  const quantity = selectedQuantities[productId] || 1;
  const pricePerUnit = product.prices[weight] || 0;
  return pricePerUnit * quantity;
}

// Добавить в корзину
function addToCart(productId) {
  const product = products[productId];
  const weight = selectedWeights[productId];
  const quantity = selectedQuantities[productId] || 1;
  const pricePerUnit = product.prices[weight] || 0;
  const totalPrice = pricePerUnit * quantity;

  if (!weight || !pricePerUnit) {
    showNotification('Выберите вес продукта', 'error');
    return;
  }

  const cartItem = {
    id: productId,
    name: product.name,
    weight: weight,
    quantity: quantity,
    price: totalPrice,
    emoji: getBreadEmoji(product.name),
    timestamp: Date.now()
  };

  cart.push(cartItem);
  saveCart();
  updateCartIndicator();

  Telegram.WebApp.HapticFeedback.impactOccurred('light');
  showNotification(`${product.name} (${weight}г, ${quantity} шт.) добавлен в корзину!`, 'success');
}



// Закрытие модального окна
function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
    currentProduct = null;
}

// Вспомогательные функции
function getAvailableWeights(product) {
    const weights = [];
    if (product.price_100 > 0) weights.push({ weight: '100', price: product.price_100 });
    if (product.price_500 > 0) weights.push({ weight: '500', price: product.price_500 });
    if (product.price_750 > 0) weights.push({ weight: '750', price: product.price_750 });
    return weights;
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
        `${item.emoji} ${item.name} (${item.weight}г) ${item.hasAddons ? 'с добавками ' : ''}x${item.quantity} - ${item.total}₽`
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


document.getElementById('searchInput').addEventListener('input', handleSearch);
loadCatalog();
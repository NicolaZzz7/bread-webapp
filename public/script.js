let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
cart = cart.filter(item => item && item.name && item.name !== 'undefined');
let selectedWeights = {};
let currentProduct = null;
let quantities = {};
let visibleWeightControls = {};
// хелпер: суммарное количество товара в корзине (по всем весам)
function getTotalQtyForProduct(productId) {
  if (!quantities[productId]) return 0;
  return Object.values(quantities[productId]).reduce((s, v) => s + (Number(v) || 0), 0);
}


Telegram.WebApp.ready();
Telegram.WebApp.expand();

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
    if (document.getElementById('productGrid')) renderProducts(products);
    if (document.getElementById('cartGrid')) renderCart();
    updateCartIndicator();
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    if (document.getElementById('productGrid')) {
      document.getElementById('productGrid').innerHTML = getEmptyStateHTML('😕', 'Не удалось загрузить каталог', error.message);
    }
  }
}

function renderProducts(productsToRender) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  if (!productsToRender || Object.keys(productsToRender).length === 0) {
    grid.innerHTML = getEmptyStateHTML('🔍', 'Ничего не найдено', 'Попробуйте изменить поисковый запрос');
    return;
  }

  grid.innerHTML = Object.entries(productsToRender).map(([productId, product]) =>
    createProductCard(productId, product)
  ).join('');

  activateTransitions();
}

function activateTransitions() {
  document.querySelectorAll('.transition-container > *').forEach(el => {
    if (!el.classList.contains('activated')) {
      el.classList.add('hidden'); // сначала скрываем
      requestAnimationFrame(() => {
        el.classList.remove('hidden'); // затем плавно показываем
        el.classList.add('activated'); // помечаем как обработанный
      });
    }
  });
}

function createProductCard(productId, product) {
  if (!quantities[productId]) quantities[productId] = {};

  const availableWeights = getAvailableWeights(product);

  // Считаем актуальные количества из корзины для каждого веса
  availableWeights.forEach(({ weight }) => {
    const matchingItems = cart.filter(item => item.id === productId && item.weight === weight);
    quantities[productId][weight] = matchingItems.length;
  });

  const totalQtyForProduct = getTotalQtyForProduct(productId);

  return `
    <div class="product-card" data-product-id="${productId}">
      ${totalQtyForProduct > 0 ? `
        <div class="product-quantity-indicator">
          <span class="product-quantity-count">${totalQtyForProduct}</span>
        </div>
      ` : ''}

      <div class="product-image" onclick="openProductModal('${productId}')">
        <img src="${(product.images && product.images[0]) || '/placeholder.jpg'}" alt="${product.name}">
      </div>

      <div class="product-info">
        <div class="product-name" onclick="openProductModal('${productId}')">
          ${product.name}
        </div>
        <div class="product-ingredients">${product.ingredients || 'Состав не указан'}</div>
        <div class="product-meta">
          <div class="meta-item">⏰ ${product.prep_time || '1-2 дня'}</div>
          ${product.addons ? `<div class="meta-item">✨ Возможны добавки</div>` : ''}
        </div>
      </div>

      <div class="transition-container">
        ${ (totalQtyForProduct === 0 && !visibleWeightControls[productId]) ? `
          <button class="add-to-cart-btn"
            onclick="(function(e){ e.stopPropagation(); showWeightControls('${productId}'); })(event)">
            ➕ Добавить в корзину
          </button>
        ` : `
          <div class="weight-row-container" onclick="event.stopPropagation()">
            ${availableWeights.map(({ weight, price }) => {
              const currentQty = quantities[productId][weight] || 0;
              return `
                <div class="weight-row">
                  <div class="weight-info">
                    <span class="weight-label">${weight}г</span>
                    <span class="weight-price">${price}₽</span>
                  </div>
                  <div class="quantity-controls">
                    <button class="quantity-btn" onclick="(function(e){ e.stopPropagation(); changeWeightQuantity('${productId}', '${weight}', -1); })(event)">−</button>
                    <span class="quantity-value" id="qty-${productId}-${weight}">${currentQty}</span>
                    <button class="quantity-btn" onclick="(function(e){ e.stopPropagation(); changeWeightQuantity('${productId}', '${weight}', 1); })(event)">+</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}


function showWeightControls(productId) {
  visibleWeightControls[productId] = true;
  renderProducts(products);

  // Ставим таймер на 5 секунд
  setTimeout(() => {
    const totalQty = getTotalQtyForProduct(productId);
    if (totalQty === 0) {
      // скрываем контролы и возвращаем кнопку "Добавить"
      visibleWeightControls[productId] = false;
      renderProducts(products);

      // найти кнопку и подсветить её
      const btn = document.querySelector(`.product-card[data-product-id="${productId}"] .add-to-cart-btn`);
      if (btn) {
        btn.classList.add("button-highlight");
        setTimeout(() => btn.classList.remove("button-highlight"), 1000);
      }
    }
  }, 5000);
}



function openProductModal(productId) {
  currentProduct = productId;
  const product = products[productId];

  if (!quantities[productId]) quantities[productId] = {};

  const availableWeights = getAvailableWeights(product);

  availableWeights.forEach(({weight}) => {
    const matchingItems = cart.filter(item => item.id === productId && item.weight === weight);
    quantities[productId][weight] = matchingItems.length;
  });

  // Преобразуем ингредиенты в список с капитализацией
  const ingredientsList = product.ingredients && product.ingredients !== 'Не указан'
    ? product.ingredients.split(',').map(item => {
        const trimmed = item.trim();
        return `<li>${trimmed.charAt(0).toUpperCase() + trimmed.slice(1)}</li>`;
      }).join('')
    : '<li>Не указан</li>';

  const modalHTML = `
    <div class="modal-content">
    <div class="modal-header">
      <div class="modal-title">${product.name}</div>
      <button class="close-modal" onclick="closeProductModal()">×</button>
    </div>
    <div class="modal-image-slider">
      ${(product.images || ['/placeholder.jpg']).map((src, i) => `
        <div class="slide ${i === 0 ? 'active' : ''}">
          <img src="${src}" alt="${product.name}">
        </div>
      `).join('')}
    </div>
    <div class="detail-item prep-time">
      <span class="detail-label">Срок изготовления:</span> ${product.prep_time || '1-2 дня'}
    </div>
    <div class="detail-item ingredients">
      <span class="detail-label">Состав:</span> ${product.ingredients || 'Не указан'}
    </div>
      <div class="weight-section">
        <div class="section-title">Выберите вес и количество:</div>
        <div class="weight-row-container">
          ${availableWeights.map(({weight, price}) => {
            const currentQty = quantities[productId][weight] || 0;
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
              </div>
            `;
          }).join('')}
        </div>
      </div>
      <div class="modal-summary">
          <div class="summary-item">
            <span>${product.name}:</span>
            <span id="totalItems">0 шт</span>
          </div>
          <div class="summary-totals">
            <div class="summary-item total">
              <span>Итого:</span>
              <span id="modalTotal">0₽</span>
            </div>
            <div class="summary-item total-cart">
              <span>Итого в корзине:</span>
              <span id="cartTotal">0₽</span>
            </div>
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

  const slides = document.querySelectorAll('.modal-image-slider .slide');
    let currentSlide = 0;
    if (slides.length > 1) {
      setInterval(() => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
      }, 6000);
    }
}

function changeWeightQuantity(productId, weight, delta) {
  const product = products[productId];
  if (!quantities[productId]) quantities[productId] = {};
  const currentQty = quantities[productId][weight] || 0;
  const newQty = Math.max(0, currentQty + delta);
  quantities[productId][weight] = newQty;

  // обновляем корзину (эта функция в твоём коде уже добавляет/удаляет элементы и сохраняет cart)
  updateCartItem(productId, weight, delta);

  // обновим видимое значение, если элемент ещё есть в DOM
  const qtyEl = document.getElementById(`qty-${productId}-${weight}`);
  if (qtyEl) qtyEl.textContent = newQty;

  if (delta > 0) {
    showNotification(`Добавлен ${product.name} (${weight}г)`, 'success');
  } else if (delta < 0 && currentQty > 0) {
    showNotification(`Удалён ${product.name} (${weight}г)`, 'success');
  }

  // если после изменения суммарно = 0, скрываем контролы (возвращаем кнопку "Добавить")
  const totalQty = getTotalQtyForProduct(productId);
  visibleWeightControls[productId] = totalQty > 0;

  // если модалка открыта для этого продукта — обновляем её
  if (currentProduct === productId) updateModalSummary(productId);

  // перерисуем каталог (показываем/скрываем кнопку по суммарному количеству)
  renderProducts(products);
}


function updateModalSummary(productId) {
  const product = products[productId];
  const availableWeights = getAvailableWeights(product);

  let totalItems = 0;
  let totalPrice = 0;

  availableWeights.forEach(({weight, price}) => {
    const qty = quantities[productId][weight] || 0;
    if (qty > 0) {
      totalItems += qty;
      totalPrice += price * qty;
    }
  });

  document.getElementById('totalItems').textContent = `${totalItems} шт`;
  document.getElementById('modalTotal').textContent = `${totalPrice}₽`;
  document.getElementById('cartTotal').textContent = `${getTotalPrice()}₽`;
  const addToCartBtn = document.getElementById('addToCartBtn');
  if (addToCartBtn) {
    addToCartBtn.style.display = cart.length > 0 ? 'block' : 'none';
  }
}

function updateCartItem(productId, weight, delta) {
  const product = products[productId];
  const price = product.prices[weight] || 0;

  const matchingItems = cart.filter(item => item.id === productId && item.weight === weight);

  if (delta > 0) {
    cart.push({
      id: productId,
      name: product.name,
      weight: weight,
      quantity: 1,
      price: price,
      hasAddons: false,
      total: price,
      emoji: getBreadEmoji(product.name),
      timestamp: Date.now()
    });
  } else if (delta < 0 && matchingItems.length > 0) {
    const index = cart.findIndex(item => item.id === productId && item.weight === weight);
    if (index !== -1) cart.splice(index, 1);
  }

  saveCart();
  updateCartIndicator();
  if (document.getElementById('cartGrid')) renderCart();
}

function addToCart(productId) {
  showNotification('Переходим в корзину...', 'success');
  setTimeout(() => {
    closeProductModal();
    window.location.href = '/cart.html';
  }, 1000);
}

function closeProductModal() {
  document.getElementById('productModal').style.display = 'none';
  currentProduct = null;
}

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
    indicator.classList.toggle('visible', totalItems > 0);
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
  if (grid) {
    grid.innerHTML = getEmptyStateHTML('😕', 'Не удалось загрузить каталог', message);
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

function openCart() {
  if (cart.length === 0) {
    showNotification('Корзина пуста', 'info');
    return;
  }
  showNotification('Переходим в корзину...', 'success');
  setTimeout(() => {
    window.location.href = '/cart.html';
  }, 1000);
}

function showNotification(message, type = 'info') {
  let notification = document.getElementById('notification');
  if (notification) {
    notification.remove();
  }

  notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = 'notification';
  notification.classList.add(type);
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('visible');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('visible');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

document.addEventListener('click', function(e) {
  const modal = document.getElementById('productModal');
  if (e.target === modal) {
    closeProductModal();
  }
});

document.getElementById('searchInput')?.addEventListener('input', handleSearch);

function renderCart() {
  const grid = document.getElementById('cartGrid');
  if (!grid) return;

  if (cart.length === 0) {
    grid.innerHTML = getEmptyStateHTML('🛒', 'Корзина пуста', 'Добавьте товары из каталога');
    document.getElementById('cartTotal').textContent = '0₽';
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) checkoutBtn.disabled = true;
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
      ${products[item.id]?.addons && parseInt(products[item.id].addons) > 0 ? `
        <label class="addons-checkbox" style="margin: 10px;">
          <input type="checkbox" id="addon-${item.timestamp}" ${item.hasAddons ? 'checked' : ''} onchange="toggleCartAddon(${item.timestamp}, this.checked)">
          <span class="checkmark"></span>
          Добавки (+${products[item.id].addons}₽)
        </label>
      ` : ''}
      <button class="remove-btn" onclick="removeCartItem(${item.timestamp})">Удалить</button>
    </div>
  `).join('');

  document.getElementById('cartTotal').textContent = `${getTotalPrice()}₽`;
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) checkoutBtn.disabled = false;
}

function removeCartItem(timestamp) {
  const index = cart.findIndex(item => item.timestamp === Number(timestamp));
  if (index !== -1) {
    const removedItem = cart[index];
    cart.splice(index, 1);
    saveCart();
    renderCart();
    updateCartIndicator();
    showNotification(`Удалён ${removedItem.name} (${removedItem.weight}г)`, 'success');
    if (currentProduct && currentProduct === removedItem.id) {
      quantities[currentProduct][removedItem.weight] = (quantities[currentProduct][removedItem.weight] || 1) - 1;
      document.getElementById(`qty-${currentProduct}-${removedItem.weight}`).textContent = quantities[currentProduct][removedItem.weight];
      updateModalSummary(currentProduct);
    }
    if (document.getElementById('productGrid')) renderProducts(products);
  }
}

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
  }
}

if (document.getElementById('productGrid') || document.getElementById('cartGrid')) {
  loadCatalog();
}

function clearCache() {
  localStorage.removeItem('catalog');
  loadCatalog();
}




document.getElementById('checkoutBtn')?.addEventListener('click', () => {
  if (cart.length === 0) {
    showNotification('Корзина пуста', 'info');
    return;
  }
  showNotification('Оформляем заказ...', 'success');
  const data = { action: 'checkout', cart: cart, total: getTotalPrice(), totalItems: getTotalItems() };
  Telegram.WebApp.sendData(JSON.stringify(data));
});
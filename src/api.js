/**
 * Amazon browser-automation API layer.
 * All functions receive a Playwright Page object that has already been
 * authenticated via ensureLoggedIn().
 */

/**
 * Search Amazon for products.
 * @param {import('playwright').Page} page
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array<{asin,title,price,rating,reviewCount,url,imageUrl}>>}
 */
export async function searchProducts(page, query, limit = 10) {
  const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-component-type="s-search-result"]', {
    timeout: 10000,
  });

  const results = await page.evaluate((limit) => {
    const cards = [
      ...document.querySelectorAll('[data-component-type="s-search-result"]'),
    ].slice(0, limit);

    return cards.map((card) => {
      const asin = card.getAttribute('data-asin') || null;

      const titleEl = card.querySelector('h2 a span');
      const title = titleEl ? titleEl.textContent.trim() : null;

      const priceWhole = card.querySelector('.a-price-whole');
      const priceFraction = card.querySelector('.a-price-fraction');
      let price = null;
      if (priceWhole) {
        price = priceWhole.textContent.replace(/[^0-9]/g, '');
        if (priceFraction) price += '.' + priceFraction.textContent.replace(/[^0-9]/g, '');
        price = parseFloat(price) || null;
      }

      const ratingEl = card.querySelector('.a-icon-alt');
      const rating = ratingEl
        ? parseFloat(ratingEl.textContent.split(' ')[0]) || null
        : null;

      const reviewEl = card.querySelector('[aria-label*="stars"] + span, .a-size-base.s-underline-text');
      const reviewCount = reviewEl
        ? parseInt(reviewEl.textContent.replace(/[^0-9]/g, ''), 10) || null
        : null;

      const linkEl = card.querySelector('h2 a');
      const url = linkEl ? 'https://www.amazon.com' + linkEl.getAttribute('href') : null;

      const imgEl = card.querySelector('img.s-image');
      const imageUrl = imgEl ? imgEl.getAttribute('src') : null;

      return { asin, title, price, rating, reviewCount, url, imageUrl };
    });
  }, limit);

  return results.filter((r) => r.asin && r.title);
}

/**
 * Get detailed information about a product by ASIN.
 * @param {import('playwright').Page} page
 * @param {string} asin
 * @returns {Promise<object>}
 */
export async function getProductDetails(page, asin) {
  const url = `https://www.amazon.com/dp/${asin}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#productTitle', { timeout: 10000 });

  const details = await page.evaluate(() => {
    const getText = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent.trim() : null;
    };

    const title = getText('#productTitle');

    const priceEl =
      document.querySelector('.a-price .a-offscreen') ||
      document.querySelector('#priceblock_ourprice') ||
      document.querySelector('#priceblock_dealprice');
    const priceRaw = priceEl ? priceEl.textContent.trim() : null;
    const price = priceRaw
      ? parseFloat(priceRaw.replace(/[^0-9.]/g, '')) || null
      : null;

    const ratingEl = document.querySelector('#acrPopover');
    const rating = ratingEl
      ? parseFloat(ratingEl.getAttribute('title')?.split(' ')[0]) || null
      : null;

    const reviewCountEl = document.querySelector('#acrCustomerReviewText');
    const reviewCount = reviewCountEl
      ? parseInt(reviewCountEl.textContent.replace(/[^0-9]/g, ''), 10) || null
      : null;

    const brand = getText('#bylineInfo') || getText('.po-brand .a-span9');

    const availability = getText('#availability span');

    // Bullet point features
    const featureEls = document.querySelectorAll('#feature-bullets li span.a-list-item');
    const features = [...featureEls].map((el) => el.textContent.trim()).filter(Boolean);

    // Main product image
    const imgEl = document.querySelector('#imgBlkFront, #landingImage');
    const imageUrl = imgEl ? imgEl.getAttribute('src') : null;

    // Description
    const descEl = document.querySelector('#productDescription p');
    const description = descEl ? descEl.textContent.trim() : null;

    return {
      title,
      price,
      rating,
      reviewCount,
      brand,
      availability,
      features,
      imageUrl,
      description,
    };
  });

  return { asin, url, ...details };
}

/**
 * View the current cart contents.
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{asin,title,price,quantity,url}>>}
 */
export async function viewCart(page) {
  await page.goto('https://www.amazon.com/gp/cart/view.html', {
    waitUntil: 'domcontentloaded',
  });

  // Wait for either cart items or the empty cart message
  await page
    .waitForSelector('#sc-active-cart, .sc-cart-items-container, .a-text-center', {
      timeout: 10000,
    })
    .catch(() => {});

  const items = await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-itemtype="active"]');
    return [...rows].map((row) => {
      const asin =
        row.getAttribute('data-asin') ||
        row.querySelector('[data-asin]')?.getAttribute('data-asin') ||
        null;

      const titleEl = row.querySelector('.sc-product-title');
      const title = titleEl ? titleEl.textContent.trim() : null;

      const priceEl = row.querySelector('.sc-product-price .a-offscreen, .sc-price');
      const priceRaw = priceEl ? priceEl.textContent.trim() : null;
      const price = priceRaw
        ? parseFloat(priceRaw.replace(/[^0-9.]/g, '')) || null
        : null;

      const qtyEl = row.querySelector('.a-dropdown-prompt, .sc-quantity-textfield');
      const quantity = qtyEl ? parseInt(qtyEl.textContent.trim(), 10) || 1 : 1;

      const linkEl = row.querySelector('a.sc-product-link');
      const url = linkEl ? 'https://www.amazon.com' + linkEl.getAttribute('href') : null;

      return { asin, title, price, quantity, url };
    });
  });

  return items;
}

/**
 * Add a product to the cart by ASIN.
 * Navigates to the product page and clicks Add to Cart.
 * @param {import('playwright').Page} page
 * @param {string} asin
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function addToCart(page, asin) {
  const url = `https://www.amazon.com/dp/${asin}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait for the Add to Cart button
  const addToCartBtn = await page
    .waitForSelector('#add-to-cart-button, [name="submit.add-to-cart"]', {
      timeout: 10000,
    })
    .catch(() => null);

  if (!addToCartBtn) {
    // Check if this is a "Buy Now" only item or unavailable
    const unavailable = await page
      .$eval('#availability span', (el) => el.textContent.trim())
      .catch(() => null);
    return {
      success: false,
      message: unavailable
        ? `Product unavailable: ${unavailable}`
        : 'Add to Cart button not found. Product may be unavailable.',
    };
  }

  await addToCartBtn.click();

  // Wait for cart confirmation
  await page
    .waitForSelector(
      '#NATC_SMART_WAGON_CONF_MSG_SUCCESS, #attachDisplayAddBaseAlert, #sw-atc-confirmation',
      { timeout: 8000 }
    )
    .catch(() => {});

  return { success: true, message: `Added ASIN ${asin} to cart.` };
}

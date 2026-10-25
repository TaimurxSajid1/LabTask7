// Lab Task 07 (Part 2) - E-Commerce Store end-points using a PERSISTENT API
// Name: Taimur Sajid | Roll No: 241839
// Store: VÉRIDIAN // Zinc Atelier (e-commerce store from Lab 3)
//
// Same node:http style as the instructor's code, but instead of keeping data
// in memory, every change is saved to data/db.json on disk. Restarting the
// server keeps all users, products, carts, orders and reviews.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = 3003;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Store rules taken from Lab 3 app.js
const COUPONS = { ZINC15: 0.15 };      // promo code -> discount rate
const FREE_SHIPPING_THRESHOLD = 150;   // free shipping on subtotal >= $150
const SHIPPING_FEE = 18;
const CATEGORIES = ['planters', 'lighting', 'botanicals', 'vessels'];
const PAYMENT_METHODS = ['card', 'cod', 'bank'];
const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

// ---------------- Persistence layer (JSON file) ----------------
function seedData() {
  return {
    users: [],
    products: [
      { id: 'prod-1', name: 'Monolith Architectural Zinc Planter', category: 'planters', price: 185, originalPrice: 215, rating: 4.9, reviewsCount: 38, stock: 12, description: 'Cold-patinated solid zinc alloy vessel engineered with internal root aeration channels.' },
      { id: 'prod-2', name: 'Verdant Luminaire Desk Lamp No. 04', category: 'lighting', price: 240, originalPrice: 280, rating: 5.0, reviewsCount: 29, stock: 8, description: 'Precision-milled matte zinc-green body with spun solid brass accents.' },
      { id: 'prod-3', name: 'Cold-Pressed Conifer Botanical Essence (50ml)', category: 'botanicals', price: 88, rating: 4.8, reviewsCount: 46, stock: 24, description: 'Wild-harvested subalpine fir, hinoki cypress, and cold-pressed juniper berry in organic squalane.' },
      { id: 'prod-4', name: 'Prism Faceted Terrarium Vessel', category: 'vessels', price: 160, rating: 4.9, reviewsCount: 35, stock: 14, description: 'Faceted geometric biosphere built with hand-soldered weathered zinc metal seams.' },
      { id: 'prod-5', name: 'Cast Zinc Botanical Mist Nebulizer', category: 'botanicals', price: 125, originalPrice: 145, rating: 4.7, reviewsCount: 19, stock: 16, description: 'Solid zinc-weighted pneumatic fine-droplet plant mister.' },
      { id: 'prod-6', name: 'Architectural Zinc Horizon Incense Monolith', category: 'vessels', price: 74, rating: 4.9, reviewsCount: 52, stock: 20, description: 'Minimalist 30cm extruded zinc incense burner tray with integrated magnetic ash collector.' }
    ],
    carts: {},
    orders: [],
    reviews: [
      { id: 'rev-1', productId: 'prod-1', author: 'Elena Rostova', rating: 5, date: '2026-03-14', verified: true, title: 'Flawless weight and exquisite patina finish', comment: 'The Monolith Zinc Planter exceeded every expectation.', helpful: 24 },
      { id: 'rev-2', productId: 'prod-2', author: 'Marcus Vance', rating: 5, date: '2026-02-28', verified: true, title: 'The Verdant Luminaire is an heirloom work', comment: 'The brass touch dial responsiveness and the deep matte zinc chassis give it an unmatched presence.', helpful: 19 },
      { id: 'rev-3', productId: 'prod-3', author: 'Sora Takahashi', rating: 5, date: '2026-01-19', verified: true, title: 'True sensory luxury with conifer depth', comment: 'The Hinoki and subalpine notes in the Conifer Essence are remarkably authentic.', helpful: 15 }
    ]
  };
}

// Load the database from disk (create it with seed data the first time)
function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData(), null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

// Save the database to disk (write a temp file first, then rename, so the file is never half-written)
function saveDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

let db = loadDb();

// ---------------- Helpers ----------------
function newId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function hashPassword(password, salt = crypto.randomBytes(8).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
  const [salt] = stored.split(':');
  return hashPassword(password, salt) === stored;
}

// Never send the password hash back to the client
function publicUser(user) {
  const { password, ...rest } = user;
  return rest;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function getCart(userId) {
  if (!db.carts[userId]) db.carts[userId] = { items: [], coupon: null };
  return db.carts[userId];
}

// Cart totals - same formula as updateCartUI() in Lab 3 app.js
function cartSummary(userId) {
  const cart = getCart(userId);
  const items = cart.items.map((item) => {
    const product = db.products.find((p) => p.id === item.productId);
    return {
      productId: item.productId,
      name: product ? product.name : '(removed product)',
      price: product ? product.price : 0,
      quantity: item.quantity,
      itemTotal: product ? product.price * item.quantity : 0
    };
  });
  const subtotal = items.reduce((sum, i) => sum + i.itemTotal, 0);
  const discount = subtotal * (COUPONS[cart.coupon] || 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FEE;
  const round = (n) => Number(n.toFixed(2));
  return {
    userId,
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    coupon: cart.coupon,
    subtotal: round(subtotal),
    discount: round(discount),
    shipping,
    total: round(subtotal - discount + shipping)
  };
}

function validateProduct(body, partial) {
  const required = ['name', 'category', 'price', 'stock'];
  if (!partial) {
    const missing = required.filter((f) => body[f] === undefined || body[f] === '');
    if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  }
  if (body.category !== undefined && !CATEGORIES.includes(body.category)) {
    return `category must be one of: ${CATEGORIES.join(', ')}`;
  }
  if (body.price !== undefined && !(Number(body.price) > 0)) return 'price must be a positive number';
  if (body.stock !== undefined && !(Number.isInteger(Number(body.stock)) && Number(body.stock) >= 0)) {
    return 'stock must be a whole number (0 or more)';
  }
  return null;
}

// ---------------- Server ----------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const reply = (code, body) => {
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*' // lets the Lab 3 front-end call this API
    });
    res.end(JSON.stringify(body));
  };

  // CORS pre-flight request from the browser
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const method = req.method;
  // "/api/cart/user-1/items/prod-1" -> ["api", "cart", "user-1", "items", "prod-1"]
  const parts = url.pathname.split('/').filter(Boolean);
  const route = (m, pattern) => {
    if (m !== method) return null;
    const p = pattern.split('/').filter(Boolean);
    if (p.length !== parts.length) return null;
    const params = {};
    for (let i = 0; i < p.length; i++) {
      if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (p[i] !== parts[i]) return null;
    }
    return params;
  };

  let p;
  try {
    // ================= General =================
    if (route('GET', '/health')) return reply(200, { status: 'ok' });

    if (route('GET', '/')) {
      return reply(200, {
        project: 'VÉRIDIAN // Zinc Atelier - Persistent E-Commerce API',
        student: 'Taimur Sajid - 241839',
        storage: 'data/db.json',
        endpoints: [
          'POST   /api/auth/signup', 'POST   /api/auth/login',
          'GET    /api/users', 'GET    /api/users/:id', 'PUT    /api/users/:id', 'DELETE /api/users/:id',
          'GET    /api/products?category=&sort=&search=', 'GET    /api/products/:id',
          'POST   /api/products', 'PUT    /api/products/:id', 'PATCH  /api/products/:id', 'DELETE /api/products/:id',
          'GET    /api/cart/:userId', 'POST   /api/cart/:userId/items', 'PUT    /api/cart/:userId/items/:productId',
          'DELETE /api/cart/:userId/items/:productId', 'DELETE /api/cart/:userId',
          'POST   /api/cart/:userId/coupon', 'DELETE /api/cart/:userId/coupon',
          'POST   /api/orders (checkout)', 'GET    /api/orders?userId=', 'GET    /api/orders/:id',
          'PATCH  /api/orders/:id/status', 'DELETE /api/orders/:id',
          'GET    /api/reviews?productId=', 'GET    /api/reviews/:id', 'POST   /api/reviews',
          'PUT    /api/reviews/:id', 'POST   /api/reviews/:id/helpful', 'DELETE /api/reviews/:id'
        ]
      });
    }

    // ================= 1. Auth (Signup & Login) =================
    if (route('POST', '/api/auth/signup')) {
      const { name, email, password } = await readBody(req);
      if (!name || !email || !password) return reply(400, { error: 'name, email and password are required' });
      if (!/^\S+@\S+\.\S+$/.test(email)) return reply(400, { error: 'Invalid email address' });
      if (String(password).length < 6) return reply(400, { error: 'Password must be at least 6 characters' });
      if (db.users.some((u) => u.email === email.toLowerCase())) return reply(409, { error: 'Email already registered' });

      const user = {
        id: newId('user'),
        name,
        email: email.toLowerCase(),
        password: hashPassword(String(password)),
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
      saveDb();
      return reply(201, { message: 'Signup successful', user: publicUser(user) });
    }

    if (route('POST', '/api/auth/login')) {
      const { email, password } = await readBody(req);
      if (!email || !password) return reply(400, { error: 'email and password are required' });
      const user = db.users.find((u) => u.email === String(email).toLowerCase());
      if (!user || !checkPassword(String(password), user.password)) {
        return reply(401, { error: 'Invalid email or password' });
      }
      return reply(200, { message: `Welcome back, ${user.name}`, user: publicUser(user) });
    }

    // ================= 2. Users =================
    if (route('GET', '/api/users')) return reply(200, db.users.map(publicUser));

    if ((p = route('GET', '/api/users/:id'))) {
      const user = db.users.find((u) => u.id === p.id);
      if (!user) return reply(404, { error: 'User not found' });
      return reply(200, publicUser(user));
    }

    if ((p = route('PUT', '/api/users/:id'))) {
      const user = db.users.find((u) => u.id === p.id);
      if (!user) return reply(404, { error: 'User not found' });
      const { name, password } = await readBody(req);
      if (name) user.name = name;
      if (password) {
        if (String(password).length < 6) return reply(400, { error: 'Password must be at least 6 characters' });
        user.password = hashPassword(String(password));
      }
      saveDb();
      return reply(200, { message: 'User updated', user: publicUser(user) });
    }

    if ((p = route('DELETE', '/api/users/:id'))) {
      const user = db.users.find((u) => u.id === p.id);
      if (!user) return reply(404, { error: 'User not found' });
      db.users = db.users.filter((u) => u.id !== p.id);
      delete db.carts[p.id];
      saveDb();
      return reply(200, { message: 'User deleted', user: publicUser(user) });
    }

    // ================= 3. Products (listing, filter, sort, CRUD) =================
    if (route('GET', '/api/products')) {
      let products = [...db.products];
      const category = url.searchParams.get('category');
      const search = url.searchParams.get('search');
      const sort = url.searchParams.get('sort') ?? 'featured';

      if (category && category !== 'all') products = products.filter((x) => x.category === category);
      if (search) products = products.filter((x) => x.name.toLowerCase().includes(search.toLowerCase()));
      if (sort === 'price-low') products.sort((a, b) => a.price - b.price);
      if (sort === 'price-high') products.sort((a, b) => b.price - a.price);
      if (sort === 'rating') products.sort((a, b) => b.rating - a.rating);
      return reply(200, products);
    }

    if ((p = route('GET', '/api/products/:id'))) {
      const product = db.products.find((x) => x.id === p.id);
      if (!product) return reply(404, { error: 'Product not found' });
      return reply(200, { ...product, reviews: db.reviews.filter((r) => r.productId === product.id) });
    }

    if (route('POST', '/api/products')) {
      const body = await readBody(req);
      const error = validateProduct(body, false);
      if (error) return reply(400, { error });
      const product = {
        id: newId('prod'),
        name: body.name,
        category: body.category,
        price: Number(body.price),
        originalPrice: body.originalPrice ? Number(body.originalPrice) : undefined,
        rating: 0,
        reviewsCount: 0,
        stock: Number(body.stock),
        description: body.description ?? ''
      };
      db.products.push(product);
      saveDb();
      return reply(201, { message: 'Product created', product });
    }

    if ((p = route('PUT', '/api/products/:id')) || (p = route('PATCH', '/api/products/:id'))) {
      const product = db.products.find((x) => x.id === p.id);
      if (!product) return reply(404, { error: 'Product not found' });
      const { id, rating, reviewsCount, ...body } = await readBody(req);
      const error = validateProduct(body, method === 'PATCH');
      if (error) return reply(400, { error });
      if (body.price !== undefined) body.price = Number(body.price);
      if (body.stock !== undefined) body.stock = Number(body.stock);
      Object.assign(product, body);
      saveDb();
      return reply(200, { message: 'Product updated', product });
    }

    if ((p = route('DELETE', '/api/products/:id'))) {
      const product = db.products.find((x) => x.id === p.id);
      if (!product) return reply(404, { error: 'Product not found' });
      db.products = db.products.filter((x) => x.id !== p.id);
      // Remove the deleted product from every cart
      for (const cart of Object.values(db.carts)) {
        cart.items = cart.items.filter((i) => i.productId !== p.id);
      }
      saveDb();
      return reply(200, { message: 'Product deleted', product });
    }

    // ================= 4. Cart (display, add, edit, remove, coupon) =================
    if ((p = route('GET', '/api/cart/:userId'))) {
      return reply(200, cartSummary(p.userId));
    }

    if ((p = route('POST', '/api/cart/:userId/items'))) {
      const { productId, quantity = 1 } = await readBody(req);
      const qty = Number(quantity);
      const product = db.products.find((x) => x.id === productId);
      if (!product) return reply(404, { error: 'Product not found' });
      if (!Number.isInteger(qty) || qty < 1) return reply(400, { error: 'quantity must be a whole number >= 1' });

      const cart = getCart(p.userId);
      const existing = cart.items.find((i) => i.productId === productId);
      const newQty = (existing ? existing.quantity : 0) + qty;
      if (newQty > product.stock) return reply(400, { error: `Only ${product.stock} item(s) in stock` });

      if (existing) existing.quantity = newQty;
      else cart.items.push({ productId, quantity: qty });
      saveDb();
      return reply(201, { message: `${product.name} added to cart`, cart: cartSummary(p.userId) });
    }

    if ((p = route('PUT', '/api/cart/:userId/items/:productId'))) {
      const cart = getCart(p.userId);
      const item = cart.items.find((i) => i.productId === p.productId);
      if (!item) return reply(404, { error: 'Item is not in the cart' });
      const qty = Number((await readBody(req)).quantity);
      if (!Number.isInteger(qty) || qty < 0) return reply(400, { error: 'quantity must be a whole number >= 0' });

      const product = db.products.find((x) => x.id === p.productId);
      if (product && qty > product.stock) return reply(400, { error: `Only ${product.stock} item(s) in stock` });

      if (qty === 0) cart.items = cart.items.filter((i) => i.productId !== p.productId);
      else item.quantity = qty;
      saveDb();
      return reply(200, { message: 'Cart updated', cart: cartSummary(p.userId) });
    }

    if ((p = route('DELETE', '/api/cart/:userId/items/:productId'))) {
      const cart = getCart(p.userId);
      if (!cart.items.some((i) => i.productId === p.productId)) return reply(404, { error: 'Item is not in the cart' });
      cart.items = cart.items.filter((i) => i.productId !== p.productId);
      saveDb();
      return reply(200, { message: 'Item removed from cart', cart: cartSummary(p.userId) });
    }

    if ((p = route('DELETE', '/api/cart/:userId'))) {
      db.carts[p.userId] = { items: [], coupon: null };
      saveDb();
      return reply(200, { message: 'Cart cleared', cart: cartSummary(p.userId) });
    }

    if ((p = route('POST', '/api/cart/:userId/coupon'))) {
      const code = String((await readBody(req)).code ?? '').trim().toUpperCase();
      if (!COUPONS[code]) return reply(400, { error: 'Invalid promo code. Use code: ZINC15' });
      getCart(p.userId).coupon = code;
      saveDb();
      return reply(200, { message: `Promo code ${code} applied`, cart: cartSummary(p.userId) });
    }

    if ((p = route('DELETE', '/api/cart/:userId/coupon'))) {
      getCart(p.userId).coupon = null;
      saveDb();
      return reply(200, { message: 'Promo code removed', cart: cartSummary(p.userId) });
    }

    // ================= 5. Orders (checkout) =================
    if (route('POST', '/api/orders')) {
      const { userId, fullName, email, address, city, phone, paymentMethod } = await readBody(req);
      const missing = Object.entries({ userId, fullName, email, address, paymentMethod })
        .filter(([, v]) => !v).map(([k]) => k);
      if (missing.length) return reply(400, { error: `Missing required fields: ${missing.join(', ')}` });
      if (!PAYMENT_METHODS.includes(paymentMethod)) {
        return reply(400, { error: `paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}` });
      }

      const summary = cartSummary(userId);
      if (summary.items.length === 0) return reply(400, { error: 'Cart is empty' });

      // Check stock for every item before placing the order
      for (const item of summary.items) {
        const product = db.products.find((x) => x.id === item.productId);
        if (!product) return reply(400, { error: `Product ${item.productId} no longer exists` });
        if (item.quantity > product.stock) return reply(400, { error: `Only ${product.stock} of ${product.name} in stock` });
      }
      for (const item of summary.items) {
        db.products.find((x) => x.id === item.productId).stock -= item.quantity;
      }

      const order = {
        id: `VRD-${Date.now().toString().slice(-6)}`,
        userId,
        customer: { fullName, email, address, city: city ?? '', phone: phone ?? '' },
        paymentMethod,
        items: summary.items,
        coupon: summary.coupon,
        subtotal: summary.subtotal,
        discount: summary.discount,
        shipping: summary.shipping,
        total: summary.total,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      db.orders.push(order);
      db.carts[userId] = { items: [], coupon: null }; // empty the cart after checkout
      saveDb();
      return reply(201, { message: 'Order placed successfully', order });
    }

    if (route('GET', '/api/orders')) {
      const userId = url.searchParams.get('userId');
      return reply(200, userId ? db.orders.filter((o) => o.userId === userId) : db.orders);
    }

    if ((p = route('GET', '/api/orders/:id'))) {
      const order = db.orders.find((o) => o.id === p.id);
      if (!order) return reply(404, { error: 'Order not found' });
      return reply(200, order);
    }

    if ((p = route('PATCH', '/api/orders/:id/status'))) {
      const order = db.orders.find((o) => o.id === p.id);
      if (!order) return reply(404, { error: 'Order not found' });
      const { status } = await readBody(req);
      if (!ORDER_STATUSES.includes(status)) return reply(400, { error: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
      if (order.status === 'cancelled') return reply(400, { error: 'Order is already cancelled' });
      if (status === 'cancelled') restock(order);
      order.status = status;
      saveDb();
      return reply(200, { message: 'Order status updated', order });
    }

    if ((p = route('DELETE', '/api/orders/:id'))) {
      const order = db.orders.find((o) => o.id === p.id);
      if (!order) return reply(404, { error: 'Order not found' });
      if (order.status !== 'cancelled') restock(order);
      db.orders = db.orders.filter((o) => o.id !== p.id);
      saveDb();
      return reply(200, { message: 'Order deleted', order });
    }

    // ================= 6. Reviews =================
    if (route('GET', '/api/reviews')) {
      const productId = url.searchParams.get('productId');
      return reply(200, productId ? db.reviews.filter((r) => r.productId === productId) : db.reviews);
    }

    if ((p = route('GET', '/api/reviews/:id'))) {
      const review = db.reviews.find((r) => r.id === p.id);
      if (!review) return reply(404, { error: 'Review not found' });
      return reply(200, review);
    }

    if (route('POST', '/api/reviews')) {
      const { productId, author, rating, title, comment } = await readBody(req);
      if (!author || !rating || !title || !comment) return reply(400, { error: 'author, rating, title and comment are required' });
      const stars = Number(rating);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) return reply(400, { error: 'rating must be between 1 and 5' });
      if (productId && !db.products.some((x) => x.id === productId)) return reply(404, { error: 'Product not found' });

      const review = {
        id: newId('rev'),
        productId: productId ?? null,
        author,
        rating: stars,
        date: new Date().toISOString().slice(0, 10),
        verified: false,
        title,
        comment,
        helpful: 0
      };
      db.reviews.unshift(review);
      updateProductRating(review.productId);
      saveDb();
      return reply(201, { message: 'Review submitted', review });
    }

    if ((p = route('PUT', '/api/reviews/:id'))) {
      const review = db.reviews.find((r) => r.id === p.id);
      if (!review) return reply(404, { error: 'Review not found' });
      const { rating, title, comment } = await readBody(req);
      if (rating !== undefined) {
        const stars = Number(rating);
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) return reply(400, { error: 'rating must be between 1 and 5' });
        review.rating = stars;
      }
      if (title) review.title = title;
      if (comment) review.comment = comment;
      updateProductRating(review.productId);
      saveDb();
      return reply(200, { message: 'Review updated', review });
    }

    if ((p = route('POST', '/api/reviews/:id/helpful'))) {
      const review = db.reviews.find((r) => r.id === p.id);
      if (!review) return reply(404, { error: 'Review not found' });
      review.helpful += 1;
      saveDb();
      return reply(200, { message: 'Marked as helpful', review });
    }

    if ((p = route('DELETE', '/api/reviews/:id'))) {
      const review = db.reviews.find((r) => r.id === p.id);
      if (!review) return reply(404, { error: 'Review not found' });
      db.reviews = db.reviews.filter((r) => r.id !== p.id);
      updateProductRating(review.productId);
      saveDb();
      return reply(200, { message: 'Review deleted', review });
    }

    return reply(404, { error: 'Route not found' });
  } catch (error) {
    return reply(400, { error: error.message });
  }
});

// Put the stock back when an order is cancelled or deleted
function restock(order) {
  for (const item of order.items) {
    const product = db.products.find((x) => x.id === item.productId);
    if (product) product.stock += item.quantity;
  }
}

// Recalculate a product's average rating from the reviews written for it
function updateProductRating(productId) {
  const product = db.products.find((x) => x.id === productId);
  if (!product) return;
  const reviews = db.reviews.filter((r) => r.productId === productId);
  if (reviews.length === 0) return;
  product.rating = Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1));
  product.reviewsCount = reviews.length;
}

server.listen(PORT, () => console.log(`VÉRIDIAN persistent API running at http://localhost:${PORT} (data: ${DB_FILE})`));

// Lab Task 07 (Part 2) - Test client for the persistent e-commerce API
// Name: Taimur Sajid | Roll No: 241839
// First run server.js in another terminal (npm start), then run this file (npm test).
// Node.js 20+ provides global fetch().

const BASE = 'http://localhost:3003';

async function call(method, path, body) {
  const response = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  console.log(`\n${method} ${path} -> ${response.status}`);
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function main() {
  const email = `taimur${Date.now()}@example.com`;

  // 1. Signup & Login
  const signup = await call('POST', '/api/auth/signup', { name: 'Taimur Sajid', email, password: 'secret123' });
  const userId = signup.user.id;
  await call('POST', '/api/auth/login', { email, password: 'secret123' });
  await call('POST', '/api/auth/login', { email, password: 'wrong-pass' });

  // 2. Products: listing, filter, sort, single product
  await call('GET', '/api/products?category=botanicals&sort=price-low');
  await call('GET', '/api/products/prod-1');
  const created = await call('POST', '/api/products', { name: 'Zinc Moss Tray', category: 'planters', price: 60, stock: 5 });
  await call('PATCH', `/api/products/${created.product.id}`, { price: 55 });

  // 3. Cart: add, edit quantity, coupon, remove
  await call('POST', `/api/cart/${userId}/items`, { productId: 'prod-1', quantity: 1 });
  await call('POST', `/api/cart/${userId}/items`, { productId: 'prod-3', quantity: 2 });
  await call('POST', `/api/cart/${userId}/items`, { productId: created.product.id, quantity: 1 });
  await call('PUT', `/api/cart/${userId}/items/prod-3`, { quantity: 1 });
  await call('DELETE', `/api/cart/${userId}/items/${created.product.id}`);
  await call('POST', `/api/cart/${userId}/coupon`, { code: 'zinc15' });
  await call('GET', `/api/cart/${userId}`);

  // 4. Checkout -> order
  const placed = await call('POST', '/api/orders', {
    userId, fullName: 'Taimur Sajid', email, address: 'Air University, E-9', city: 'Islamabad', paymentMethod: 'cod'
  });
  await call('GET', `/api/orders?userId=${userId}`);
  await call('PATCH', `/api/orders/${placed.order.id}/status`, { status: 'shipped' });
  await call('GET', `/api/cart/${userId}`);

  // 5. Reviews
  const review = await call('POST', '/api/reviews', { productId: 'prod-1', author: 'Taimur Sajid', rating: 4, title: 'Solid planter', comment: 'Heavy and well finished.' });
  await call('PUT', `/api/reviews/${review.review.id}`, { rating: 5 });
  await call('POST', `/api/reviews/${review.review.id}/helpful`);
  await call('GET', '/api/reviews?productId=prod-1');

  // Clean up the demo product (the user, order and review stay saved in data/db.json)
  await call('DELETE', `/api/products/${created.product.id}`);
}

main().catch((error) => { console.error('Start server.js first:', error.message); process.exitCode = 1; });

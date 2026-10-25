# Lab Task 07 (Part 2): E-Commerce Store Persistent API
**Name:** Taimur Sajid | **Roll No:** 241839
**Store:** VÉRIDIAN // Zinc Atelier (from Lab 3)

These are the back-end endpoints for the Lab 3 e-commerce store, written in the same `node:http` style as the instructor's code.
The API is **persistent**: every change is saved to `data/db.json`, so users, products, carts, orders and reviews are kept after the server restarts.
If you delete `data/db.json`, the server creates it again with the original Lab 3 seed data. It needs Node.js 20+ and no npm packages.

## Run
```
node server.js          # starts at http://localhost:3003
node test-client.js     # (second terminal) runs the whole flow: signup -> cart -> checkout -> review
```

## Endpoints
| Feature (Lab 3) | Endpoints |
|---|---|
| Signup / Login | `POST /api/auth/signup`, `POST /api/auth/login` (passwords are hashed with scrypt) |
| Users | `GET /api/users`, `GET /api/users/:id`, `PUT /api/users/:id`, `DELETE /api/users/:id` |
| Product listing | `GET /api/products?category=planters&sort=price-low&search=zinc` (sort: featured, price-low, price-high, rating) |
| Products CRUD | `GET /api/products/:id`, `POST /api/products`, `PUT/PATCH /api/products/:id`, `DELETE /api/products/:id` |
| Display cart | `GET /api/cart/:userId` (subtotal, discount, shipping, total) |
| Add to cart | `POST /api/cart/:userId/items` `{ "productId": "prod-1", "quantity": 1 }` |
| Edit cart | `PUT /api/cart/:userId/items/:productId` `{ "quantity": 3 }`, `DELETE /api/cart/:userId/items/:productId`, `DELETE /api/cart/:userId` |
| Promo code | `POST /api/cart/:userId/coupon` `{ "code": "ZINC15" }` (15% off), `DELETE /api/cart/:userId/coupon` |
| Checkout | `POST /api/orders` `{ "userId", "fullName", "email", "address", "city", "phone", "paymentMethod": "card" or "cod" or "bank" }` |
| Orders | `GET /api/orders?userId=`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status` `{ "status": "shipped" }`, `DELETE /api/orders/:id` |
| Reviews | `GET /api/reviews?productId=`, `GET /api/reviews/:id`, `POST /api/reviews`, `PUT /api/reviews/:id`, `POST /api/reviews/:id/helpful`, `DELETE /api/reviews/:id` |

Shipping follows the Lab 3 rule: free when the subtotal is $150 or more, otherwise $18. Checkout checks stock and lowers it.
Cancelling or deleting an order puts the stock back.

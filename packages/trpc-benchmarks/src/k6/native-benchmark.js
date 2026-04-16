// k6 benchmark for native REST API endpoints (no tRPC)
// Run: k6 run src/k6/native-benchmark.js
// Stress test: STRESS_TEST=1 k6 run src/k6/native-benchmark.js

import { check, group, sleep } from "k6";
import http from "k6/http";
import { Counter, Trend } from "k6/metrics";

// Custom metrics
const productListLatency = new Trend("api_product_list_latency");
const productGetLatency = new Trend("api_product_get_latency");
const productSearchLatency = new Trend("api_product_search_latency");
const categoryListLatency = new Trend("api_category_list_latency");
const userGetLatency = new Trend("api_user_get_latency");
const orderCreateLatency = new Trend("api_order_create_latency");
const orderGetLatency = new Trend("api_order_get_latency");
const dashboardLatency = new Trend("api_dashboard_latency");
const errorRate = new Counter("error_rate");
const totalRequests = new Counter("total_requests");
const _successfulRequests = new Counter("successful_requests");

// Configuration from environment
const BASE_URL = __ENV.BASE_URL || "http://localhost:3004";
const RUNTIME = __ENV.RUNTIME || "bun";
const FRAMEWORK = __ENV.FRAMEWORK || "elysia-native";
const STRESS_TEST = __ENV.STRESS_TEST === "1" || __ENV.STRESS_TEST === "true";

// Define scenarios based on mode
const scenarios = STRESS_TEST
	? {
			// Stress test: ramp up aggressively to find breaking point
			stress_test: {
				executor: "ramping-vus",
				startVUs: 5,
				stages: [
					{ duration: "20s", target: 50 }, // Ramp to 50 VUs
					{ duration: "30s", target: 100 }, // Ramp to 100 VUs
					{ duration: "30s", target: 150 }, // Ramp to 150 VUs
					{ duration: "30s", target: 200 }, // Peak at 200 VUs
					{ duration: "20s", target: 200 }, // Hold at peak
					{ duration: "20s", target: 0 }, // Ramp down
				],
				gracefulRampDown: "10s",
			},
		}
	: {
			// Normal load test
			realistic_load: {
				executor: "ramping-vus",
				startVUs: 1,
				stages: [
					{ duration: "15s", target: 10 },
					{ duration: "30s", target: 10 },
					{ duration: "15s", target: 20 },
					{ duration: "10s", target: 0 },
				],
				gracefulRampDown: "5s",
			},
		};

export const options = {
	scenarios: scenarios,
	thresholds: STRESS_TEST
		? {
				// Relaxed thresholds for stress test
				http_req_duration: ["p(95)<2000"],
				error_rate: ["rate<0.5"],
			}
		: {
				http_req_duration: ["p(95)<500"],
				error_rate: ["count<100"],
				api_product_list_latency: ["p(95)<200"],
				api_dashboard_latency: ["p(95)<300"],
				api_order_create_latency: ["p(95)<500"],
			},
};

// Test data
let testProducts = [];
let testUsers = [];
let testCategories = [];
const createdOrders = [];

export function setup() {
	console.log(`Starting native API benchmark against ${BASE_URL}`);
	console.log(`Server: ${RUNTIME} + ${FRAMEWORK} + sqlite`);
	console.log(
		"Mode: " +
			(STRESS_TEST ? "STRESS TEST (up to 200 VUs)" : "Normal load test"),
	);

	// Get products
	var productsRes = http.get(`${BASE_URL}/api/products?limit=50`);
	if (productsRes.status === 200) {
		var data = JSON.parse(productsRes.body);
		if (data?.products) {
			testProducts = data.products;
		}
	}

	// Get categories
	var categoriesRes = http.get(`${BASE_URL}/api/categories`);
	if (categoriesRes.status === 200) {
		var cats = JSON.parse(categoriesRes.body);
		if (cats && Array.isArray(cats)) {
			testCategories = cats;
		}
	}

	// Get a user
	var dashRes = http.get(`${BASE_URL}/api/analytics/dashboard`);
	if (dashRes.status === 200) {
		// Create a test user ID based on existing data
		testUsers = [{ id: "user-1" }, { id: "user-2" }, { id: "user-3" }];
	}

	console.log(`Database has ${testProducts.length} products`);

	return {
		products: testProducts,
		users: testUsers,
		categories: testCategories,
	};
}

function getRandomItem(arr) {
	if (!arr || arr.length === 0) return null;
	return arr[Math.floor(Math.random() * arr.length)];
}

export default function (data) {
	var products = data.products || [];
	var _users = data.users || [];
	var _categories = data.categories || [];

	// Scenario weights (probability of each action)
	var rand = Math.random();

	if (rand < 0.35) {
		// 35% - Browse products
		group("Browse Products", () => {
			// List products
			var start = Date.now();
			var limit = Math.floor(Math.random() * 20) + 10;
			var offset = Math.floor(Math.random() * 100);
			var res = http.get(
				`${BASE_URL}/api/products?limit=${limit}&offset=${offset}`,
			);
			productListLatency.add(Date.now() - start);
			totalRequests.add(1);

			var listOk = check(res, {
				"product.list ok": (r) => r.status === 200,
			});
			if (!listOk) errorRate.add(1);

			sleep(0.1);

			// Get single product
			var product = getRandomItem(products);
			if (product?.id) {
				start = Date.now();
				res = http.get(`${BASE_URL}/api/products/${product.id}`);
				productGetLatency.add(Date.now() - start);
				totalRequests.add(1);

				var getOk = check(res, {
					"product.get ok": (r) => r.status === 200,
				});
				if (!getOk) errorRate.add(1);
			}

			sleep(0.1);

			// Get categories
			start = Date.now();
			res = http.get(`${BASE_URL}/api/categories`);
			categoryListLatency.add(Date.now() - start);
			totalRequests.add(1);

			var catOk = check(res, {
				"category.list ok": (r) => r.status === 200,
			});
			if (!catOk) errorRate.add(1);
		});
	} else if (rand < 0.55) {
		// 20% - Search products
		group("Search Products", () => {
			var searchTerms = [
				"pro",
				"widget",
				"gadget",
				"device",
				"tool",
				"premium",
				"basic",
			];
			var term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

			var start = Date.now();
			var res = http.get(`${BASE_URL}/api/products/search?q=${term}&limit=20`);
			productSearchLatency.add(Date.now() - start);
			totalRequests.add(1);

			var searchOk = check(res, {
				"product.search ok": (r) => r.status === 200,
			});
			if (!searchOk) errorRate.add(1);
		});
	} else if (rand < 0.7) {
		// 15% - Place order
		group("Place Order", () => {
			if (products.length < 2) return;

			var product1 = getRandomItem(products);
			var product2 = getRandomItem(products);
			if (!product1 || !product2) return;

			var orderData = {
				userId: `user-${Math.floor(Math.random() * 100) + 1}`,
				items: [
					{
						productId: product1.id,
						quantity: Math.floor(Math.random() * 2) + 1,
					},
					{
						productId: product2.id,
						quantity: Math.floor(Math.random() * 2) + 1,
					},
				],
			};

			var start = Date.now();
			var res = http.post(`${BASE_URL}/api/orders`, JSON.stringify(orderData), {
				headers: { "Content-Type": "application/json" },
			});
			orderCreateLatency.add(Date.now() - start);
			totalRequests.add(1);

			var orderOk = check(res, {
				"order.create ok or stock issue": (r) =>
					r.status === 200 || r.status === 201 || r.status === 400,
			});
			if (!orderOk) errorRate.add(1);

			if (res.status === 200 || res.status === 201) {
				try {
					var order = JSON.parse(res.body);
					if (order?.id) {
						createdOrders.push(order.id);
					}
				} catch (_e) {}
			}
		});
	} else if (rand < 0.8) {
		// 10% - View order
		group("View Order", () => {
			var orderId = getRandomItem(createdOrders) || "order-1";

			var start = Date.now();
			var res = http.get(`${BASE_URL}/api/orders/${orderId}`);
			orderGetLatency.add(Date.now() - start);
			totalRequests.add(1);

			var orderOk = check(res, {
				"order.get ok": (r) => r.status === 200 || r.status === 404,
			});
			if (!orderOk) errorRate.add(1);
		});
	} else if (rand < 0.9) {
		// 10% - User account
		group("User Account", () => {
			var userId = `user-${Math.floor(Math.random() * 100) + 1}`;

			var start = Date.now();
			var res = http.get(`${BASE_URL}/api/users/${userId}`);
			userGetLatency.add(Date.now() - start);
			totalRequests.add(1);

			var userOk = check(res, {
				"user.get ok": (r) => r.status === 200 || r.status === 404,
			});
			if (!userOk) errorRate.add(1);

			sleep(0.1);

			// Get user orders
			res = http.get(`${BASE_URL}/api/users/${userId}/orders?limit=5`);
			totalRequests.add(1);

			var ordersOk = check(res, {
				"user.orders ok": (r) => r.status === 200,
			});
			if (!ordersOk) errorRate.add(1);
		});
	} else {
		// 10% - Dashboard analytics
		group("Dashboard Analytics", () => {
			var start = Date.now();
			var res = http.get(`${BASE_URL}/api/analytics/dashboard`);
			dashboardLatency.add(Date.now() - start);
			totalRequests.add(1);

			var dashOk = check(res, {
				"analytics.dashboard ok": (r) => r.status === 200,
			});
			if (!dashOk) errorRate.add(1);

			sleep(0.1);

			// Revenue by category
			res = http.get(`${BASE_URL}/api/analytics/revenue-by-category`);
			totalRequests.add(1);

			var revOk = check(res, {
				"analytics.revenueByCategory ok": (r) => r.status === 200,
			});
			if (!revOk) errorRate.add(1);
		});
	}

	sleep(0.05 + Math.random() * 0.15);
}

export function teardown(_data) {
	console.log(`\nBenchmark complete for: ${RUNTIME} + ${FRAMEWORK}`);
	console.log(`Created ${createdOrders.length} orders during test`);
}

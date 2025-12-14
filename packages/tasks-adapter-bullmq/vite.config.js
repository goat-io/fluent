import { defineConfig } from "vitest/config";

import "dotenv/config";

export default defineConfig({
	test: {
		globalSetup: "./setup.ts",
		// Run tests sequentially to avoid race conditions with shared Redis state
		sequence: {
			shuffle: false,
		},
		// Timeout for BullMQ tests
		testTimeout: 20000,
	},
});

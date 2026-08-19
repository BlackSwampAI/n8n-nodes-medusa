// Deliberately CommonJS rather than TypeScript. The n8n community-node lint rules apply to every
// .ts file in the repository and cannot be scoped, because n8n's strict mode forbids modifying
// eslint.config.mjs. A .ts config here would be linted as if it were node source and rejected
// for importing Medusa packages and reading process.env.
const { loadEnv, defineConfig } = require('@medusajs/framework/utils');

loadEnv(process.env.NODE_ENV || 'development', process.cwd());

module.exports = defineConfig({
	projectConfig: {
		databaseUrl: process.env.DATABASE_URL,
		http: {
			storeCors: process.env.STORE_CORS || '*',
			adminCors: process.env.ADMIN_CORS || '*',
			authCors: process.env.AUTH_CORS || '*',
			jwtSecret: process.env.JWT_SECRET || 'test-jwt-secret',
			cookieSecret: process.env.COOKIE_SECRET || 'test-cookie-secret',
		},
	},
	// The admin dashboard is not needed to exercise the Admin API, and building it would pull in
	// React and Vite and add minutes to every cold start.
	admin: {
		disable: true,
	},
});

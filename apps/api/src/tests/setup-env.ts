// Minimal env so pure-unit tests can import modules that load `env` at import
// time (no real services are contacted by builder tests).
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/test'
process.env['ENCRYPTION_KEY'] ??= '0'.repeat(64)
process.env['BETTER_AUTH_SECRET'] ??= '0'.repeat(32)
process.env['APP_URL'] ??= 'https://flq.social'
process.env['APP_DOMAIN'] ??= 'flq.social'

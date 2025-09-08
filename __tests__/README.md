# BE-01 Auth Testing Suite

Comprehensive test suite for the authentication system covering unit tests, integration tests, E2E flows, and security validation.

## Test Categories

### 1. Unit Tests (`__tests__/unit/`)

#### `crypto.test.ts`
- Password hashing with Argon2id
- Secure token generation and verification
- HMAC token operations
- Performance and edge case testing

#### `jwt.test.ts`
- JWT token creation and verification
- Security contract compliance (aud, iss, claims)
- Token expiration and rotation
- Algorithm validation and performance

#### `session.test.ts`
- Session creation and management
- Refresh token rotation logic
- Token reuse detection and security response
- Session revocation mechanisms

#### `zod-schemas.test.ts`
- All DTO validation schemas
- Input sanitization and security
- Edge cases and error handling
- Unicode and injection prevention

### 2. Integration Tests (`__tests__/integration/`)

#### `auth-endpoints.test.ts`
- All auth API endpoints (login, register, etc.)
- Happy path and error scenarios
- Rate limiting and security responses
- Request/response validation

### 3. E2E Tests (`__tests__/e2e/`)

#### `email-flows.test.ts`
- Complete email verification flow
- Password reset end-to-end
- Email template validation
- Dev transport token extraction

### 4. Security Tests (`__tests__/security/`)

#### `security-validation.test.ts`
- Cookie security flags (Secure, HttpOnly, SameSite)
- JWT security validation
- Session security mechanisms
- Input validation and timing attack prevention

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test category
npm test -- __tests__/unit/
npm test -- __tests__/integration/
npm test -- __tests__/e2e/
npm test -- __tests__/security/

# Run specific test file
npm test -- crypto.test.ts

# Watch mode for development
npm run test:watch
```

## Test Configuration

### Environment Variables
Tests use isolated environment configuration:
- `NODE_ENV=test`
- Test database URL
- Test JWT secrets and configuration
- Dev email provider for E2E tests

### Mocking Strategy
- **Unit tests**: Mock all external dependencies
- **Integration tests**: Mock database and external services
- **E2E tests**: Use real email dev transport, mock database
- **Security tests**: Minimal mocking for authentic security validation

### Coverage Requirements
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

## Key Test Scenarios

### Security Validation
✅ Cookie flags in production vs development  
✅ JWT audience and issuer validation  
✅ Token expiration enforcement  
✅ Signature tampering detection  
✅ Algorithm confusion prevention  
✅ Timing attack resistance  

### Token Management
✅ Refresh token rotation  
✅ Token reuse detection  
✅ Session revocation on security violations  
✅ Token family cleanup  
✅ Concurrent token operations  

### Email Flows
✅ Registration → email verification  
✅ Password reset → new password  
✅ Email change confirmation  
✅ Token extraction from dev transport  
✅ Template validation and security  

### API Endpoints
✅ All auth endpoints with happy/error paths  
✅ Input validation and sanitization  
✅ Rate limiting responses  
✅ Proper HTTP status codes  
✅ Cookie and header handling  

### Crypto Operations
✅ Argon2id password hashing  
✅ Secure token generation  
✅ HMAC operations  
✅ Performance characteristics  
✅ Edge cases and error handling  

## Debugging Tests

### Common Issues
1. **Environment variables**: Ensure test environment is properly set
2. **Database mocks**: Verify mock responses match expected schema
3. **Timing tests**: May be flaky on slow systems
4. **Email files**: Check `tmp/emails/` directory for E2E email tests

### Test Data
Tests use deterministic test data where possible:
- Fixed user IDs and session IDs
- Predictable timestamps for expiry testing
- Known good/bad tokens for validation

### Mock Verification
Each test category includes verification that:
- Correct functions are called with expected parameters
- Database operations match expected patterns
- Security functions are invoked appropriately
- Error conditions are handled properly

## Production Considerations

These tests validate production-ready security:
- **Cookie security**: Proper flags for HTTPS deployment
- **JWT validation**: Strict claim and signature verification
- **Session security**: Token reuse detection and response
- **Input validation**: XSS and injection prevention
- **Rate limiting**: Proper 429 responses with Retry-After headers

## Continuous Integration

For CI environments:
```bash
npm run test:ci
```

This runs tests with:
- No watch mode
- Coverage reporting
- JUnit XML output
- Proper exit codes for build systems
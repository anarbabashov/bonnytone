import '@testing-library/jest-dom'

// Mock Next.js modules
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
  headers: jest.fn(),
}))

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.JWT_PRIVATE_KEY = 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t'
process.env.JWT_PUBLIC_KEY = 'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0='
process.env.JWT_ALGORITHM = 'HS512'
process.env.JWT_ISSUER = 'test-issuer'
process.env.JWT_AUDIENCE = 'test-audience'
process.env.TOKEN_HMAC_SECRET = 'test-secret-key-32-bytes-long-exactly'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.EMAIL_PROVIDER = 'dev'

// Global test timeout
jest.setTimeout(10000)
# Changelog

All notable changes to the say-auth library will be documented in this file.

## [1.0.0] - 2024-01-XX

### Added
- Initial release of say-auth
- JWT authentication with refresh tokens
- MFA/2FA support with TOTP
- Role-Based Access Control (RBAC)
- Auto token refresh mechanism
- Rate limiting for login attempts
- Audit logging for security events
- Session management across devices
- Token blacklisting for secure logout
- Device fingerprinting for trusted devices
- Secure encrypted token storage
- React hooks: `useAuth`, `useProtectedRoute`
- Components: `AuthProvider`, `ProtectedRoute`, `MFASetup`, `MFAVerification`, `SessionWarning`
- TypeScript support with full type definitions
- Next.js 13+ App Router support
- React 16.8+ through 19 compatibility

### Security
- AES-256 encryption for stored tokens
- XSS protection headers
- CSRF protection
- Secure HTTP-only cookie support
- Rate limiting against brute force attacks
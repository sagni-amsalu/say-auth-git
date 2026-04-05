# Changelog

## [1.1.0] - 2024-01-XX

### Added
- New `useAuthContext` hook for better React 19 compatibility
- Added `LoginForm` component with built-in validation
- Added `MFAVerification` component for 2FA flows
- Added `SessionWarning` component for session expiry notifications
- Added `setupAuthInterceptors` for automatic token refresh
- Added environment validation utilities
- Added error tracking integration support
- Added security headers utility
- Added comprehensive TypeScript types

### Changed
- Improved React 16.8+ through 19 compatibility
- Enhanced token storage with versioning and migration support
- Better error messages and debugging information
- Improved performance with memoized context values

### Fixed
- Fixed `createContext` error in React 19
- Fixed token refresh race conditions
- Fixed MFA verification timing issues
- Fixed localStorage SSR issues

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
- Components: `AuthProvider`, `ProtectedRoute`, `MFASetup`
- TypeScript support with full type definitions
- Next.js 13+ App Router support
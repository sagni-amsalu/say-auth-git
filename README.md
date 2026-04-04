# 🔐 say-auth

> Enterprise-grade authentication library for Next.js with MFA, JWT, and security features

[![npm version](https://badge.fury.io/js/say-auth.svg)](https://www.npmjs.com/package/say-auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-13%2B-black.svg)](https://nextjs.org/)
[![Downloads](https://img.shields.io/npm/dm/say-auth.svg)](https://www.npmjs.com/package/say-auth)

## ✨ Features

- 🔐 **JWT Authentication** - Secure token-based authentication
- 🔄 **Auto Token Refresh** - Automatic token refresh with request queuing
- 🛡️ **MFA Support** - Two-factor authentication with TOTP
- 🚫 **Token Blacklisting** - Revoke tokens on logout
- 📝 **Audit Logging** - Track all authentication events
- 🖥️ **Device Fingerprinting** - Prevent session hijacking
- ⚡ **Rate Limiting** - Brute force protection
- 🔒 **AES-256 Encryption** - Secure token storage
- 📦 **Zero Config** - Works out of the box
- 🎯 **TypeScript** - Full type safety

## 📦 Installation

```bash
npm install say-auth
# or
pnpm add say-auth
# or
yarn add say-auth
🚀 Quick Start
1. Wrap your app with AuthProvider
tsx
// app/layout.tsx
import { AuthProvider } from 'say-auth';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider apiUrl={process.env.NEXT_PUBLIC_API_URL}>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
2. Create login page
tsx
// app/login/page.tsx
'use client';
import { useAuth } from 'say-auth';

export default function LoginPage() {
  const { login, isLoading } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await login({
      email: formData.get('email'),
      password: formData.get('password'),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Login'}
      </button>
    </form>
  );
}
3. Protect routes
tsx
// app/dashboard/page.tsx
'use client';
import { ProtectedRoute, useAuth } from 'say-auth';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <h1>Welcome, {user?.name}!</h1>
    </ProtectedRoute>
  );
}
📖 API Reference
useAuth()
Main authentication hook that returns:

Property	Type	Description
user	User | null	Current user data
isAuthenticated	boolean	Authentication status
isLoading	boolean	Loading state
login()	(credentials) => Promise	Login function
logout()	() => Promise	Logout function
refreshSession()	() => Promise	Refresh session
ProtectedRoute
Component for protecting routes:

tsx
<ProtectedRoute requiredRole="admin">
  <AdminPanel />
</ProtectedRoute>
🔧 Requirements
Next.js 13+

React 18+

Axios 1.6+

🤝 Contributing
Contributions are welcome! Please read our contributing guidelines.

📄 License
MIT © Sanyii
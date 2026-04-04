// src/utils/env-validation.ts - CREATE THIS
export function validateEnvironment(): void {
  const required = [
    'NEXT_PUBLIC_API_URL',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  
  // Validate API URL format
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl && !apiUrl.match(/^https?:\/\/.+/)) {
    throw new Error('NEXT_PUBLIC_API_URL must be a valid HTTP/HTTPS URL');
  }
}
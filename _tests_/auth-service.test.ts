// // __tests__/auth-service.test.ts
// import { AuthService } from '../src/services/auth-service';

// describe('AuthService', () => {
//   let authService: AuthService;
  
//   beforeEach(() => {
//     authService = AuthService.getInstance();
//   });
  
//   test('should initialize with correct state', () => {
//     const state = authService.getState();
//     expect(state.isAuthenticated).toBe(false);
//     expect(state.isLoading).toBe(true);
//   });
  
//   test('should handle login correctly', async () => {
//     const result = await authService.login({
//       email: 'test@example.com',
//       password: 'password123',
//     });
//     expect(result).toHaveProperty('user');
//   });
// });
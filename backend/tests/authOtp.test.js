const { generateOtp, verifyOtpCode } = require('../src/controllers/authController');

describe('OTP verification utilities', () => {
  test('generates a 6-digit code', () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  test('verifies a matching OTP for the same normalized email', () => {
    const email = 'dishvit55@gmail.com';
    const store = new Map([[email.toLowerCase(), { otp: '123456', expiresAt: Date.now() + 60000 }]]);

    expect(verifyOtpCode(store, email, '123456')).toBe(true);
    expect(verifyOtpCode(store, email, '111111')).toBe(false);
  });
});

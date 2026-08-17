const { buildGoogleUserPayload } = require('../src/controllers/authController');

describe('Google OAuth payload builder', () => {
  test('maps Google profile data into the app user shape', () => {
    const payload = buildGoogleUserPayload({
      displayName: 'Test User',
      emails: [{ value: 'test@example.com' }],
      photos: [{ value: 'https://example.com/avatar.png' }]
    });

    expect(payload).toMatchObject({
      name: 'Test User',
      email: 'test@example.com',
      avatar: 'https://example.com/avatar.png'
    });
  });
});

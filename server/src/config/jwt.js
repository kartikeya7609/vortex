const developmentSecret = 'aarohan-local-development-only-change-me';
const productionFallbackSecret = 'vortex-2026-production-secure-jwt-signing-secret-key-ieee-nitdgp';

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn('[Security Warning] JWT_SECRET environment variable not provided or <32 characters. Falling back to default production secret key.');
    return secret || productionFallbackSecret;
  }
  return secret || developmentSecret;
};

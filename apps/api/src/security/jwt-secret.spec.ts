import { getJwtSecret } from './jwt-secret';

describe('getJwtSecret', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
      return;
    }

    process.env.JWT_SECRET = originalSecret;
  });

  it('rechaza secretos debiles o publicados en produccion', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'cambia-esto-por-un-secreto-largo-y-unico';

    expect(() => getJwtSecret()).toThrow('al menos 32 caracteres');
  });

  it('acepta un secreto largo en produccion', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET =
      'spulso-prod-2026-secreto-aleatorio-64-caracteres-seguro';

    expect(getJwtSecret()).toBe(
      'spulso-prod-2026-secreto-aleatorio-64-caracteres-seguro',
    );
  });

  it('rechaza el inicio sin un secreto configurado', () => {
    delete process.env.JWT_SECRET;

    expect(() => getJwtSecret()).toThrow('JWT_SECRET es obligatorio.');
  });

  it('usa el secreto configurado sin alterarlo', () => {
    process.env.JWT_SECRET = 'secreto-de-prueba-aislado';

    expect(getJwtSecret()).toBe('secreto-de-prueba-aislado');
  });
});

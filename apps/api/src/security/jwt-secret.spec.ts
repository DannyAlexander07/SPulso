import { getJwtSecret } from './jwt-secret';

describe('getJwtSecret', () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
      return;
    }

    process.env.JWT_SECRET = originalSecret;
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

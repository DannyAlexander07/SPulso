import { resolve } from 'path';
import { resolveLocalDocumentUploadPath } from './documents.service';

describe('resolveLocalDocumentUploadPath', () => {
  const workingDirectory = resolve('spulso-test-root');

  it('resuelve un documento dentro del directorio permitido', () => {
    expect(
      resolveLocalDocumentUploadPath(
        '/uploads/documentos/archivo.pdf',
        workingDirectory,
      ),
    ).toBe(resolve(workingDirectory, 'uploads', 'documentos', 'archivo.pdf'));
  });

  it('rechaza traversal y directorios hermanos con prefijo parecido', () => {
    expect(
      resolveLocalDocumentUploadPath(
        '/uploads/documentos/../../uploads-secret/archivo.pdf',
        workingDirectory,
      ),
    ).toBeNull();
    expect(
      resolveLocalDocumentUploadPath(
        '/uploads/documentos/../../../secreto.txt',
        workingDirectory,
      ),
    ).toBeNull();
  });
});

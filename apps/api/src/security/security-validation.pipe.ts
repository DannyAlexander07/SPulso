import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';

const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
const maxDepth = Number(process.env.MAX_PAYLOAD_DEPTH ?? 8);
const maxArrayItems = Number(process.env.MAX_ARRAY_ITEMS ?? 300);
const maxStringLength = Number(process.env.MAX_STRING_LENGTH ?? 5000);
const maxSearchStringLength = Number(
  process.env.MAX_SEARCH_STRING_LENGTH ?? 160,
);

@Injectable()
export class SecurityValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!['body', 'query', 'param'].includes(metadata.type)) {
      return value;
    }

    return sanitizeValue(value, 0, metadata.type);
  }
}

function sanitizeValue(
  value: unknown,
  depth: number,
  source: ArgumentMetadata['type'],
): unknown {
  if (depth > maxDepth) {
    throw new BadRequestException(
      'La solicitud tiene demasiados niveles de datos.',
    );
  }

  if (typeof value === 'string') {
    return sanitizeString(value, source);
  }

  if (Array.isArray(value)) {
    if (value.length > maxArrayItems) {
      throw new BadRequestException(
        'La solicitud contiene demasiados elementos.',
      );
    }

    return value.map((item) => sanitizeValue(item, depth + 1, source));
  }

  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(value)) {
      if (blockedKeys.has(key)) {
        throw new BadRequestException(
          'La solicitud contiene claves no permitidas.',
        );
      }

      sanitized[key] = sanitizeValue(childValue, depth + 1, source);
    }

    return sanitized;
  }

  return value;
}

function sanitizeString(value: string, source: ArgumentMetadata['type']) {
  const normalized = value.trim();
  const limit =
    source === 'query' || source === 'param'
      ? maxSearchStringLength
      : maxStringLength;

  if (normalized.length > limit) {
    throw new BadRequestException(
      'La solicitud contiene texto demasiado largo.',
    );
  }

  if (hasBlockedControlCharacter(normalized)) {
    throw new BadRequestException(
      'La solicitud contiene caracteres no permitidos.',
    );
  }

  return normalized;
}

function hasBlockedControlCharacter(value: string) {
  for (const character of value) {
    const code = character.charCodeAt(0);

    if (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      return true;
    }
  }

  return false;
}

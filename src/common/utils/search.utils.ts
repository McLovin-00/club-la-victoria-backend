import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

export interface SearchField {
  column: string;
  useUnaccent?: boolean;
}

export const DEFAULT_SOCIO_SEARCH_FIELDS: SearchField[] = [
  { column: 'nombre', useUnaccent: true },
  { column: 'apellido', useUnaccent: true },
  { column: 'dni', useUnaccent: false },
  { column: 'email', useUnaccent: true },
];

export const SOCIO_NAME_SEARCH_FIELDS: SearchField[] = [
  { column: 'nombre', useUnaccent: true },
  { column: 'apellido', useUnaccent: true },
];

export const SOCIO_NAME_DNI_SEARCH_FIELDS: SearchField[] = [
  { column: 'nombre', useUnaccent: true },
  { column: 'apellido', useUnaccent: true },
  { column: 'dni', useUnaccent: false },
];

export function applyMultiWordSearch<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  search: string,
  fields: SearchField[],
  paramPrefix: string = 'sw',
): void {
  if (!search || !search.trim()) return;

  const words = search
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return;

  words.forEach((word, wordIndex) => {
    const paramName = `${paramPrefix}${wordIndex}`;
    const conditions = fields.map((field) => {
      if (field.useUnaccent) {
        return `unaccent(${field.column}) ILIKE unaccent(:${paramName})`;
      }
      return `${field.column} ILIKE :${paramName}`;
    });

    queryBuilder.andWhere(`(${conditions.join(' OR ')})`, {
      [paramName]: `%${word}%`,
    });
  });
}

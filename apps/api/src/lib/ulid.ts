/**
 * ULID generator — wraps the `ulid` package
 */
import { ulid as generateUlidImpl } from 'ulid';

export function generateUlid(): string {
  return generateUlidImpl();
}

export { generateUlidImpl as ulid };

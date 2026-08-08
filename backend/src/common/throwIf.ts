export function throwIfAllEqual<E extends new (...args: any[]) => Error, T>(
  fields: T[],
  ExceptionClass: E,
  errMsg: string
): void {
  if (fields.length > 1 && fields.every((field) => field === fields[0])) {
    throw new ExceptionClass(errMsg);
  }
}

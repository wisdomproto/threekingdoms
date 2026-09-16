export function cloneItemCatalog(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('아이템 목록은 객체여야 합니다.');
  for (const row of Object.values(value)) if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('각 아이템은 객체여야 합니다.');
  return structuredClone(value);
}
export function serializeItemCatalog(data, order) {
  const result = Object.fromEntries(order.map(id => [id, structuredClone(data[id])]));
  for (const item of Object.values(result)) delete item._effErr;
  return JSON.stringify(result, null, 2) + '\n';
}

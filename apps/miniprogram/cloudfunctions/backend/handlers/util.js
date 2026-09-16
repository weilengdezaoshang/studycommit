/** 转发辅助：查询串构造与路径参数校验。 */

function buildQuery(path, payload) {
  if (!payload || typeof payload !== 'object') {
    return path
  }
  const query = Object.entries(payload)
    .filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return query ? `${path}?${query}` : path
}

function pathSegment(payload, key) {
  const value = payload ? payload[key] : undefined
  if (typeof value !== 'string' || !value || value.includes('/')) {
    const { BackendError } = require('../errors')
    throw new BackendError('INVALID_INPUT', `缺少参数 ${key}`)
  }
  return encodeURIComponent(value)
}

module.exports = { buildQuery, pathSegment }

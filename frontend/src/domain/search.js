export function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function fuzzyIncludes(value, query) {
  if (query.length < 4) return false
  return value.split(/\s+/).some((word) => levenshteinDistance(word, query) <= 1)
}

export function personMatchesSearch(person, query, extraFields = []) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return false
  return personSearchFields(person, extraFields).some((value) => {
    const normalizedValue = normalizeSearchText(value)
    return normalizedValue.includes(normalizedQuery) || fuzzyIncludes(normalizedValue, normalizedQuery)
  })
}

export function personSearchFields(person, extraFields = []) {
  return [
    person?.name,
    person?.nickname,
    ...(person?.nicknames || []),
    ...extraFields.map((field) => person?.[field]),
  ].filter(Boolean)
}

function levenshteinDistance(left, right) {
  if (!left || !right) return Math.max(left.length, right.length)
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0]
    previous[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex]
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
      diagonal = above
    }
  }
  return previous[right.length]
}

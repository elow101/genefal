export const defaultCooptageRole = Object.freeze({ id: 'tva', label: 'TVA' })

export function roleOptionsForGenealogy(genealogies, genealogy) {
  const regions = relatedRegions(genealogies, genealogy)
  return uniqueRoles([
    defaultCooptageRole,
    ...regions.flatMap((region) => region.customRoles || []),
  ])
}

export function cooptageRoleForRegion(region) {
  const roles = uniqueRoles([defaultCooptageRole, ...(region?.customRoles || [])])
  return roles.find((role) => role.id === (region?.cooptageRoleId || 'tva')) || defaultCooptageRole
}

export function roleLabel(roleId, genealogies, genealogy) {
  return roleOptionsForGenealogy(genealogies, genealogy).find((role) => role.id === roleId)?.label || labelFromId(roleId)
}

function normaliseRoleId(label = '') {
  return String(label)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function uniqueRoleId(label, existingRoles = []) {
  const used = new Set(existingRoles.map((role) => role.id))
  const base = normaliseRoleId(label) || 'role'
  let candidate = base
  let index = 2
  while (used.has(candidate)) {
    candidate = `${base}-${index}`
    index += 1
  }
  return candidate
}

function relatedRegions(genealogies, genealogy) {
  const regions = genealogies.filter((item) => item.type === 'region')
  if (!genealogy || genealogy.type === 'national') return regions
  if (genealogy.type === 'region') return [genealogy]
  return regions.filter((region) => region.id === genealogy.parentId)
}

function uniqueRoles(roles) {
  const byId = new Map()
  roles.forEach((role) => {
    if (!role?.id || !role?.label || byId.has(role.id)) return
    byId.set(role.id, { id: role.id, label: role.label })
  })
  return [...byId.values()]
}

function labelFromId(roleId = '') {
  return String(roleId)
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

import { describe, expect, it } from 'vitest'
import { filiereAccent, filiereLabel, normaliseFiliereId } from './filiere.js'

describe('filiere aliases', () => {
  it('keeps legacy filiere ids colored in graph views', () => {
    expect(normaliseFiliereId('sciences-general')).toBe('sciences')
    expect(normaliseFiliereId('paramedical-kinesitherapie')).toBe('paramedical')
    expect(normaliseFiliereId('economie-comptabilite')).toBe('sciences-economiques-gestion-iae')
    expect(filiereLabel('enseignement-2nd-degre')).toBe('MEEF 2nd degré')
    expect(filiereAccent('psychologie')).toBe('#f3d33b')
  })
})

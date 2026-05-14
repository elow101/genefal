export async function fetchGenealogyState() {
  const response = await fetch('/api/genealogy.php')

  if (!response.ok) {
    throw new Error('Impossible de charger les donnees')
  }

  return response.json()
}

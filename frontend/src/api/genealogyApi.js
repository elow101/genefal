export async function fetchGenealogyState() {
  const response = await fetch('/api/genealogy.php', {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Impossible de charger les données')
  }

  return response.json()
}

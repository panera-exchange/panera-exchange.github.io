// Categorie degli item: i tab dell'inventario della modalità creativa, con i nomi della versione italiana.
// I valori sono quelli della colonna items.category. Le uova generatrici non ci sono: non sono nel catalogo.
export const CATEGORIES = [
  { value: 'building', label: 'Blocchi da costruzione' },
  { value: 'colored', label: 'Blocchi colorati' },
  { value: 'natural', label: 'Blocchi naturali' },
  { value: 'functional', label: 'Blocchi funzionali' },
  { value: 'redstone', label: 'Redstone' },
  { value: 'tools', label: 'Strumenti e utilità' },
  { value: 'combat', label: 'Combattimento' },
  { value: 'food', label: 'Cibi e bevande' },
  { value: 'ingredients', label: 'Ingredienti' },
] as const

export type Category = (typeof CATEGORIES)[number]['value']

export const categoryLabel = (value: Category): string => CATEGORIES.find((c) => c.value === value)?.label ?? value

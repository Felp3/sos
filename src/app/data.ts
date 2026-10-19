export type Animal = {
  id: string
  name: string
  species: "Cachorro" | "Gato"
  breed: string
  age: string
  gender: "Macho" | "Fêmea"
  size: "Pequeno" | "Médio" | "Grande"
  city: string
  image: string
  vaccinated: boolean
  neutered: boolean
}

export const initialAnimals: Animal[] = [
  {
    id: "pet-1",
    name: "Mel",
    species: "Cachorro",
    breed: "SRD",
    age: "2 anos",
    gender: "Fêmea",
    size: "Médio",
    city: "São Paulo, SP",
    image:
      "https://images.unsplash.com/photo-1602308006427-f1c718609718?auto=format&fit=crop&w=800&q=85",
    vaccinated: true,
    neutered: true,
  },
  {
    id: "pet-2",
    name: "Bidu",
    species: "Gato",
    breed: "Siamês",
    age: "1 ano",
    gender: "Macho",
    size: "Pequeno",
    city: "Campinas, SP",
    image:
      "https://images.unsplash.com/photo-1594387992816-65f5d74c1de0?auto=format&fit=crop&w=800&q=85",
    vaccinated: true,
    neutered: false,
  },
  {
    id: "pet-3",
    name: "Luna",
    species: "Cachorro",
    breed: "Beagle",
    age: "3 anos",
    gender: "Fêmea",
    size: "Médio",
    city: "Osasco, SP",
    image:
      "https://images.unsplash.com/photo-1658337921250-10578c1372fa?auto=format&fit=crop&w=800&q=85",
    vaccinated: true,
    neutered: true,
  },
  {
    id: "pet-4",
    name: "Thor",
    species: "Cachorro",
    breed: "Labrador",
    age: "4 anos",
    gender: "Macho",
    size: "Grande",
    city: "Santo André, SP",
    image:
      "https://images.unsplash.com/photo-1724367281416-cf18867ad712?auto=format&fit=crop&w=800&q=85",
    vaccinated: true,
    neutered: true,
  },
  {
    id: "pet-5",
    name: "Mimi",
    species: "Gato",
    breed: "SRD",
    age: "8 meses",
    gender: "Fêmea",
    size: "Pequeno",
    city: "São Paulo, SP",
    image:
      "https://images.unsplash.com/photo-1598050380294-2f6a8d469282?auto=format&fit=crop&w=800&q=85",
    vaccinated: true,
    neutered: false,
  },
  {
    id: "pet-6",
    name: "Pipoca",
    species: "Gato",
    breed: "SRD",
    age: "2 anos",
    gender: "Macho",
    size: "Pequeno",
    city: "Guarulhos, SP",
    image:
      "https://images.unsplash.com/photo-1652908452131-311e865e806b?auto=format&fit=crop&w=800&q=85",
    vaccinated: true,
    neutered: true,
  },
]

const STORAGE_KEY = "sos-patinhas-animals"

export function getAnimals() {
  if (typeof localStorage === "undefined") return initialAnimals
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return initialAnimals

  try {
    return JSON.parse(saved) as Animal[]
  } catch {
    return initialAnimals
  }
}

export function saveAnimal(animal: Animal) {
  const animals = [animal, ...getAnimals()]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(animals))
  return animals
}

export async function loadAnimals() {
  const response = await fetch("/api/pets")
  if (!response.ok) throw new Error("Não foi possível carregar os pets.")
  const result: unknown = await response.json()
  if (
    typeof result !== "object" ||
    result === null ||
    !("data" in result) ||
    !Array.isArray(result.data)
  ) {
    throw new Error("A resposta da API de pets é inválida.")
  }
  return result.data as Animal[]
}

export async function createAnimal(animal: Animal) {
  const token = localStorage.getItem("sos-patinhas-token")
  const image = animal.image.startsWith("blob:")
    ? "https://images.unsplash.com/photo-1509205477838-a534e43a849f?auto=format&fit=crop&w=800&q=85"
    : animal.image
  const response = await fetch("/api/pets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...animal, image }),
  })
  if (!response.ok) {
    const result: unknown = await response.json()
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "Não foi possível cadastrar o pet."
    throw new Error(message)
  }
  return (await response.json()) as Animal
}

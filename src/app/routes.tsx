import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Eye,
  FilePlus2,
  HandHeart,
  Heart,
  Home,
  LockKeyhole,
  LogIn,
  Mail,
  MapPin,
  Menu,
  PawPrint,
  Plus,
  Search,
  ShieldAlert,
  UploadCloud,
  User,
  UserPlus,
  X,
} from "lucide-react"
import {
  createBrowserRouter,
  Link,
  NavLink,
  Outlet,
  useNavigate,
} from "react-router"
import type { Animal } from "./data"

const accent = "#8bea52"

const AUTH_TOKEN_KEY = "sos-patinhas-token"
const AUTH_USERS_KEY = "sos-patinhas-users"
const AUTH_SESSION_KEY = "sos-patinhas-session"

async function loadAnimals(): Promise<Animal[]> {
  const response = await fetch("/api/pets")
  if (!response.ok) {
    throw new Error("Não foi possível carregar os pets.")
  }
  
  const result: any = await response.json()
  const animals = result.data
  if (!animals) throw new Error("Resposta inválida da API de animais.")
  return animals as Animal[]
}

async function createAnimal(
  animal: Animal & { description: string },
): Promise<void> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const imageData = animal.image.startsWith("blob:")
    ? await fetch(animal.image)
        .then((response) => {
          if (!response.ok) throw new Error("Não foi possível carregar a imagem.")
          return response.blob()
        })
        .then(async (blob) => {
          try {
            const bitmap = await createImageBitmap(blob)
            const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height))
            const canvas = document.createElement("canvas")
            canvas.width = Math.max(1, Math.round(bitmap.width * scale))
            canvas.height = Math.max(1, Math.round(bitmap.height * scale))
            const context = canvas.getContext("2d")
            if (!context) throw new Error()
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
            bitmap.close()
            return canvas.toDataURL("image/jpeg", 0.6)
          } catch {
            throw new Error("Não foi possível converter a imagem.")
          }
        })
    : animal.image
  const response = await fetch("/api/pets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...animal, imageData, city: animal.city.split(", ")[0] || "Desconhecida", state: animal.city?.split(", ")?.[1] || "Desconhecido", size: undefined, vaccinated: undefined, neutered: undefined, image: undefined}),
  })
  if (!response.ok) {
    const result: unknown = await response.json().catch(() => null)
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "Não foi possível cadastrar o pet."
    throw new Error(message)
  }
}

type Donation = {
  id?: string | number
  type?: string
  amount?: number | string
  createdAt?: string
  created_at?: string
  date?: string
  name?: string
  donorName?: string
  user?: { name?: string }
}

async function loadDonations(): Promise<Donation[]> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const response = await fetch("/api/donations", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error("Não foi possível carregar as doações.")

  const result: any = await response.json()
  const donations = result.data
  if (!donations) throw new Error("Resposta inválida da API de doações.")
  return donations as Donation[]
}

function donationAmount(donation: Donation): number {
  const amount = Number(donation.amount)
  return Number.isFinite(amount) ? amount : 0
}

function donationDate(donation: Donation): Date | null {
  const value = donation.createdAt ?? donation.created_at ?? donation.date
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isFinancialDonation(donation: Donation): boolean {
  return !donation.type || donation.type.toUpperCase() === "FINANCIAL"
}

if (typeof localStorage !== "undefined") localStorage.removeItem(AUTH_USERS_KEY)

type AuthSession = {
  name: string
  email: string
}

function getAuthSession(): AuthSession | null {
  try {
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) {
      localStorage.removeItem(AUTH_SESSION_KEY)
      return null
    }
    return JSON.parse(
      localStorage.getItem(AUTH_SESSION_KEY) ?? "null",
    ) as AuthSession | null
  } catch {
    return null
  }
}

async function authApi(
  path: "/api/auth/login" | "/api/auth/register",
  data: Record<string, string>,
) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) return { ok: false, status: response.status }

  const result: unknown = await response.json()
  if (
    typeof result !== "object" ||
    result === null ||
    !("token" in result) ||
    typeof result.token !== "string" ||
    !("user" in result) ||
    typeof result.user !== "object" ||
    result.user === null ||
    !("name" in result.user) ||
    typeof result.user.name !== "string" ||
    !("email" in result.user) ||
    typeof result.user.email !== "string"
  ) {
    throw new Error("Resposta inválida da API de autenticação.")
  }

  localStorage.setItem(AUTH_TOKEN_KEY, result.token)
  localStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({ name: result.user.name, email: result.user.email }),
  )
  return { ok: true, status: response.status }
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3">
      <PawPrint
        size={compact ? 29 : 35}
        fill={accent}
        className="text-[#8bea52]"
      />
      <span className="font-display font-extrabold leading-[1] tracking-wide text-[#8bea52]">
        <span className="block text-xl">Sos</span>
        <span className="block text-sm">Patinhas</span>
      </span>
    </Link>
  )
}

const navigation = [
  { to: "/", label: "Início", Icon: Home },
  { to: "/adocao", label: "Adoção", Icon: Heart },
  { to: "/adicionar-novo", label: "Adicionar novo", Icon: Plus },
  { to: "/doacao", label: "Doação", Icon: CircleDollarSign },
  { to: "/relatorios/doacoes", label: "Relatórios", Icon: BarChart3 },
  { to: "/sobre", label: "Sobre", Icon: HandHeart },
]

function AppLayout() {
  const [session, setSession] = useState(getAuthSession)

  return (
    <div className="min-h-screen bg-[#06161b] text-[#f4f8f3]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] border-r border-[#20353b] bg-[#08191e] px-5 py-7 lg:flex lg:flex-col">
        <Brand />
        <nav className="mt-12 space-y-2">
          {navigation.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#8bea52] text-[#07171c]"
                    : "text-[#a7b8b3] hover:bg-[#10272d] hover:text-white"
                }`
              }
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-[#294047] bg-[#0d2227] p-4">
          <p className="text-xs font-bold text-[#8bea52]">Precisa de ajuda?</p>
          <p className="mt-1 text-xs leading-5 text-[#91a49f]">
            Nossa equipe está disponível para orientar você.
          </p>
          <button className="mt-3 text-xs font-bold text-white">
            Falar com suporte
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#20353b] bg-[#07171c]/90 px-5 backdrop-blur-xl md:px-8">
          <div className="lg:hidden">
            <Brand compact />
          </div>
          <div className="hidden lg:block">
            <p className="text-xs text-[#7e938d]">
              Plataforma de cuidado animal
            </p>
            <p className="text-sm font-bold">Bem-vindo à Sos Patinhas</p>
          </div>
          <div className="flex items-center gap-2">
            {session ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="hidden text-[#a7b8b3] sm:inline">
                  Olá, {session.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(AUTH_SESSION_KEY)
                    localStorage.removeItem(AUTH_TOKEN_KEY)
                    setSession(null)
                  }}
                  className="rounded-xl border border-[#294047] px-4 py-2.5 font-semibold"
                >
                  Sair
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden items-center gap-2 rounded-xl border border-[#294047] px-4 py-2.5 text-sm font-semibold sm:flex"
              >
                <User size={17} /> Minha conta
              </Link>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1180px] px-5 py-8 pb-28 md:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[72px] items-center justify-around border-t border-[#20353b] bg-[#07191e]/95 px-2 backdrop-blur lg:hidden">
        {navigation.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex min-w-14 flex-col items-center gap-1 text-[10px] font-semibold ${
                isActive ? "text-[#8bea52]" : "text-[#9aaba6]"
              }`
            }
          >
            <Icon size={20} />
            <span>{label === "Adicionar novo" ? "Adicionar" : label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#8bea52]">
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl font-bold tracking-[-.035em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#91a49f]">
          {description}
        </p>
      </div>
      {action}
    </div>
  )
}

function HomePage() {
  const [animals, setAnimals] = useState<Animal[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    loadAnimals()
      .then(setAnimals)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar os pets.",
        ),
      )
    loadDonations()
      .then(setDonations)
      .catch((reason: unknown) =>
        setError((current) => current || (reason instanceof Error ? reason.message : "Não foi possível carregar as doações.")),
      )
  }, [])

  const financialDonations = donations.filter(isFinancialDonation)
  const totalDonated = financialDonations.reduce(
    (total, donation) => total + donationAmount(donation),
    0,
  )

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Cuidar também é conectar."
        description="Acompanhe os animais, adoções e contribuições da comunidade Sos Patinhas."
        action={
          <Link to="/adicionar-novo" className="primary-button">
            <Plus size={18} /> Adicionar animal
          </Link>
        }
      />
      {error && (
        <p role="alert" className="mb-5 text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Animais disponíveis", animals.length, PawPrint],
          ["Doações registradas", donations.length, FilePlus2],
          ["Doações financeiras", financialDonations.length, Heart],
          ["Total arrecadado", totalDonated.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), CircleDollarSign],
        ].map(([label, value, Icon]) => {
          const CardIcon = Icon as typeof Heart
          return (
            <div key={label as string} className="panel p-5">
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#183327] text-[#8bea52]">
                  <CardIcon size={21} />
                </span>
                <span className="text-xs font-bold text-[#8bea52]">API</span>
              </div>
              <p className="mt-7 text-xs text-[#91a49f]">{label as string}</p>
              <strong className="mt-1 block font-display text-3xl">
                {value as string | number}
              </strong>
            </div>
          )
        })}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_.6fr]">
        <div className="panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Recém-chegados</h2>
            <Link to="/adocao" className="text-xs font-bold text-[#8bea52]">
              Ver todos
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {animals.slice(0, 3).map((animal) => (
              <div key={animal.id}>
                <img
                  src={(animal as any).imageData}
                  alt={animal.name}
                  className="aspect-[4/3] w-full rounded-2xl object-cover"
                />
                <p className="mt-2 font-bold">{animal.name}</p>
                <p className="text-xs text-[#829690]">
                  {animal.breed} · {animal.age} · {animal.city}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="panel relative overflow-hidden p-6">
          <div className="absolute -right-12 -top-12 size-40 rounded-full bg-[#8bea52]/10" />
          <HandHeart className="text-[#8bea52]" size={34} />
          <h2 className="mt-7 font-display text-2xl font-bold">
            Cada ajuda conta.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#91a49f]">
            Contribua com alimentação, vacinas e cuidados veterinários.
          </p>
          <Link
            to="/doacao"
            className="primary-button mt-6 w-full justify-center"
          >
            Quero ajudar
          </Link>
        </div>
      </div>
    </>
  )
}

function AboutPage() {
  return (
    <>
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-[#294047] bg-[#0d2227] px-6 py-12 sm:px-10 sm:py-16">
        <div className="absolute -right-16 -top-20 size-72 rounded-full bg-[#8bea52]/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[#8bea52]">
            Sobre a Sos Patinhas
          </p>
          <h1 className="font-display text-4xl font-bold tracking-[-.035em] sm:text-5xl">
            Mais encontros. Mais cuidado. Mais lares.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#b4c2bd]">
            A Sos Patinhas é um projeto criado para aproximar animais que
            precisam de um lar das pessoas dispostas a acolher, cuidar e ajudar.
            Queremos tornar a adoção responsável e a solidariedade mais simples
            e acessíveis.
          </p>
          <Link to="/adocao" className="primary-button mt-7">
            <Heart size={18} /> Conheça os animais
          </Link>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <article className="panel p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#183327] text-[#8bea52]">
            <PawPrint size={24} />
          </span>
          <h2 className="mt-5 font-display text-xl font-bold">
            Facilitar a adoção
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#91a49f]">
            Reunimos informações dos animais em um só lugar para ajudar cada
            pessoa a encontrar um companheiro e dar o primeiro passo para uma
            adoção consciente.
          </p>
        </article>
        <article className="panel p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#183327] text-[#8bea52]">
            <HandHeart size={24} />
          </span>
          <h2 className="mt-5 font-display text-xl font-bold">
            Apoiar quem cuida
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#91a49f]">
            Voluntários e pessoas que acolhem animais podem divulgar perfis e
            mobilizar a comunidade para contribuir com alimentação, tratamentos
            e outros cuidados.
          </p>
        </article>
        <article className="panel p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#183327] text-[#8bea52]">
            <Eye size={24} />
          </span>
          <h2 className="mt-5 font-display text-xl font-bold">
            Incentivar a transparência
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#91a49f]">
            Acreditamos que a confiança também faz parte do cuidado. Por isso, o
            projeto prevê o acompanhamento e a prestação de contas das
            contribuições recebidas.
          </p>
        </article>
      </section>

      <section className="panel mt-6 flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#8bea52]">
            Faça parte dessa rede
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold">
            Toda atitude pode mudar uma história.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#91a49f]">
            Adote, divulgue, cadastre um animal ou contribua. Cada gesto ajuda a
            construir um caminho mais seguro e acolhedor para eles.
          </p>
        </div>
        <Link to="/doacao" className="secondary-button shrink-0">
          <HandHeart size={18} /> Quero ajudar
        </Link>
      </section>
    </>
  )
}

function AdoptionPage() {
  const [animals, setAnimals] = useState<Animal[]>([])
  const [search, setSearch] = useState("")
  const [species, setSpecies] = useState("Todos")
  const [error, setError] = useState("")

  useEffect(() => {
    loadAnimals()
      .then(setAnimals)
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar os pets.",
        )
      })
  }, [])

  const filtered = useMemo(
    () =>
      animals.filter((animal) => {
        const matchesSpecies = species === "Todos" || animal.species === species
        const haystack =
          `${animal.name} ${animal.breed} ${animal.city}`.toLowerCase()
        return matchesSpecies && haystack.includes(search.toLowerCase())
      }),
    [animals, search, species],
  )

  return (
    <>
      <PageHeader
        eyebrow="Adoção responsável"
        title="Encontre um novo amigo"
        description="Os animais desta página são carregados pela camada de dados da Sos Patinhas e estão prontos para receber carinho."
      />
      {error && (
        <p role="alert" className="mb-5 text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="panel mb-6 flex flex-col gap-3 p-3 md:flex-row">
        <label className="field flex-1 !py-3">
          <Search size={18} className="text-[#789089]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, raça ou cidade"
          />
        </label>
        <div className="flex gap-2">
          {["Todos", "Cachorro", "Gato"].map((item) => (
            <button
              key={item}
              onClick={() => setSpecies(item)}
              className={`rounded-xl px-4 py-3 text-xs font-bold ${
                species === item
                  ? "bg-[#8bea52] text-[#07171c]"
                  : "bg-[#10262c] text-[#a8b8b4]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((animal) => (
          <article key={animal.id} className="panel group overflow-hidden">
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src={(animal as any).imageData}
                alt={animal.name}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute left-4 top-4 rounded-full bg-[#07171c]/80 px-3 py-1.5 text-[10px] font-bold text-[#8bea52] backdrop-blur">
                Disponível
              </span>
              <button className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-[#07171c]/80 text-white backdrop-blur">
                <Heart size={17} />
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold">
                    {animal.name}
                  </h2>
                  <p className="mt-1 text-sm text-[#91a49f]">
                    {animal.breed} · {animal.age}
                  </p>
                </div>
                <span className="rounded-full bg-[#173126] px-3 py-1 text-[10px] font-bold text-[#8bea52]">
                  {animal.gender}
                </span>
              </div>
              <div className="my-4 flex items-center gap-1.5 border-y border-[#21373d] py-3 text-xs text-[#8da09b]">
                <MapPin size={14} className="text-[#8bea52]" /> {animal.city}
              </div>
              <div className="flex gap-2">
                {animal.vaccinated && (
                  <span className="pet-tag">
                    <Check size={12} /> Vacinado
                  </span>
                )}
                {animal.neutered && (
                  <span className="pet-tag">
                    <Check size={12} /> Castrado
                  </span>
                )}
              </div>
              <button className="secondary-button mt-5 w-full justify-center">
                Quero conhecer
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

function AddAnimalPage() {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError("")
    setIsLoading(true)
    try {
      await createAnimal({
        id: crypto.randomUUID(),
        name: String(form.get("name")),
        species: String(form.get("species")) as Animal["species"],
        breed: String(form.get("breed") || "SRD"),
        age: String(form.get("age")),
        gender: String(form.get("gender")) as Animal["gender"],
        size: String(form.get("size")) as Animal["size"],
        city: String(form.get("city")),
        description: String(form.get("description") || ""),
        image:
          preview ||
          "https://images.unsplash.com/photo-1509205477838-a534e43a849f?auto=format&fit=crop&w=800&q=85",
        vaccinated: form.get("vaccinated") === "on",
        neutered: form.get("neutered") === "on",
      })
      setSaved(true)
      setTimeout(() => navigate("/adocao"), 900)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível cadastrar o pet.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Novo perfil"
        title="Adicionar novo animal"
        description="Cadastre um animal para que ele apareça na página de adoção."
      />
      <form onSubmit={submit} className="panel mx-auto max-w-4xl p-5 sm:p-7">
        <section>
          <h2 className="form-section-title">Fotos do animal</h2>
          <label className="upload-area">
            {preview ? (
              <img
                src={preview}
                alt="Prévia do animal"
                className="h-44 w-full rounded-2xl object-cover sm:h-56"
              />
            ) : (
              <>
                <UploadCloud size={34} className="text-[#8bea52]" />
                <strong>Selecione uma foto</strong>
                <span>JPG ou PNG, máximo de 5 MB</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) setPreview(URL.createObjectURL(file))
              }}
            />
          </label>
        </section>
        <section className="mt-8">
          <h2 className="form-section-title">Informações gerais</h2>
          <div className="form-grid">
            <Field
              label="Nome do animal"
              name="name"
              placeholder="Ex: Mel"
              required
            />
            <SelectField
              label="Espécie"
              name="species"
              options={["Cachorro", "Gato"]}
            />
            <Field label="Raça" name="breed" placeholder="Ex: SRD" />
            <Field
              label="Idade estimada"
              name="age"
              placeholder="Ex: 2 anos"
              required
            />
            <SelectField
              label="Sexo"
              name="gender"
              options={["Macho", "Fêmea"]}
            />
            <SelectField
              label="Porte"
              name="size"
              options={["Pequeno", "Médio", "Grande"]}
            />
            <Field
              label="Cidade / UF"
              name="city"
              placeholder="Ex: São Paulo, SP"
              required
              wide
            />
            <label className="block sm:col-span-2">
              <span className="label">Descrição do animal</span>
              <span className="field">
                <textarea
                  name="description"
                  placeholder="Conte um pouco sobre a personalidade e a história do pet."
                  rows={4}
                  className="w-full resize-y bg-transparent outline-none"
                />
              </span>
            </label>
          </div>
        </section>
        <section className="mt-8">
          <h2 className="form-section-title">Estado de saúde</h2>
          <div className="flex flex-wrap gap-5">
            <CheckField name="vaccinated" label="Vacinado(a)" />
            <CheckField name="neutered" label="Castrado(a)" />
            <CheckField name="dewormed" label="Vermifugado(a)" />
          </div>
        </section>
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#21373d] pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="secondary-button justify-center"
          >
            Cancelar
          </button>
          {error && (
            <p
              role="alert"
              className="text-sm text-red-400 sm:mr-auto sm:self-center"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="primary-button justify-center disabled:opacity-60"
          >
            {saved ? (
              <>
                <Check size={18} /> Animal cadastrado
              </>
            ) : (
              <>
                <Plus size={18} />{" "}
                {isLoading ? "Salvando..." : "Salvar cadastro"}
              </>
            )}
          </button>
        </div>
      </form>
    </>
  )
}

function DonationPage() {
  const [amount, setAmount] = useState("50")
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function submitDonation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDone(false)
    setError("")
    const value = Number(amount.trim().replace(",", "."))
    if (!Number.isFinite(value) || value <= 0) {
      setError("Informe um valor de doação válido.")
      return
    }

    setIsLoading(true)
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY)
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: "FINANCIAL", amount: value }),
      })
      if (!response.ok) {
        const result: unknown = await response.json()
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Não foi possível registrar a doação."
        throw new Error(message)
      }
      setDone(true)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a doação.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Faça parte"
        title="Sua doação vira cuidado"
        description="Ajude a custear alimentação, medicamentos, resgates e atendimento veterinário."
      />
      <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
        <div className="panel overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1509205477838-a534e43a849f?auto=format&fit=crop&w=1000&q=85"
            alt="Cachorro e gato juntos"
            className="h-64 w-full object-cover"
          />
          <div className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-[#8bea52]">
              Transparência
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">
              Você acompanha cada impacto.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#91a49f]">
              Publicamos relatórios periódicos para mostrar como cada
              contribuição foi utilizada.
            </p>
            <Link
              to="/relatorios/doacoes"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#8bea52]"
            >
              Ver relatório de doações <BarChart3 size={17} />
            </Link>
          </div>
        </div>
        <form className="panel p-6 sm:p-8" onSubmit={submitDonation}>
          <h2 className="font-display text-2xl font-bold">
            Escolha como ajudar
          </h2>
          <p className="mt-2 text-sm text-[#91a49f]">
            Registre sua contribuição para apoiar os cuidados dos animais.
          </p>
          <div className="mt-7 grid grid-cols-3 gap-3">
            {["25", "50", "100"].map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setAmount(value)}
                className={`rounded-2xl border py-4 text-sm font-bold ${
                  amount === value
                    ? "border-[#8bea52] bg-[#173126] text-[#8bea52]"
                    : "border-[#294047] bg-[#0a1c21]"
                }`}
              >
                R$ {value}
              </button>
            ))}
          </div>
          <label className="label mt-6">Outro valor</label>
          <div className="field">
            <span className="font-bold text-[#8bea52]">R$</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
            />
          </div>
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="primary-button mt-6 w-full justify-center"
          >
            {done ? (
              <>
                <Check size={18} /> Doação registrada
              </>
            ) : (
              <>
                <Heart size={18} />{" "}
                {isLoading ? "Registrando..." : `Doar R$ ${amount}`}
              </>
            )}
          </button>
          <p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#789089]">
            <LockKeyhole size={13} /> Ambiente seguro e dados protegidos
          </p>
        </form>
      </div>
    </>
  )
}

function ReportsPage() {
  const chart = [46, 62, 54, 71, 63, 82]
  return (
    <>
      <PageHeader
        eyebrow="Transparência"
        title="Relatório de doações"
        description="Acompanhe os recursos recebidos e o impacto gerado pela nossa comunidade."
        action={
          <button className="secondary-button">
            <CalendarDays size={17} /> Jan — Jun 2026 <ChevronDown size={15} />
          </button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total arrecadado", "R$ 24.680,50", "+16%"],
          ["Doações financeiras", "R$ 19.450,00", "79% do total"],
          ["Doações materiais", "R$ 5.230,50", "21% do total"],
          ["Total de doações", "312", "+27%"],
        ].map(([label, value, change]) => (
          <div key={label} className="panel p-5">
            <p className="text-xs text-[#91a49f]">{label}</p>
            <strong className="mt-3 block font-display text-2xl">
              {value}
            </strong>
            <p className="mt-3 text-xs font-bold text-[#8bea52]">{change}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
        <div className="panel p-6">
          <h2 className="font-display text-xl font-bold">
            Doações financeiras por mês
          </h2>
          <div className="mt-8 flex h-64 items-end justify-between gap-3 border-b border-[#31474c] px-2">
            {chart.map((height, index) => (
              <div
                key={index}
                className="flex h-full flex-1 flex-col items-center justify-end gap-3"
              >
                <div
                  className="w-full max-w-14 rounded-t-lg border border-[#a8f17f] bg-gradient-to-t from-[#2f6f35] to-[#8bea52]"
                  style={{ height: `${height}%` }}
                />
                <span className="pb-3 text-xs text-[#91a49f]">
                  {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"][index]}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-6">
          <h2 className="font-display text-xl font-bold">Doações por tipo</h2>
          <div className="mx-auto mt-7 grid size-44 place-items-center rounded-full bg-[conic-gradient(#8bea52_0_64%,#2872d8_64%_100%)]">
            <div className="grid size-28 place-items-center rounded-full bg-[#0d2227] text-center">
              <span>
                <strong className="block text-2xl">312</strong>
                <span className="text-xs text-[#91a49f]">Total</span>
              </span>
            </div>
          </div>
          <div className="mt-7 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="flex items-center gap-2">
                <i className="size-2 rounded-full bg-[#8bea52]" /> Financeiras
              </span>
              <strong>198 (64%)</strong>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-2">
                <i className="size-2 rounded-full bg-[#2872d8]" /> Materiais
              </span>
              <strong>114 (36%)</strong>
            </div>
          </div>
        </div>
      </div>
      <div className="panel mt-6 overflow-hidden">
        <div className="border-b border-[#294047] px-5 py-4">
          <h2 className="font-display text-lg font-bold">Últimas doações</h2>
        </div>
        {[
          ["17/06/2026", "Ana Paula Silva", "Financeira", "R$ 100,00"],
          ["17/06/2026", "Pet Shop Amigo", "Material", "20 kg"],
          ["16/06/2026", "Carlos Eduardo", "Financeira", "R$ 50,00"],
        ].map((row) => (
          <div
            key={row.join()}
            className="grid grid-cols-2 gap-2 border-b border-[#20353b] px-5 py-4 text-xs last:border-0 sm:grid-cols-4"
          >
            {row.map((item, index) => (
              <span
                key={item}
                className={index === 2 ? "font-bold text-[#8bea52]" : ""}
              >
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="grid min-h-screen bg-[#06161b] text-white lg:grid-cols-[.9fr_1.1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src="https://images.unsplash.com/photo-1648752007903-6b681160ca8e?auto=format&fit=crop&w=1200&q=85"
          alt="Animais em um lar"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06161b] via-[#06161b]/50 to-transparent" />
        <div className="absolute inset-x-12 bottom-12">
          <Brand />
          <p className="mt-5 max-w-md font-display text-3xl font-bold leading-tight">
            Toda história merece cuidado, respeito e um lar.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-[#91a49f]">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)
    try {
      const response = await authApi("/api/auth/login", {
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      })

      if (!response.ok) {
        setError(
          response.status === 404
            ? "Usuário não encontrado. Verifique o e-mail informado."
            : "E-mail ou senha inválidos.",
        )
        return
      }

      navigate("/")
    } catch {
      setError("Não foi possível verificar o usuário. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      title="Que bom ter você de volta"
      subtitle="Acesse sua conta para continuar ajudando."
    >
      <form onSubmit={handleLogin} className="mt-8 space-y-5">
        <Field
          label="E-mail"
          name="email"
          type="email"
          placeholder="voce@email.com"
          required
          icon={<Mail size={17} />}
        />
        <Field
          label="Senha"
          name="password"
          type="password"
          placeholder="Sua senha"
          required
          icon={<LockKeyhole size={17} />}
        />
        <div className="flex justify-end">
          <button type="button" className="text-xs font-bold text-[#8bea52]">
            Esqueci minha senha
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <button
          disabled={isLoading}
          className="primary-button w-full justify-center disabled:opacity-60"
        >
          <LogIn size={18} /> {isLoading ? "Verificando..." : "Entrar"}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-[#91a49f]">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="font-bold text-[#8bea52]">
          Cadastre-se
        </Link>
      </p>
    </AuthShell>
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  function isValidCpf(value: string) {
    const cpf = value.replace(/\D/g, "")
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

    const digit = (length: number) => {
      const sum = cpf
        .slice(0, length)
        .split("")
        .reduce(
          (total, number, index) =>
            total + Number(number) * (length + 1 - index),
          0,
        )
      const remainder = (sum * 10) % 11
      return remainder === 10 ? 0 : remainder
    }

    return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const form = event.currentTarget
    const formData = new FormData(form)
    const email = String(formData.get("email") ?? "").trim()
    const cpf = String(formData.get("cpf") ?? "")

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Informe um e-mail válido.")
      return
    }
    if (!isValidCpf(cpf)) {
      setError("Informe um CPF válido.")
      return
    }

    setIsLoading(true)
    try {
      const response = await authApi("/api/auth/register", {
        name: String(formData.get("name") ?? "").trim(),
        email,
        cpf: cpf.replace(/\D/g, ""),
        phone: String(formData.get("phone") ?? ""),
        password: String(formData.get("password") ?? ""),
      })

      if (!response.ok) {
        setError(
          response.status === 409
            ? "Este e-mail ou CPF já está em uso."
            : "Não foi possível criar a conta. Verifique os dados e tente novamente.",
        )
        return
      }

      navigate("/")
    } catch {
      setError("Não foi possível verificar os dados. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      title="Crie sua conta"
      subtitle="Preencha os dados para fazer parte da Sos Patinhas."
    >
      <form onSubmit={handleRegister} className="mt-8">
        <div className="space-y-4">
          <Field
            label="Nome completo"
            name="name"
            placeholder="Seu nome completo"
            required
            icon={<User size={17} />}
          />
          <Field
            label="E-mail"
            name="email"
            type="email"
            placeholder="voce@email.com"
            required
            icon={<Mail size={17} />}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="CPF"
              name="cpf"
              placeholder="000.000.000-00"
              required
            />
            <Field
              label="Telefone"
              name="phone"
              placeholder="(11) 99999-9999"
              required
            />
          </div>
          <Field
            label="Senha"
            name="password"
            type="password"
            placeholder="Mínimo de 8 caracteres"
            required
            icon={<LockKeyhole size={17} />}
          />
          <CheckField
            name="terms"
            label="Li e concordo com os Termos de Uso e Privacidade."
            required
          />
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}
        <button
          disabled={isLoading}
          className="primary-button mt-6 w-full justify-center disabled:opacity-60"
        >
          <UserPlus size={18} /> {isLoading ? "Verificando..." : "Cadastrar"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[#91a49f]">
        Já tem uma conta?{" "}
        <Link to="/login" className="font-bold text-[#8bea52]">
          Fazer login
        </Link>
      </p>
    </AuthShell>
  )
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required = false,
  wide = false,
  icon,
}: {
  label: string
  name: string
  placeholder: string
  type?: string
  required?: boolean
  wide?: boolean
  icon?: React.ReactNode
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="label">
        {label}
        {required && <b> *</b>}
      </span>
      <span className="field">
        {icon}
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
        />
      </span>
    </label>
  )
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string
  name: string
  options: string[]
}) {
  return (
    <label className="block">
      <span className="label">
        {label} <b>*</b>
      </span>
      <span className="field relative">
        <select
          name={name}
          required
          className="w-full appearance-none bg-transparent outline-none"
        >
          <option value="">Selecione</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3"
        />
      </span>
    </label>
  )
}

function CheckField({
  name,
  label,
  required = false,
}: {
  name: string
  label: string
  required?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-[#c6d1ce]">
      <input
        type="checkbox"
        name={name}
        required={required}
        className="mt-0.5 size-5 accent-[#8bea52]"
      />
      <span>{label}</span>
    </label>
  )
}

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#06161b] px-5 text-center text-white">
      <div>
        <ShieldAlert size={44} className="mx-auto text-[#8bea52]" />
        <h1 className="mt-5 font-display text-4xl font-bold">
          Página não encontrada
        </h1>
        <Link to="/" className="primary-button mt-7">
          <ArrowLeft size={18} /> Voltar ao início
        </Link>
      </div>
    </div>
  )
}

export const routes = [
  { path: "/login", Component: LoginPage },
  { path: "/cadastro", Component: RegisterPage },
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, Component: HomePage },
      { path: "adocao", Component: AdoptionPage },
      { path: "adicionar-novo", Component: AddAnimalPage },
      { path: "doacao", Component: DonationPage },
      { path: "relatorios/doacoes", Component: ReportsPage },
      { path: "sobre", Component: AboutPage },
    ],
  },
  { path: "*", Component: NotFound },
]

export const router = createBrowserRouter(routes)

import "dotenv/config"
import {
  DonationType,
  Gender,
  PetStatus,
  Prisma,
  PrismaClient,
  Species,
  UserRole,
} from "@prisma/client"
import bcrypt from "bcrypt"
import cors from "cors"
import express, {
  type Request,
  type RequestHandler,
  type Response,
} from "express"
import jwt from "jsonwebtoken"

const app = express()
const prisma = new PrismaClient()
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET deve conter pelo menos 32 caracteres.")
  }
  return secret
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }))
app.use(express.json({ limit: "32kb" }))

type SessionUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

type AuthenticatedRequest = Request & { user?: SessionUser }

function getPathId(req: Request, res: Response): string | null {
  const id = req.params.id
  if (typeof id !== "string" || !id) {
    res.status(400).json({ error: "Identificador inválido." })
    return null
  }
  return id
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isText(value: unknown, maxLength = 255): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  )
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, "")
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  const digit = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split("")
      .reduce(
        (total, number, index) => total + Number(number) * (length + 1 - index),
        0,
      )
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

function signToken(userId: string): string {
  return jwt.sign({ userId }, getJwtSecret(), {
    expiresIn: "7d",
    algorithm: "HS256",
  })
}

function readToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] })
    return typeof payload !== "string" && typeof payload.userId === "string"
      ? payload.userId
      : null
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      return null
    }
    throw error
  }
}

const requireAuth: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next,
) => {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado." })
    return
  }

  const userId = readToken(authorization.slice(7))
  if (!userId) {
    res.status(401).json({ error: "Token inválido ou expirado." })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    })
    if (!user) {
      res.status(401).json({ error: "Sessão não encontrada." })
      return
    }
    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

const optionalAuth: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next,
) => {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith("Bearer ")) {
    next()
    return
  }

  const userId = readToken(authorization.slice(7))
  if (!userId) {
    res.status(401).json({ error: "Token inválido ou expirado." })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    })
    if (!user) {
      res.status(401).json({ error: "Sessão não encontrada." })
      return
    }
    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: AuthenticatedRequest, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Não autenticado." })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Acesso não autorizado." })
      return
    }
    next()
  }
}

function canManagePet(
  req: AuthenticatedRequest,
  createdById: string | null,
): boolean {
  return Boolean(
    req.user &&
      (req.user.role === UserRole.ADMIN ||
        req.user.role === UserRole.VOLUNTEER ||
        createdById === req.user.id),
  )
}

function parsePagination(query: Request["query"]) {
  const page = Number(query.page ?? 1)
  const limit = Number(query.limit ?? 20)
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return null
  }
  return { page, limit, skip: (page - 1) * limit }
}

function asAnimal(pet: {
  id: string
  name: string
  species: Species
  breed: string
  ageInMonths: number
  gender: Gender
  imageUrl: string
  city: string
  state: string
  status: string
  featured: boolean
}) {
  const age =
    pet.ageInMonths < 12
      ? `${pet.ageInMonths} ${pet.ageInMonths === 1 ? "mês" : "meses"}`
      : `${Math.floor(pet.ageInMonths / 12)} ${
          Math.floor(pet.ageInMonths / 12) === 1 ? "ano" : "anos"
        }`
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species === Species.DOG ? "Cachorro" : "Gato",
    breed: pet.breed,
    age,
    gender: pet.gender === Gender.MALE ? "Macho" : "Fêmea",
    size: "Médio",
    city: `${pet.city}, ${pet.state}`,
    image: pet.imageUrl,
    vaccinated: false,
    neutered: false,
    status: pet.status,
    featured: pet.featured,
  }
}

function parseAgeInMonths(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= 0 && value <= 600 ? value : null
  }
  if (typeof value !== "string") return null

  const age = value.trim().toLowerCase()
  const match = age.match(/^(\d{1,3})\s*(mês|meses|ano|anos)$/)
  if (!match) return null
  const count = Number(match[1])
  const months = match[2].startsWith("ano") ? count * 12 : count
  return months <= 600 ? months : null
}

function parsePetFields(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const breed = typeof body.breed === "string" ? body.breed.trim() : "SRD"
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : "Animal disponível para adoção."
  const imageUrl =
    typeof body.imageUrl === "string"
      ? body.imageUrl.trim()
      : typeof body.image === "string"
        ? body.image.trim()
        : ""
  const species =
    body.species === "DOG" || body.species === "Cachorro"
      ? Species.DOG
      : body.species === "CAT" || body.species === "Gato"
        ? Species.CAT
        : null
  const gender =
    body.gender === "MALE" || body.gender === "Macho"
      ? Gender.MALE
      : body.gender === "FEMALE" || body.gender === "Fêmea"
        ? Gender.FEMALE
        : null
  const ageInMonths = body.ageInMonths ?? body.age

  let city = typeof body.city === "string" ? body.city.trim() : ""
  let state =
    typeof body.state === "string" ? body.state.trim().toUpperCase() : ""
  if (!state && city.includes(",")) {
    const parts = city.split(",")
    state = (parts.pop() ?? "").trim().toUpperCase()
    city = parts.join(",").trim()
  }

  let validImage = false
  try {
    const parsedImageUrl = new URL(imageUrl)
    validImage =
      parsedImageUrl.protocol === "https:" ||
      parsedImageUrl.protocol === "http:"
  } catch {
    validImage = false
  }

  if (
    !isText(name, 120) ||
    !isText(breed, 120) ||
    !isText(description, 5000) ||
    !species ||
    !gender ||
    ageInMonths === null ||
    !isText(city, 120) ||
    !/^[A-Z]{2}$/.test(state) ||
    !validImage
  ) {
    return null
  }

  return {
    name,
    species,
    breed,
    ageInMonths,
    gender,
    description,
    imageUrl,
    city,
    state,
  }
}

function handlePrismaError(error: unknown, res: express.Response): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false

  if (error.code === "P2002") {
    res.status(409).json({ error: "Já existe um registro com esses dados." })
    return true
  }
  if (error.code === "P2025") {
    res.status(404).json({ error: "Registro não encontrado." })
    return true
  }
  if (error.code === "P2003") {
    res.status(400).json({ error: "A referência informada não existe." })
    return true
  }
  return false
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" })
})

app.post("/api/auth/register", async (req, res, next) => {
  const body: unknown = req.body
  if (!isRecord(body)) {
    res.status(400).json({ error: "Informe os dados do cadastro." })
    return
  }

  const { name, email, cpf, phone, password } = body
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : ""
  const normalizedCpf = typeof cpf === "string" ? cpf.replace(/\D/g, "") : ""
  const normalizedPhone = typeof phone === "string" ? phone.trim() : ""
  if (
    !isText(name, 120) ||
    !isEmail(normalizedEmail) ||
    (cpf !== undefined && typeof cpf !== "string") ||
    (normalizedCpf && !isValidCpf(normalizedCpf)) ||
    (phone !== undefined && typeof phone !== "string") ||
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72 ||
    normalizedPhone.length > 30
  ) {
    res.status(400).json({ error: "Verifique os dados informados." })
    return
  }

  try {
    getJwtSecret()
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        cpf: normalizedCpf || null,
        phone: normalizedPhone || null,
      },
      select: { id: true, name: true, email: true, role: true },
    })
    res.status(201).json({
      token: signToken(user.id),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    if (handlePrismaError(error, res)) return
    next(error)
  }
})

app.post("/api/auth/login", async (req, res, next) => {
  const body: unknown = req.body
  if (
    !isRecord(body) ||
    typeof body.email !== "string" ||
    !isEmail(body.email) ||
    body.email.length > 254 ||
    typeof body.password !== "string" ||
    Buffer.byteLength(body.password, "utf8") > 72
  ) {
    res.status(400).json({ error: "Informe e-mail e senha." })
    return
  }

  try {
    getJwtSecret()
    const user = await prisma.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
    })
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      res.status(401).json({ error: "E-mail ou senha inválidos." })
      return
    }
    res.json({
      token: signToken(user.id),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    next(error)
  }
})

app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json(req.user)
})

app.get(
  "/api/users/me",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          name: true,
          email: true,
          cpf: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      })
      if (!user) {
        res.status(404).json({ error: "Usuário não encontrado." })
        return
      }
      res.json(user)
    } catch (error) {
      next(error)
    }
  },
)

app.patch(
  "/api/users/me",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    const body: unknown = req.body
    if (!isRecord(body)) {
      res.status(400).json({ error: "Informe os dados a atualizar." })
      return
    }

    const data: Prisma.UserUpdateInput = {}
    if (body.name !== undefined) {
      if (!isText(body.name, 120)) {
        res.status(400).json({ error: "Nome inválido." })
        return
      }
      data.name = body.name.trim()
    }
    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !isEmail(body.email)) {
        res.status(400).json({ error: "E-mail inválido." })
        return
      }
      data.email = body.email.trim().toLowerCase()
    }
    if (body.phone !== undefined) {
      if (typeof body.phone !== "string" || body.phone.trim().length > 30) {
        res.status(400).json({ error: "Telefone inválido." })
        return
      }
      data.phone = body.phone.trim() || null
    }
    if (body.cpf !== undefined) {
      if (typeof body.cpf !== "string" || (body.cpf && !isValidCpf(body.cpf))) {
        res.status(400).json({ error: "CPF inválido." })
        return
      }
      data.cpf = body.cpf.replace(/\D/g, "") || null
    }
    if (body.password !== undefined) {
      if (
        typeof body.password !== "string" ||
        body.password.length < 8 ||
        Buffer.byteLength(body.password, "utf8") > 72
      ) {
        res
          .status(400)
          .json({ error: "A senha deve conter entre 8 e 72 bytes." })
        return
      }
      data.passwordHash = await bcrypt.hash(body.password, 10)
    }
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "Nenhum campo válido para atualização." })
      return
    }

    try {
      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          cpf: true,
          phone: true,
          role: true,
          updatedAt: true,
        },
      })
      res.json(user)
    } catch (error) {
      if (handlePrismaError(error, res)) return
      next(error)
    }
  },
)

app.get(
  "/api/users",
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    const pagination = parsePagination(req.query)
    if (!pagination) {
      res.status(400).json({ error: "Paginação inválida." })
      return
    }
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : ""
    try {
      const where: Prisma.UserWhereInput = search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}
      const [users, total] = await prisma.$transaction([
        prisma.user.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            cpf: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        }),
        prisma.user.count({ where }),
      ])
      res.json({
        data: users,
        page: pagination.page,
        limit: pagination.limit,
        total,
      })
    } catch (error) {
      next(error)
    }
  },
)

app.get(
  "/api/users/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    const id = getPathId(req, res)
    if (!id) return
    if (req.user!.id !== id && req.user!.role !== UserRole.ADMIN) {
      res.status(403).json({ error: "Acesso não autorizado." })
      return
    }
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          cpf: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      })
      if (!user) {
        res.status(404).json({ error: "Usuário não encontrado." })
        return
      }
      res.json(user)
    } catch (error) {
      next(error)
    }
  },
)

app.delete(
  "/api/users/:id",
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    const id = getPathId(req, res)
    if (!id) return
    try {
      await prisma.user.delete({ where: { id } })
      res.status(204).end()
    } catch (error) {
      if (handlePrismaError(error, res)) return
      next(error)
    }
  },
)

app.get("/api/pets", async (req, res, next) => {
  const pagination = parsePagination(req.query)
  if (!pagination) {
    res.status(400).json({ error: "Paginação inválida." })
    return
  }
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : ""
  const city = typeof req.query.city === "string" ? req.query.city.trim() : ""
  const speciesValue = req.query.species
  const genderValue = req.query.gender
  const species =
    speciesValue === "DOG" || speciesValue === "Cachorro"
      ? Species.DOG
      : speciesValue === "CAT" || speciesValue === "Gato"
        ? Species.CAT
        : undefined
  const gender =
    genderValue === "MALE" || genderValue === "Macho"
      ? Gender.MALE
      : genderValue === "FEMALE" || genderValue === "Fêmea"
        ? Gender.FEMALE
        : undefined
  const statusValues = [
    PetStatus.AVAILABLE,
    PetStatus.IN_PROCESS,
    PetStatus.ADOPTED,
  ]
  const requestedStatus =
    typeof req.query.status === "string" ? req.query.status : undefined
  const status = requestedStatus
    ? statusValues.find((value) => value === requestedStatus)
    : undefined
  if (
    (speciesValue !== undefined && !species) ||
    (genderValue !== undefined && !gender) ||
    (requestedStatus !== undefined && !status)
  ) {
    res.status(400).json({ error: "Filtro inválido." })
    return
  }

  const where: Prisma.PetWhereInput = {
    status: status ?? PetStatus.AVAILABLE,
    species,
    gender,
    city: city ? { contains: city, mode: "insensitive" } : undefined,
    OR: search
      ? [
          { name: { contains: search, mode: "insensitive" } },
          { breed: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
        ]
      : undefined,
  }

  try {
    const [pets, total] = await prisma.$transaction([
      prisma.pet.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      }),
      prisma.pet.count({ where }),
    ])
    res.json({
      data: pets,
      page: pagination.page,
      limit: pagination.limit,
      total,
    })
  } catch (error) {
    next(error)
  }
})

app.get("/api/pets/:id", async (req, res, next) => {
  const id = getPathId(req, res)
  if (!id) return
  try {
    const pet = await prisma.pet.findUnique({ where: { id } })
    if (!pet) {
      res.status(404).json({ error: "Pet não encontrado." })
      return
    }
    res.json(asAnimal(pet))
  } catch (error) {
    next(error)
  }
})

app.post(
  "/api/pets",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    const body: unknown = req.body
    if (!isRecord(body)) {
      res.status(400).json({ error: "Informe os dados do pet." })
      return
    }
    const petData = body
    if (!petData) {
      res.status(400).json({ error: "Verifique os dados do pet." })
      return
    }
    try {
      const pet = await prisma.pet.create({
        data: { ...petData, createdById: req.user!.id } as any,
      })
      res.status(201).json(asAnimal(pet))
    } catch (error) {
      next(error)
    }
  },
)

app.patch(
  "/api/pets/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    const id = getPathId(req, res)
    if (!id) return
    const body: unknown = req.body
    if (!isRecord(body)) {
      res.status(400).json({ error: "Informe os dados para atualizar." })
      return
    }
    try {
      const existing = await prisma.pet.findUnique({
        where: { id },
      })
      if (!existing) {
        res.status(404).json({ error: "Pet não encontrado." })
        return
      }
      if (!canManagePet(req, existing.createdById)) {
        res.status(403).json({ error: "Acesso não autorizado." })
        return
      }
      const petData = parsePetFields({ ...existing, ...body })
      if (!petData) {
        res.status(400).json({ error: "Verifique os dados do pet." })
        return
      }
      const status = body.status
      if (
        status !== undefined &&
        status !== "AVAILABLE" &&
        status !== "IN_PROCESS" &&
        status !== "ADOPTED"
      ) {
        res.status(400).json({ error: "Status do pet inválido." })
        return
      }
      const pet = await prisma.pet.update({
        where: { id },
        data: { ...petData, ...(typeof status === "string" ? { status } : {}) },
      })
      res.json(asAnimal(pet))
    } catch (error) {
      next(error)
    }
  },
)

app.delete(
  "/api/pets/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    const id = getPathId(req, res)
    if (!id) return
    try {
      const pet = await prisma.pet.findUnique({
        where: { id },
        select: { id: true, createdById: true },
      })
      if (!pet) {
        res.status(404).json({ error: "Pet não encontrado." })
        return
      }
      if (!canManagePet(req, pet.createdById)) {
        res.status(403).json({ error: "Acesso não autorizado." })
        return
      }
      await prisma.pet.delete({ where: { id: pet.id } })
      res.status(204).end()
    } catch (error) {
      if (handlePrismaError(error, res)) return
      next(error)
    }
  },
)

app.post(
  "/api/pets/:id/applications",
  optionalAuth,
  async (req: AuthenticatedRequest, res, next) => {
    const petId = getPathId(req, res)
    if (!petId) return
    const body: unknown = req.body
    if (!isRecord(body)) {
      res.status(400).json({ error: "Informe os dados da candidatura." })
      return
    }
    const name =
      typeof body.name === "string" ? body.name.trim() : (req.user?.name ?? "")
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : (req.user?.email ?? "")
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""
    if (
      !isText(name, 120) ||
      !isEmail(email) ||
      phone.length > 30 ||
      message.length > 2000
    ) {
      res.status(400).json({ error: "Verifique os dados da candidatura." })
      return
    }
    try {
      const application = await prisma.adoptionApplication.create({
        data: {
          petId,
          userId: req.user?.id,
          name,
          email,
          phone: phone || null,
          message: message || null,
        },
        include: { pet: { select: { id: true, name: true } } },
      })
      res.status(201).json(application)
    } catch (error) {
      if (handlePrismaError(error, res)) return
      next(error)
    }
  },
)

app.get(
  "/api/pets/:id/applications",
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.VOLUNTEER),
  async (req, res, next) => {
    const petId = getPathId(req, res)
    if (!petId) return
    const pagination = parsePagination(req.query)
    if (!pagination) {
      res.status(400).json({ error: "Paginação inválida." })
      return
    }
    try {
      const [applications, total] = await prisma.$transaction([
        prisma.adoptionApplication.findMany({
          where: { petId },
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.adoptionApplication.count({ where: { petId } }),
      ])
      res.json({
        data: applications,
        page: pagination.page,
        limit: pagination.limit,
        total,
      })
    } catch (error) {
      next(error)
    }
  },
)

app.post(
  "/api/donations",
  optionalAuth,
  async (req: AuthenticatedRequest, res, next) => {
    const body: unknown = req.body
    if (!isRecord(body)) {
      res.status(400).json({ error: "Informe os dados da doação." })
      return
    }
    if (
      body.type !== DonationType.FINANCIAL &&
      body.type !== DonationType.MATERIAL
    ) {
      res.status(400).json({ error: "Tipo de doação inválido." })
      return
    }
    const amount = body.amount
    const description =
      typeof body.description === "string" ? body.description.trim() : ""
    if (
      (body.type === DonationType.FINANCIAL &&
        (typeof amount !== "number" ||
          !Number.isFinite(amount) ||
          amount <= 0 ||
          amount > 99_999_999.99)) ||
      (amount !== undefined &&
        amount !== null &&
        (typeof amount !== "number" || body.type !== DonationType.FINANCIAL)) ||
      description.length > 1000 ||
      (body.type === DonationType.MATERIAL && !description)
    ) {
      res
        .status(400)
        .json({ error: "Verifique o valor ou a descrição da doação." })
      return
    }
    try {
      const donation = await prisma.donation.create({
        data: {
          type: body.type,
          amount:
            body.type === DonationType.FINANCIAL
              ? new Prisma.Decimal(amount as number)
              : null,
          description: description || null,
          userId: req.user?.id ?? null,
        },
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          createdAt: true,
        },
      })
      res.status(201).json(donation)
    } catch (error) {
      next(error)
    }
  },
)

app.get(
  "/api/donations",
  async (req, res, next) => {
    const pagination = parsePagination(req.query)
    if (!pagination) {
      res.status(400).json({ error: "Paginação inválida." })
      return
    }
    const from =
      typeof req.query.from === "string"
        ? new Date(req.query.from)
        : new Date(0)
    const to =
      typeof req.query.to === "string" ? new Date(req.query.to) : new Date()
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from > to
    ) {
      res.status(400).json({ error: "Período inválido." })
      return
    }
    try {
      const where: Prisma.DonationWhereInput = {
        createdAt: { gte: from, lte: to },
      }
      const [donations, total, totals] = await prisma.$transaction([
        prisma.donation.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        }),
        prisma.donation.count({ where }),
        prisma.donation.aggregate({
          where: { ...where, type: DonationType.FINANCIAL },
          _sum: { amount: true },
          _count: true,
        }),
      ])
      res.json({
        data: donations,
        page: pagination.page,
        limit: pagination.limit,
        total,
        totals: {
          financialAmount: totals._sum.amount,
          financialCount: totals._count,
        },
      })
    } catch (error) {
      next(error)
    }
  },
)

app.use(
  (
    error: unknown,
    _req: Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Erro na API:", error)
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ error: "JSON inválido." })
      return
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (handlePrismaError(error, res)) return
    }
    res.status(500).json({ error: "Erro interno do servidor." })
  },
)

export const handler = app

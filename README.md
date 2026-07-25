# Set Point — Backend (BE-SetPoint)

Backend repository for the **Set Point** padel tournament platform.

**Set Point** is a production-grade SaaS platform that helps Event Organizers manage padel tournaments from preparation to champion declaration through intelligent automation while keeping humans fully in control.

## Vision

To become the trusted operating system for padel tournament management—where Event Organizers can run professional competitions with confidence, speed, and full control.

## Repository Role

This repository (`BE-SetPoint`) owns platform services, domain APIs, Prisma persistence, and architecture documentation.

Companion repository:

- Frontend: [FE-SetPoint](https://github.com/febrianrachmat/FE-SetPoint)

## Repository Structure

```text
BE-SetPoint/
├── .github/                 # GitHub workflows and automation config
├── docs/                    # Architecture & product documentation (00–09)
├── prisma/
│   └── schema.prisma        # Authoritative Prisma schema
├── src/                     # NestJS application source (pending scaffold)
├── .editorconfig
├── .env.example
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

## Prisma

Schema lives at `prisma/schema.prisma`.

```bash
npm install
npm run prisma:validate
```

Copy `.env.example` to `.env` and set `DATABASE_URL` before generating the client or running migrations.

## Development Status

**Phase: Foundation Phase**

Current focus:

- Architecture documentation complete through Prisma Schema Specification
- Prisma schema implemented for all 26 physical tables
- NestJS application scaffold pending

See [`docs/00-project-charter.md`](./docs/00-project-charter.md) for governing product context.

## License

MIT — see [LICENSE](./LICENSE).

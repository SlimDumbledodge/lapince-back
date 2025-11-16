# LaPince Back (lapince-back)

A backend API built with NestJS and TypeScript for the "La Pince" application. It uses Drizzle ORM for database access, BullMQ for background jobs, and integrates with Google OAuth, Slack, and an email system.

**Status:** Active development

**Tech Stack:**
- **Runtime:** Node.js + TypeScript
- **Framework:** NestJS
- **ORM:** Drizzle ORM / drizzle-kit
- **Queue:** BullMQ
- **DB Driver:** `pg` (Postgres)
- **Template engine:** Pug
- **Testing:** Jest + Supertest
- **Linting / Formatting:** ESLint + Prettier

**Main Features:**
- Authentication (JWT + Google OAuth)
- User and account management
- Budget and transactions APIs
- Notifications and email delivery
- Background processing with BullMQ
- Database migrations & seeds via `drizzle-kit`

**Repository layout (key files)**
- `src/` - application source
- `src/main.ts` - app bootstrap
- `src/app.module.ts` - root module
- `src/db/` - Drizzle schema and seed scripts
- `Dockerfile`, `docker-compose.yaml` - container definitions
- `jest.json`, `test/` - end-to-end testing

**Prerequisites**
- Node.js (recommended >= 18)
- PostgreSQL database
- Redis (for BullMQ)
- Yarn or npm

**Quick Setup**

1. Install dependencies

```powershell
npm install
```

2. Create your `.env` file in the project root and provide the required variables. Typical variables include:

- `DATABASE_URL` - Postgres connection string (e.g. `postgresql://user:pass@host:5432/dbname`)
- `REDIS_URL` - Redis connection for BullMQ
- `PORT` - application port (default: `3000`)
- `JWT_SECRET` - JWT secret
- Mail-related variables for SMTP (e.g. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
- Google OAuth client secrets and any other provider credentials

3. Generate or run migrations (drizzle-kit)

```powershell
npm run generate    # generate schema/migrations
npm run migrate     # apply migrations
```

4. Seed the database (optional)

```powershell
npm run seed
```

**Available NPM Scripts**

- `npm run start:dev` : Start in watch/dev mode
- `npm run start` : Start (Nest default)
- `npm run start:prod` : Start production from `dist/`
- `npm run build` : Build the project (output to `dist/`)
- `npm run test` : Run unit tests
- `npm run test:e2e` : Run e2e tests
- `npm run lint` : Run ESLint and auto-fix
- `npm run format` : Run Prettier to format source
- `npm run generate` : Run `drizzle-kit generate`
- `npm run migrate` : Run `drizzle-kit migrate`
- `npm run seed` : Run `ts-node src/db/seed.ts`

Check `package.json` for the full script list.

**Running with Docker**

Build and run the project with Docker Compose (requires Docker and Docker Compose):

```powershell
docker compose up --build
```

This repository includes `Dockerfile` and `docker-compose.yaml` which you can adapt to provide environment variables for Postgres/Redis and for the app.

**Testing**

Run unit tests:

```powershell
npm test
```

Run e2e tests:

```powershell
npm run test:e2e
```

**Lint & Format**

```powershell
npm run lint
npm run format
```

**Environment and Secrets**

Secrets and credentials (JWT secrets, OAuth client IDs/secrets, SMTP credentials, DB credentials) must be supplied via environment variables. Prefer a local `.env` during development and secret management or environment variables for CI/prod.

**Development Notes**
- The project leverages `tsconfig-paths` for path mapping during tests and development.
- Background workers are implemented with BullMQ and expect a running Redis instance.
- Drizzle is used for migrations and schema generation — see `drizzle.config.ts` and `src/db`.

**Contributing**

Contributions are welcome. Please open issues or PRs targeting the `develop` branch. Add tests for new behavior and follow existing lint/format rules.

**License**

This project is marked `UNLICENSED` in `package.json`. Check with the maintainers before reusing code in other projects.

---

If you want, I can also:
- add a `.env.example` file with common variables,
- add a short developer quickstart script,
- or generate a minimal CONTRIBUTING.md / PR template.

File created: `README.md`
<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

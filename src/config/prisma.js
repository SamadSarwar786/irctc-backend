const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const config = require('./index');
const logger = require('./logger');

class Prisma {
  static #instance = null;

  constructor() {
    if (Prisma.#instance) {
      return Prisma.#instance;
    }

    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }

    const adapter = new PrismaPg({ connectionString: config.databaseUrl });
    this.client = new PrismaClient({
      adapter,
      log: config.isProd ? ['warn', 'error'] : ['query', 'warn', 'error'],
    });

    Prisma.#instance = this;
  }

  static getInstance() {
    return new Prisma();
  }

  getClient() {
    return this.client;
  }

  async connect() {
    await this.client.$connect();
    logger.info('Prisma connected');
  }

  async disconnect() {
    await this.client.$disconnect();
    logger.info('Prisma disconnected');
  }
}

module.exports = Prisma;

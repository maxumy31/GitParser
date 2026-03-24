import Fastify from 'fastify'
import db from "./db.js"
import gen from "./dateGenerator.js"
import { createEndpointHandlers } from './endpoints.js'
import  modules from './ModuleLoader.js'
import { createRepositoryService } from './service.js'

const queryCollection = "query"
const visitedCollection = "visited"
const stateCollection = "state"

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname,level',
      }
    }
  }
})


const moduleName = 'github'
const repoModule = modules.LoadRepositoryModule(moduleName)
const langModule = modules.LoadLanguageModule()
const endpointHandlers = createEndpointHandlers({ dbAdapter: db })
const service = createRepositoryService({
    db,
    gen,
    repoModule,
    langModule,
    logger: fastify.log,
    queryCollection,
    visitedCollection,
    stateCollection,
})

const generator = gen.NewDateGenerator(await service.getDateState())

fastify.get('/', async function handler(req, reply) {
    try {
      return await endpointHandlers.handleGetKey(req, reply, fastify.log);
    } catch (err) {
      fastify.log.error("Route error:", err);
      return { error: "Internal server error" };
    }
})

fastify.get('/health',async function handler(req,reply) {
    fastify.log.info("Healthcheck")
    return {status: "ok"}
})

fastify.delete('/:id', async function handler(req, reply) {
  return await endpointHandlers.markAsProcessed(req, reply, fastify.log)
})

async function ProcessDay() {
    await service.processDay(generator)
}

async function StartProcessing() {
    fastify.log.info("Starting processing");
    try {
        await ProcessDay();
        setTimeout(StartProcessing, 0);
    } catch (err) {
        fastify.log.error("Error in processing loop:", err);
        setTimeout(StartProcessing, 5000);
    }
}


try {
    await fastify.listen({ port: process.env.SERVICE_PORT, host:'0.0.0.0'})
    StartProcessing()
    //console.log("СБОР ДАННЫХ НЕАКТИВЕН!")

} catch (err) {
    fastify.log.error(`Server crashed with error ${err}`)
    process.exit(1)
}
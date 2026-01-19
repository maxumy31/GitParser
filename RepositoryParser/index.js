import Fastify from 'fastify'
import db from "./db.js"
import gh from "./gh.js"
import gen from "./dateGenerator.js"
import { handleGetKey, markAsProcessed } from './endpoints.js'

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

await fastify.register(import('@fastify/swagger'), {
  openapi: {
    info: {
      title: 'GitHub Data Collector Service',
      version: '1.0.0',
      description: 'Сервис для сбора и предварительной обработки данных репозиториев с GitHub'
    },
    servers: [
      {
        url: `http://localhost:${process.env.SERVICE_PORT || 3000}`,
        description: 'Локальное развитие'
      }
    ]
  }
})

// Подключаем Swagger UI (веб-интерфейс)
await fastify.register(import('@fastify/swagger-ui'), {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, request, reply) => {
    return swaggerObject
  }
})

const generator = gen.NewDateGenerator(await GetDateState())

fastify.get('/', async function handler(req, reply) {
    try {
      return await handleGetKey(req, reply, fastify.log);
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
  return await markAsProcessed(req, reply, fastify)
})


function ParseGithubItem(response) {
    return {
        fullname : response.full_name,
        description: response.description,
        created_at : new Date(response.created_at),
        updated_at : new Date(response.updated_at),
        stars : response.stargazers_count,
        language:response.language,
        forks: response.forks_count,
        topics : response.topics,
        used_in_request : false
    }
}

function WriteBatch(batch) {
    const names = batch.map(data => data.fullname).map(fname => {return {name : fname}})
    db.insertBatch(visitedCollection,names)
    const themeBatch = batch.filter(data => data.dependencies && data.dependencies != 0 && 
        data.topics && data.topics.length != 0)
    if (themeBatch.length > 0) {
        db.insertBatch(queryCollection,themeBatch)
    }
}

async function SaveNewDateState(date) {
    fastify.log.info(`Updated date. New date : ${date}`)
    await db.updateData(stateCollection, {}, { $set: { date: date } });
}

async function GetDateState() {
    const res =  await db.findFirst(stateCollection,{})
    if(res) {
        fastify.log.info(`Loaded date from db: ${res.date}`)
        return new Date(res.date)
    } else {
        const date = new Date()
        fastify.log.info(`Unable to find date from db, created new date : ${date}`)
        db.insertData(stateCollection,{date : date})
        return date
    }
}

async function FetchAllRepos(date) {
    const formatedDate = gen.TimeToStringQueryFormat(date)
    fastify.log.info(`Fetching repos from date ${formatedDate} started`)
    const per_page = 100
    const starThreshold = 10
    let batch = []
    const first = await gh.FetchRepos(formatedDate,1,per_page,starThreshold)
    const total = first.data.total_count
    const pages = Math.ceil(total / per_page)

    fastify.log.info(`Fetching repos from date ${formatedDate} page 1`)
    for(const f of first.data.items) {
        const parsed = ParseGithubItem(f)
        batch.push(parsed)
    }
    
    for(let i = 2; i <= pages;i++) {
        fastify.log.info(`Fetching repos from date ${formatedDate} page ${i}`)
        const page = await gh.FetchRepos(formatedDate,i,per_page,starThreshold)
        const parsed = ParseGithubItem(page)
        batch.push(parsed)
    }
    fastify.log.info(`Fetching repos from date ${formatedDate} finished`)
    return batch
}

async function ProcessDay() {
    try {
        const day = generator.Next()
        fastify.log.info(`Processing day ${day.toISOString()}`)
        let batch = await FetchAllRepos(day)
        for(let i = 0; i < batch.length;i++) {
            const [org,name] = batch[i].fullname.split("/")
            batch[i].dependencies = await gh.ParseProjectFiles(org,name)
        }
        batch = batch.filter(date => date.dependencies.length > 0)
        if (batch.length > 0) {
            WriteBatch(batch)
        }
        fastify.log.info(`Day ${day.toISOString()} processed. Skipping to the next day.`)
        SaveNewDateState(day)
    } catch(error) {
        fastify.log.error(`Error : ${error}. Skipping to the next day.`)
        const day = generator.Next()
        SaveNewDateState(day)
    }
    
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
    const fetchInterval = 1000
    await fastify.listen({ port: process.env.SERVICE_PORT, host:'0.0.0.0'})
    StartProcessing()

} catch (err) {
    fastify.log.error(`Server crashed with error ${err}`)
    process.exit(1)
}
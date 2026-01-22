import Fastify from 'fastify'
import db from "./db.js"
import gen from "./dateGenerator.js"
import { handleGetKey, markAsProcessed } from './endpoints.js'
import  modules from './ModuleLoader.js'

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


const generator = gen.NewDateGenerator(await GetDateState())

const moduleName = 'github'
const repoModule = modules.LoadRepositoryModule(moduleName)
const langModule = modules.LoadLanguageModule()
//console.log(await langModule.FindDependencies("rust",repoModule,"est31","cargo-udeps"))



async function GetBatch(date) {
    const formatedDate = gen.TimeToStringQueryFormat(date)
    fastify.log.info(`Fetching repos from date ${formatedDate} started`)
    const per_page = 100
    const starThreshold = 50
    const fetched = await repoModule.FetchRepos(formatedDate,1,per_page,starThreshold,langModule.GetSupportedLanguages())
    //Мы не парсим страницы, так как мы все равно указываем количество репозиториев на страницу с избытком
    //Если что можно повысить порог количества звезд

    //Найти репозитории -> Убедиться что они соответствуют нашим требованиям(парсятся) -> Добавить
    fastify.log.info(`Fetching repos from date ${formatedDate} page 1`)
    let batch = []
    for(const repo of fetched) {
        const repoLanguage = repo.language
        const repoOwner = repo.owner.login
        const repoName = repo.name
        const topics = repo.topics
        if(!topics || topics.length == 0) continue
        fastify.log.info(`Searching for dependencies for repository ${repoOwner}/${repoName}.Language = ${repoLanguage}`)
        const deps = await langModule.FindDependencies(repoLanguage,repoModule,repoOwner,repoName)
        if(!deps || deps.length == 0) continue
        repo.repository_id = repo.id
        delete repo.id
        const result = {
            data : repo,
            dependencies: deps,
            foundAt: new Date(),
            usedData:false,
        }
        batch.push(result)
    }
    return batch
}


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

function WriteBatch(batch) {
    db.insertBatch(visitedCollection,batch.map(repo => {return {full_name: repo.data.full_name}}))
    db.insertBatch(queryCollection,batch)
    console.log(`Inserted ${batch.length} repositories`)
    for(const b of batch) {
        console.log(`Inserted : ${b.data.full_name}. Language : ${b.data.language}`)
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


async function ProcessDay() {
    try {
        const day = generator.Next()
        fastify.log.info(`Processing day ${day.toISOString()}`)
        const batch = await GetBatch(day)
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
    await fastify.listen({ port: process.env.SERVICE_PORT, host:'0.0.0.0'})
    StartProcessing()

} catch (err) {
    fastify.log.error(`Server crashed with error ${err}`)
    process.exit(1)
}
import axios  from "axios"
import calc from "./calculations.js"
import db from "./db.js"
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname,level',
    }
  }
});
const topicsCollection = "topics"


const errorDelayTime = 5 * 60 * 1000
const GH_SERVICE_URI = process.env.GH_SERVICE_URI
console.log("URI = ",GH_SERVICE_URI)

StartPolling()

async function StartPolling() {
    while (true) {
        logger.info(`Fetching next repo`)
        const resp = await axios.get(`${GH_SERVICE_URI}/`)
        logger.info("Received repo:", JSON.stringify(resp.data, null, 2));
        if (resp.data.error) {
            logger.info(`Got error from request`)
            logger.info(`Will continue work in ${errorDelayTime}ms`)
            setTimeout(StartPolling,errorDelayTime)
            break
        }
        if (!resp.data) {
            logger.error(`Unknown error! ${resp}`)
            continue
        }
        const tranformed = calc.TransformInput(resp.data.repo)
        db.insertBatch(topicsCollection,tranformed)
        logger.info("New topic batch inserted")
        logger.info("Request to update inserted repo")
        const resp2 = await axios.delete(`${GH_SERVICE_URI}/${resp.data.repo._id}`)
        logger.info("Request to update inserted repo finished")
    }
}

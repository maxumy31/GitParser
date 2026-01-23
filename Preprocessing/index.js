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


const errorDelayTime = 5 * 60 * 1000
const GH_SERVICE_URI = process.env.GH_SERVICE_URI
console.log("URI = ",GH_SERVICE_URI)

StartPolling()

async function StartPolling() {
    while (true) {
        logger.info(`Fetching next repository`)
        const resp = await axios.get(`${GH_SERVICE_URI}/`)
        if (resp.data.error) {
          logger.info(`All repositories processed`)
          logger.info(`Will continue work in ${errorDelayTime}ms`)
          setTimeout(StartPolling,errorDelayTime)
          break
        }
        if (!resp.data) {
          logger.error(`Unknown error! ${resp}`)
          continue
        }
        logger.info(`Received repository ${resp.data.data.full_name}`);
        const tranformed = calc.TransformInput(resp.data)
        db.insertData("topics",tranformed)
        logger.info("New topic batch inserted")
        logger.info("Request to update inserted repo")
        const resp2 = await axios.delete(`${GH_SERVICE_URI}/${resp.data._id}`)
        logger.info("Request to update inserted repo finished")
    }
}

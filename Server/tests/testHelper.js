import { newDb } from "pg-mem";

export default function createNewDbContext() {
    const db = newDb();
    const { Client } = db.adapters.createPg();
    const client = new Client();
    client.connect();

    async function executeQuery(text, params = []) {
        try {
            const normalized = text.trim().replace(/;+\s*$/, "");
            const res = await client.query(normalized, params);
            return res.rows;
        } catch (err) {
            throw err;
        }
    }

    return [executeQuery, db];
}
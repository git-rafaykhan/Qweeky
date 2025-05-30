import { Client } from "pg";


const client = new Client({
    host: "localhost", 
    user: "postgres", 
    password: "rafaykhan",
    database: "Qweeky",
    port: 5432
});

export async function connectToDb() {
    try {
        await client.connect();
        console.log("PostgreSQL connect ho gaya bhai 🚀");
    } catch (err: any) {
        console.error("Connection error:", err.stack);
    }
}


export default client;
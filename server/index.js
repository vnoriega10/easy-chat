import express from 'express';
import logger from 'morgan'
import { Server } from 'socket.io';
import { createServer } from 'node:http'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client';


dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server,{
    connectionStateRecovery: {}
});

const db = createClient({
    url: "libsql://glorious-carnage-vnoriega10.turso.io",
    authToken: process.env.DB_TOKEN
})

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        user TEXT
    )
    `)

io.on('connection', async (socket) => {
    console.log('a user connected');

    socket.on('disconnect', () => {
        console.log('user disconnected');
    })

    socket.on('chat message', async (msg) => {
        let result
        const username = socket.handshake.auth.username ?? 'anonymous'
        try {
            result = await db.execute({
                sql: 'INSERT INTO messages (content, user) VALUES (:msg, :username)',
                args: { msg, username }
            })
        } catch (error) {
            console.error(error)
            return
        }
       io.emit('chat message', msg, result.lastInsertRowid.toString(), username);
    })

    if(!socket.recovered){
        try {
            const results = await db.execute({
                sql: 'SELECT id, content, user FROM messages WHERE id > ?',
                args: [socket.handshake.auth.serverOffset ?? 0]
            })

            results.rows.forEach(row => {
                socket.emit('chat message', row.content, row.id.toString(), row.user)
            })

        } catch (error) {
            console.error(error)
        }
    }
})

app.use(logger('dev'));

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html')
})



const PORT =  process.env.PORT ?? 3000;

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})
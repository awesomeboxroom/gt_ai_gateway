import {Context} from "hono";
import { stream, streamText, streamSSE } from 'hono/streaming'

let id = 0

function chatCompletions (c: Context){
    return streamSSE(c, async (stream) => {
        while (true) {
            const message = `It is ${new Date().toISOString()}`
            await stream.writeSSE({
                data: message,
                event: 'time-update',
                id: String(id++),
            })
            await stream.sleep(1000)
        }
    })
}

export {
    chatCompletions
}
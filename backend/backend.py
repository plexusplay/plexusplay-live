import asyncio
import json
from typing import NamedTuple
import websockets

class Message(NamedTuple):
    code: str
    data: dict

    def serialize(self):
        return json.dumps({'code': self.code, 'data': self.data})


ADDRESS = '0.0.0.0'
PORT = 8080


ballot = {
    "choice1": "Choice 1 from server",
    "choice2": "Choice 2 from server",
    "question": "Question from server",
}



async def echo(websocket, path):
    print(f'{websocket} connected')
    message = Message(code='setBallot', data=ballot)
    print(f'sending {message.serialize()} to {websocket}')
    await websocket.send(message.serialize())
    async for message in websocket:
        print(f'{path}: {message}')
    print(f'{websocket} disconnected')

async def main():
    print(f'running websocket server at {ADDRESS}:{PORT}')
    async with websockets.serve(echo, ADDRESS, PORT):
        await asyncio.Future()  # run forever

asyncio.run(main())
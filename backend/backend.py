import asyncio
import json
from typing import NamedTuple
import websockets

ADDRESS = '0.0.0.0'
PORT = 8080

class Message(NamedTuple):
    code: str
    data: dict

    def serialize(self):
        return json.dumps({'code': self.code, 'data': self.data})

ballot = {
    "choice1": "Choice 1 from server",
    "choice2": "Choice 2 from server",
    "question": "Question from server",
}

votes = {}

clients = {}

def transform_votes(votes):
    choices = ('choice1', 'choice2')
    totals = {}
    for c in choices:
        totals[c] = len([v for v in votes.values() if v==c])
    return totals


async def send_votes():
    code = 'setVotes'
    data = transform_votes(votes)
    await send_to_all(code, data)

async def send_to_all(code, data):
    message = Message(code, data).serialize()
    bg_sends = set()
    for ws in clients.values():
        task = asyncio.create_task(ws.send(message))
        bg_sends.add(task)
        task.add_done_callback(bg_sends.discard)

async def echo(websocket, path):
    userId = None
    ballot_msg = Message('setBallot', ballot).serialize()
    votes_msg = Message('setVotes', transform_votes(votes)).serialize()
    await websocket.send(ballot_msg)
    await websocket.send(votes_msg)
    async for message in websocket:
        message = json.loads(message)
        code, data, userId = message['code'], message['data'], message['userId']
        clients[userId] = websocket
        if code == 'vote':
            votes[userId] = data
            await send_votes()
    # websocket closes
    del clients[userId]
    del votes[userId]
    await send_votes()


async def main():
    print(f'running websocket server at {ADDRESS}:{PORT}')
    async with websockets.serve(echo, ADDRESS, PORT):
        await asyncio.Future()  # run forever

asyncio.run(main())
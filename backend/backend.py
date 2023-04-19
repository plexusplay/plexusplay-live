# Standard libraries
import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
import json
from typing import NamedTuple
import logging

# Third-party libraries
import websockets
from websockets.server import WebSocketServerProtocol

ADDRESS = '0.0.0.0'
PORT = 8080

CLIENT_TIMEOUT = timedelta(seconds=10)

logging.basicConfig(filename=datetime.now().strftime('logs/%Y-%m-%d-%H:%M:%S.log'), level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

console = logging.StreamHandler()
console.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
console.setFormatter(formatter)
logging.getLogger('').addHandler(console)

class Message(NamedTuple):
    code: str
    data: dict

    def serialize(self):
        return json.dumps({'code': self.code, 'data': self.data})


@dataclass
class Client:
    path: str
    ws: WebSocketServerProtocol
    last_seen: datetime
    vote: int = -1

    def __eq__(self, __value: object) -> bool:
        if not hasattr(__value, 'ws'):
            return False
        return self.ws is __value.ws

    def __hash__(self) -> int:
        return self.ws.__hash__()


class Voting:
    def __init__(self):
        self.ballot = {
            "choices": ["Choice 1 from server", "Choice 2 from server", "Choice 3 from server", "Choice 4 from server"],
            "question": "Question from server",
        }
        self._clients = set()

    async def prune_clients(self):
        while True:
            now = datetime.now()
            live_clients = {c for c in self._clients if now - c.last_seen < CLIENT_TIMEOUT or c.path == '/admin'}
            diff = self._clients - live_clients
            self._clients = live_clients
            if diff:
                await self.send_votes()
            await asyncio.sleep(CLIENT_TIMEOUT.seconds)

    @property
    def clients(self):
        return set(c.ws for c in self._clients)

    @property
    def votes(self):
        return [len([c for c in self._clients if c.vote == x])
                for x in range(len(self.ballot['choices']))]

    async def send_votes(self):
        code, data = 'setVotes', self.votes
        await self.send_to_all(code, data)

    async def send_to_all(self, code, data):
        message = Message(code, data).serialize()
        # Do this asynchronously so a bad client doesn't freeze everyone
        websockets.broadcast(self.clients, message)

    async def handle_message(self, client: Client, message):
        message = json.loads(message)
        code, data = message['code'], message['data']
        client.last_seen = datetime.now()
        if code == 'vote':
            client.vote = data
            await self.send_votes()
        elif code == 'setBallot':
            self.ballot = data
            await self.send_to_all('setBallot', self.ballot)

    async def handle_ws(self, websocket, path):
        if path != '/' and path != '/admin':
            return
        client = Client(path=path, ws=websocket, last_seen=datetime.now())
        self._clients.add(client)
        logging.info(f'{websocket} connected')
        await self.send_votes()
        await self.send_to_all('setBallot', self.ballot)
        async for message in websocket:
            await self.handle_message(client, message)
        # websocket closes
        await self.send_votes()
        logging.info(f'{websocket} disconnected')

    async def start(self):
        logging.info(f'running websocket server at {ADDRESS}:{PORT}')
        async with websockets.serve(self.handle_ws, ADDRESS, PORT):
            asyncio.create_task(self.prune_clients())
            await asyncio.Future()  # run forever

if __name__ == '__main__':
    voting = Voting()
    asyncio.run(voting.start())
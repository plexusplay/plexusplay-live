"""Live Voting Backend.
Usage:
    backend.py run_secure <cert> <key> [--port=NUM] [--log=LEVEL]
    backend.py [--port=NUM] [--log=LEVEL]
    backend.py -h | --help
    backend.py --version

Options:
    -h --help     Show this screen.
    --version     Show version.
    --port=NUM    Set the port number to serve on [default: 8080].
    --log=LEVEL   Set the logging level [default: INFO].
"""
# Standard libraries
import asyncio
import json
import logging
import os
import ssl
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import NamedTuple, Optional

# Third-party libraries
import websockets
from docopt import docopt
from websockets.server import WebSocketServerProtocol
from websockets.exceptions import ConnectionClosed, WebSocketException

ADDRESS = '0.0.0.0'

ANONYMOUS_CLIENT_TIMEOUT = timedelta(seconds=30)
NAMED_CLIENT_TIMEOUT = timedelta(hours=1)

logger = logging.getLogger(__name__)

def setup_logging(args):
    global logger
    if not os.path.exists('logs'):
        os.makedirs('logs')
    loglevel = args['--log']
    numeric_level = getattr(logging, loglevel.upper(), None)
    if not isinstance(numeric_level, int):
        raise ValueError('Invalid log level: %s' % loglevel)
    logging.basicConfig(filename=datetime.now().strftime('logs/%Y-%m-%d-%H:%M:%S.log'), level=numeric_level, format='%(asctime)s - %(levelname)s - %(message)s')
    console = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    console.setFormatter(formatter)
    logger.addHandler(console)


class Message(NamedTuple):
    code: str
    data: dict

    def serialize(self):
        return json.dumps({'code': self.code, 'data': self.data})


@dataclass
class Client:
    path: str
    ws: WebSocketServerProtocol
    userId: Optional[str]
    last_seen: datetime

    def __eq__(self, __value: object) -> bool:
        if not hasattr(__value, 'ws'):
            return False
        return self.ws is __value.ws

    def __hash__(self) -> int:
        return self.ws.__hash__()

    def __str__(self):
        if self.userId:
            return self.userId
        else:
            return str(self.ws)


class Voting:
    def __init__(self, args):
        self.ssl_context: Optional[ssl.SSLContext] = self.create_ssl_context(args['<cert>'], args['<key>'])
        self.port = int(args['--port'])
        self.ballot = {
            "choices": ["Choice 1 from server", "Choice 2 from server", "Choice 3 from server", "Choice 4 from server"],
            "question": "Question from server",
            "expires": None,
            "duration": 0,
        }
        self._clients: set[Client] = set()
        self._votes = {}

    def create_ssl_context(self, certpath, keyfile):
        if certpath is None:
            logger.info('SSL disabled')
            return None
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_context.load_cert_chain(certpath, keyfile=keyfile)
        logger.info(f'SSL enabled using {certpath}')
        return ssl_context

    def is_client_alive(self, c: Client):
        idle_time = datetime.now() - c.last_seen
        if c.userId:
            return idle_time < NAMED_CLIENT_TIMEOUT
        else:
            return idle_time < ANONYMOUS_CLIENT_TIMEOUT

    async def prune_clients(self):
        while True:
            live_clients = {c for c in self._clients if self.is_client_alive(c) or c.path == '/admin'}
            diff = self._clients - live_clients
            self._clients = live_clients
            # Prune the votes as well
            active_named_users = {c.userId for c in self._clients}
            all_users = set(self._votes.keys())
            for userId in all_users:
                if userId not in active_named_users:
                    self._votes.pop(userId, None)
            if diff:
                await self.send_votes()
            await asyncio.sleep(ANONYMOUS_CLIENT_TIMEOUT.seconds)

    @property
    def votes(self):
        results = [0] * len(self.ballot['choices'])
        for v in self._votes.values():
            if v != -1:
                try:
                    results[v] += 1
                except IndexError:
                    pass
        return results

    @property
    def metadata(self):
        return {
            'connections': len(self._clients),
            'users': len(self._votes),
        }

    async def send_votes(self):
        await self.send_to_all('setVotes', self.votes)
        await self.send_to_admins('metadata', self.metadata)

    async def send_to_all(self, code, data):
        clients = (c.ws for c in self._clients)
        websockets.broadcast(clients, Message(code, data).serialize())

    async def send_to_admins(self, code, data):
        admin_ws = (c.ws for c in self._clients if c.path == '/admin')
        websockets.broadcast(admin_ws, Message(code, data).serialize())

    async def send_to_one(self, code, data, ws):
        message = Message(code, data).serialize()
        try:
            await ws.send(message)
        except ConnectionClosed:
            logger.warn(f'tried to send {message} to closed client {ws}')

    async def handle_message(self, client: Client, message):
        logger.debug(f'{client}: {message}')
        try:
            message = json.loads(message)
            code, data, userId = message['code'], message['data'], message['userId']
        except (json.JSONDecodeError, KeyError, TypeError):
            logger.warn(f'{client} sent invalid message\n{message}')
            return
        client.last_seen = datetime.now()
        if client.userId is None:
            client.userId = userId
        if code == 'vote':
            if datetime.now() > datetime.fromtimestamp(self.ballot['expires']):
                return
            try:
                data = int(data)
                if data < 0 or data > len(self.ballot['choices']):
                    raise ValueError
            except ValueError:
                logger.warn(f'{client} sent invalid vote: {data}')
                return
            self._votes[client.userId] = data
            await self.send_votes()
        elif code == 'setBallot':
            self.ballot = data
            self.ballot['duration'] = (datetime.fromtimestamp(self.ballot['expires']) - datetime.now()).seconds
            self._votes.clear()
            await self.send_to_all('setBallot', self.ballot)
            await self.send_votes()


    async def handle_ws(self, websocket, path):
        if path != '/' and path != '/admin':
            return
        client = Client(path=path, ws=websocket, last_seen=datetime.now(), userId=None)
        self._clients.add(client)
        logger.info(f'{websocket} connected')
        await self.send_votes()
        await self.send_to_one('setBallot', self.ballot, websocket)
        try:
            async for message in websocket:
                await self.handle_message(client, message)
        except WebSocketException:
            logger.debug(f'{client} exited disgracefully')
        # websocket closes
        self._clients.remove(client)
        await self.send_votes()
        logger.info(f'{websocket} disconnected')

    async def start(self):
        logger.info(f'running websocket server at {ADDRESS}:{self.port}')
        async with websockets.serve(self.handle_ws, ADDRESS, self.port, ssl=self.ssl_context):
            asyncio.create_task(self.prune_clients())
            await asyncio.Future()  # run forever


if __name__ == '__main__':
    args = docopt(__doc__, version="Live Voting Backend 0.1")
    setup_logging(args)
    voting = Voting(args)
    asyncio.run(voting.start())

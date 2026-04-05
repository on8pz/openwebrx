from . import Controller
from owrx.websocket import WebSocketConnection
from owrx.controllers.rotor.rotor_ws import RotorHandler

class RotCtlController(Controller):
    def indexAction(self):
        conn = WebSocketConnection(self.handler, RotorHandler())
        conn.handle()

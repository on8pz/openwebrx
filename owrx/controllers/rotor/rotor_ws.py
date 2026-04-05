import socket
import threading

import logging

logger = logging.getLogger(__name__)


from owrx.websocket import WebSocketConnection, Handler

# === rotctld settings ===
ROTCTLD_HOST = "host.docker.internal"
ROTCTLD_PORT = 4533

class RotorBackend:
    """Manages a TCP connection to rotctld."""
    def __init__(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.connect((ROTCTLD_HOST, ROTCTLD_PORT))
        self.lock = threading.Lock()

    def send(self, cmd: str) -> str:
        with self.lock:
            # send command to rotctld and block for a reply
            #logger.debug((cmd + "\n").encode("ascii"))
            self.sock.sendall((cmd + "\n").encode("ascii"))
            data = self.sock.recv(1024).decode("ascii").strip()
            #logger.debug(data)
            return data

rotor_backend = RotorBackend()

class RotorHandler(Handler):
    """
    WebSocket handler based on OpenWebRX's websocket.Handler base class.
    """

    def handleTextMessage(self, connection, message: str):
        """
        Called when a text frame is received from the client.

        Supported messages:
          ROTOR QUERY           → query current rotor position
          ROTOR MOVE <az> <el>  → move rotor
          ROTOR STOP            → stop movement
        """
        try:
            parts = message.strip().split()
            if len(parts) < 2 or parts[0] != "ROTOR":
                return  # ignore non-rotor messages

            cmd = parts[1].upper()

            if cmd == "QUERY":
                # ask rotctld for current az/el
                result = rotor_backend.send("p").replace("\n", " ")

            elif cmd == "POS" and len(parts) >= 4:
                az = float(parts[2])
                el = float(parts[3])
                result = rotor_backend.send(f"P {az:03.1f} {el:03.1f}")
            
            elif cmd == "MOVE" and len(parts) >= 4:
                dir = int(parts[2])
                speed = int(parts[3])
                result = rotor_backend.send(f"M {dir} {speed}")

            elif cmd == "STOP":
                result = rotor_backend.send("S")

            else:
                result = "ERROR UNKNOWN_COMMAND"

            # send response back over WebSocket
            connection.send(f"ROTOR-RESP {result}")

        except Exception as e:
            connection.send(f"ROTOR-ERROR {e}")

    def handleBinaryMessage(self, connection, data: bytes):
        # we don’t use binary messages for rotor control
        pass

    def handleClose(self):
        # optional cleanup when WS closes
        pass

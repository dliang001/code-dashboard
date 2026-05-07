import json
from flask import Flask

_cfg = json.loads("{}")
PORT = int(_cfg.get("assistant_port", 5679))
app = Flask(__name__)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)

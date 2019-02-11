#!/usr/bin/env python3

import json
import os
import time
import falcon
import jwt

api = application = falcon.API()

SECRET = os.environ.get("SECRET", "x" * 32)
MAX_AGE = 86400 * 999


class Auth:
    def on_post(self, req, resp):
        payload = json.load(req.stream)
        payload["iat"] = int(time.time())
        token = jwt.encode(payload, SECRET)
        resp.set_cookie("auth", token.decode(), max_age=MAX_AGE, path="/api")
                        #, secure=False, http_only=False)


api.add_route('/auth', Auth())


if __name__ == '__main__':
    import bjoern
    bjoern.run(api, "127.0.1.0", 3000)

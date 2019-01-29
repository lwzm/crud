#!/usr/bin/env python3

import json
import time
import falcon
import jwt

api = application = falcon.API()


class Auth:
    def on_post(self, req, resp):
        payload = json.load(req.stream)
        payload["iat"] = int(time.time())
        token = jwt.encode(payload, "your-secret")
        print(payload, token)
        resp.set_cookie('auth', token.decode(), path="/api")


api.add_route('/auth', Auth())


if __name__ == '__main__':
    import bjoern
    bjoern.run(api, "127.0.1.0", 3000)

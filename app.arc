@app
kenshiata-api

@aws
region eu-west-1
runtime typescript

@plugins
architect/plugin-typescript
remove-static-bucket

@typescript
esbuild-config esbuild-config.cjs
base-runtime nodejs22.x


@http

get /
options /*

/players/online
  method get
  src src/http/players/get-online

/webrtc/init
  method post
  src src/http/webrtc/post-init
/webrtc/offer
  method post
  src src/http/webrtc/post-offer
/webrtc/offers
  method get
  src src/http/webrtc/get-offers
/webrtc/answer
  method post
  src src/http/webrtc/post-answer
/webrtc/answer/:id
  method get
  src src/http/webrtc/get-answers


@ws
player-online
play-together-request
play-together-response

webrtc-send-description
webrtc-send-ice-candidate


@tables

sockets
  socketId *String
  expires TTL

playersOnline
  username *String
  expires TTL

webrtc
  id *String
  expires TTL
  encrypt true

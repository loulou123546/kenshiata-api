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

/characters
  method get
  src src/http/characters/list
/characters
  method post
  src src/http/characters/create
/characters
  method put
  src src/http/characters/put
/characters
  method delete
  src src/http/characters/delete


@ws
set-player
play-together-request
play-together-response

game-data


@tables

sockets
  socketId *String
  expires TTL

playersOnline
  username *String
  expires TTL

characters
  userId *String
  id **String


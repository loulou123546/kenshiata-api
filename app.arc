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

/gamerooms/:id/names
  method get
  src src/http/gamerooms/names

/stories/available
  method get
  src src/http/stories/list-available
/stories/:id
  method get
  src src/http/stories/get-metadata

post /open-socket

@ws
create-game-room
list-game-rooms
request-join-room
respond-join-room
invite-to-room
respond-to-invite
leave-room

start-game
session-broadcast
vote-story
player-ready
game-choice

@tables

sockets
  id *String
  expires TTL

gameRooms
  hostId *String

gameSessions
  id *String

playersOnline
  username *String
  expires TTL

characters
  userId *String
  id **String


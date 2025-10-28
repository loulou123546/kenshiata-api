@app
kenshiata-api

@aws
region eu-west-1
runtime typescript
timeout 30

@plugins
architect/plugin-typescript
remove-static-bucket
iam-permissions
set-env

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
  src src/http/stories/get-id
/stories/metadata/:id
  method get
  src src/http/stories/get-metadata
/stories/:id/achievements
  method get
  src src/http/stories/get-achievements
/stories/by-author/:author
  method get
  src src/http/stories/by-author
/stories
  method post
  src src/http/stories/new
/stories/:id
  method put
  src src/http/stories/edit
/stories/publish
  method post
  src src/http/stories/publish

/auth/login
  method post
  src src/http/auth/login
/auth/signup
  method post
  src src/http/auth/signup
/auth/signup-confirm
  method post
  src src/http/auth/signup-confirm
/auth/refresh
  method post
  src src/http/auth/refresh
/auth/forgot-password
  method post
  src src/http/auth/forgot-password
/auth/password-reset
  method post
  src src/http/auth/password-reset

/users/:id/achievements
  method get
  src src/http/users/get-achievements
/users/:id/game-sessions
  method get
  src src/http/users/get-game-sessions
/users/:userId/game-sessions/:sessionId
  method delete
  src src/http/users/delete-game-sessions
/users/:id/email-consents
  method get
  src src/http/users/get-email-consents
/users/:id/email-consents
  method put
  src src/http/users/put-email-consents

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
game-join-back

@tables

rateLimit
  id *String
  expires TTL

sockets
  id *String
  expires TTL

gameRooms
  hostId *String

gameSessions
  id *String

userGameSessions
  userId *String
  sessionId **String

playersOnline
  username *String
  expires TTL

characters
  userId *String
  id **String

stories
  id *String

storiesAchievements
  storyId *String
  id **String

playersAchievements
  userId *String
  achievementId **String

@app
kenshiata-api

@http
get /
options /*

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


@aws
region eu-west-1
runtime typescript

@plugins
architect/plugin-typescript
remove-static-bucket

@typescript
esbuild-config esbuild-config.cjs
base-runtime nodejs22.x

@tables

webrtc
  id *String
  expires TTL
  encrypt true

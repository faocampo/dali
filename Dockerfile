# Official multi-platform manifests inspected during the packaging acceptance run.
FROM node:24-bookworm@sha256:64af3819f9275802414d7cdc38c27e9d82bd564dec4d4da87d008255d36c63b4 AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
RUN npm install-scripts approve better-sqlite3 esbuild && npm rebuild better-sqlite3 esbuild --foreground-scripts
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY assets ./assets
COPY imgs ./imgs
COPY LICENSE ./LICENSE
COPY server ./server
RUN npm run build:production
RUN node --input-type=module -e "import Database from 'better-sqlite3'; const d=new Database('/tmp/native.sqlite'); if(d.pragma('journal_mode=WAL',{simple:true})!=='wal')throw Error('WAL');d.pragma('synchronous=FULL');if(d.pragma('synchronous',{simple:true})!==2)throw Error('FULL');d.close();console.log('NATIVE_SQLITE_WAL_FULL_PASS')"
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS app
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /build/package.json ./package.json
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/.gsd/production/server ./server
COPY --from=build /build/LICENSE ./LICENSE
USER 1000:1000
EXPOSE 3000
CMD ["node", "server/app.js"]

FROM nginx:stable-alpine@sha256:985220252f3863977e468f611ef118ebd01421289dd86ee1ae99cb068c3bce2b AS web
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /build/dist /usr/share/nginx/html
COPY --from=build /build/imgs/favicon /usr/share/nginx/html/imgs/favicon
COPY --from=build /build/assets/fonts /usr/share/nginx/html/assets/fonts
COPY --from=build /build/LICENSE /usr/share/nginx/html/LICENSE
USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]

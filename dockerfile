###################
# BASE IMAGE
###################
FROM node:20.9.0-alpine As base

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.10.2 --activate


###################
# BUILD FOR LOCAL DEVELOPMENT
###################
FROM base As development

COPY --chown=node:node package.json ./

RUN pnpm install

COPY --chown=node:node . .

USER node


###################
# BUILD FOR PRODUCTION
###################
FROM base As build

COPY --chown=node:node package.json ./

COPY --chown=node:node --from=development /app/node_modules ./node_modules

COPY --chown=node:node . .

RUN pnpm build

RUN pnpm install

USER node


###################
# PRODUCTION
###################
FROM base As production

COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist

CMD [ "node", "dist/src/main.js" ]

FROM mcr.microsoft.com/playwright:v1.57.0-jammy

WORKDIR /usr/src/app

# Copy monorepo-level tsconfig so the service tsconfig can extend "../../tsconfig.json"
COPY tsconfig.json /usr/src/app/tsconfig.json

# Copy service sources and manifests
COPY apps/playwright-service-ts/package*.json ./apps/playwright-service-ts/
COPY apps/playwright-service-ts/tsconfig.json ./apps/playwright-service-ts/tsconfig.json
COPY apps/playwright-service-ts ./apps/playwright-service-ts

WORKDIR /usr/src/app/apps/playwright-service-ts
RUN npm install
RUN npm run build

ARG PORT
ENV PORT=${PORT}

EXPOSE ${PORT}

CMD [ "npm", "start" ]

FROM node:24-bookworm-slim
WORKDIR /updater
COPY core.mjs main.mjs core.test.mjs ./
RUN node --test core.test.mjs
ENV DOCKER_HOST=unix:///var/run/docker.sock
CMD ["node", "main.mjs"]

FROM nginx:alpine
COPY conf.d /etc/nginx/conf.d
COPY build /home/crud

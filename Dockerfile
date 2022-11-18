FROM nginx:stable

COPY nginx.conf /etc/nginx/conf.d/default.conf.template

EXPOSE 80

CMD /bin/bash -c "envsubst < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf \
  && nginx -g 'daemon off;'"

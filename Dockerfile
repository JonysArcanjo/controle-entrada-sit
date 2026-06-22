FROM python:3.11-slim

WORKDIR /app

COPY . .

EXPOSE 8020

ENV HOST=0.0.0.0
ENV PORT=8020
ENV TZ=America/Fortaleza

CMD ["python3", "server.py"]

# Setup

Sync music

```bash
cd ~/Music
rsync -varP plex.uno:~/Music/Beets/ Beets/
scp plex.uno:~/beets.db ~/Code/juke/prisma/beets.db
```

Run servers

```bash
npm install
npm run dev
docker run --platform linux/amd64 -p 8080:80 -v /Users/jokull/Music/Beets:/mnt/data jetbrainsinfra/nginx-file-listing:0.2
```

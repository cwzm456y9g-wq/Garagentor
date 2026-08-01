# Einen Server einrichten

Anleitung für den Produktivbetrieb auf einem eigenen Server. Rechne mit
45 Minuten beim ersten Mal. Alle Befehle laufen auf dem Server, sofern nicht
anders vermerkt.

Am Ende steht die Anwendung unter deiner Domain, das Zertifikat erneuert sich
selbst, und jede Nacht läuft eine Sicherung.

## Was du vorher brauchst

- Einen Server mit **Ubuntu 24.04**, mindestens 2 vCPU und 4 GB RAM.
  Empfehlung: Hetzner Cloud **CX22** (~4 €/Monat) oder **CX32** mit 8 GB, wenn
  du beim Bauen keinen Engpass willst. Bleib bei den x86-Servern (CX); für die
  ARM-Server (CAX) ist der Stack nicht erprobt.
- Eine **Domain**, z. B. `garagentor.dein-betrieb.de`.
- Einen **SSH-Schlüssel**. Falls du keinen hast, auf deinem Rechner:
  `ssh-keygen -t ed25519`. Den öffentlichen Teil (`~/.ssh/id_ed25519.pub`)
  hinterlegst du beim Anbieter, wenn du den Server bestellst.
- Den **Auftragsverarbeitungsvertrag** mit dem Anbieter. Bei Hetzner im
  Kundenkonto unter „Rechtliches“ abschließbar. Das gehört erledigt, _bevor_
  echte Kundendaten auf den Server kommen.

## 1. Domain auf den Server zeigen lassen

Beim Domain-Anbieter einen **A-Eintrag** anlegen, der auf die IPv4-Adresse des
Servers zeigt (bei IPv6 zusätzlich einen AAAA-Eintrag).

Vor dem nächsten Schritt prüfen, ob die Auflösung schon greift — von deinem
Rechner aus:

```bash
dig +short garagentor.dein-betrieb.de
```

Kommt die Server-IP zurück, kann es weitergehen. **Warte, bis das stimmt.**
Startest du die Anwendung vorher, scheitert die Zertifikatsausstellung, und
Let's Encrypt sperrt die Domain für eine Weile.

## 2. Grundeinrichtung des Servers

Als `root` einloggen und den ersten Schwung erledigen:

```bash
ssh root@<server-ip>

apt update && apt upgrade -y
timedatectl set-timezone Europe/Berlin

# Sicherheitsaktualisierungen automatisch einspielen
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### Arbeitsbenutzer anlegen

Nicht dauerhaft als `root` arbeiten:

```bash
adduser --disabled-password --gecos "" garagentor
mkdir -p /home/garagentor/.ssh
cp ~/.ssh/authorized_keys /home/garagentor/.ssh/
chown -R garagentor:garagentor /home/garagentor/.ssh
chmod 700 /home/garagentor/.ssh && chmod 600 /home/garagentor/.ssh/authorized_keys

# Verzeichnisse gleich hier anlegen und übereignen: der Benutzer hat bewusst
# kein Passwort und damit auch kein sudo – später braucht er dann keins.
mkdir -p /opt/garagentor /var/backups/garagentor
chown garagentor:garagentor /opt/garagentor /var/backups/garagentor
touch /var/log/garagentor-sicherung.log
chown garagentor:garagentor /var/log/garagentor-sicherung.log
```

Alles, was später Verwaltungsrechte braucht — Systemaktualisierungen etwa —
erledigst du weiterhin als `root` über eine eigene Sitzung.

### Firewall

**Reihenfolge beachten** — erst SSH freigeben, dann einschalten, sonst sperrst
du dich aus:

```bash
apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

### Auslagerungsdatei (nur bei 4 GB RAM)

Der Build der Oberfläche ist der speicherhungrigste Schritt. Auf einem Server
mit 4 GB gibst du ihm etwas Luft:

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```

## 3. Docker installieren

```bash
apt install -y docker.io docker-compose-v2 git
usermod -aG docker garagentor
systemctl enable --now docker
docker --version && docker compose version
```

Ab hier als Arbeitsbenutzer weiterarbeiten:

```bash
exit          # zurück auf den eigenen Rechner
ssh garagentor@<server-ip>
```

## 4. Repository holen

Ist das Repository privat, braucht der Server einen eigenen Lese-Zugang:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Den ausgegebenen Schlüssel auf GitHub unter **Settings → Deploy keys → Add deploy
key** eintragen, Schreibrechte _nicht_ vergeben. Danach:

```bash
git clone git@github.com:<konto>/<repository>.git /opt/garagentor
cd /opt/garagentor
```

## 5. Konfiguration anlegen

```bash
cp .env.prod.example .env.prod
chmod 600 .env.prod

# Zweimal ausführen – je ein Wert für die beiden JWT-Secrets
openssl rand -base64 48
# Und einmal für das Datenbankpasswort
openssl rand -base64 24

nano .env.prod
```

Auszufüllen sind:

| Eintrag                                    | Inhalt                                        |
| ------------------------------------------ | --------------------------------------------- |
| `DOMAIN`                                   | deine Domain, **ohne** `https://`             |
| `ACME_EMAIL`                               | Adresse für Ablaufwarnungen von Let's Encrypt |
| `POSTGRES_PASSWORD`                        | der eben erzeugte Zufallswert                 |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | zwei **verschiedene** Zufallswerte            |

Die Datei ist in `.gitignore` eingetragen und landet nicht im Repository. Lege
dir die Werte trotzdem in deinem Passwortmanager ab.

## 6. Starten

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Der erste Durchlauf dauert einige Minuten, weil vier Images gebaut werden. Der
Dienst `migrate` läuft einmal durch und legt das Datenbankschema an, danach
starten Anwendung und Reverse Proxy.

Zustand prüfen:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs caddy | tail -20
```

Alle Dienste außer `migrate` sollten laufen; `migrate` steht auf `Exited (0)` –
das ist richtig so.

## 7. Ersten Zugang anlegen

Die Anwendung hat bewusst keine Selbstregistrierung. Ohne diesen Schritt kommt
niemand hinein:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm \
  -e ADMIN_EMAIL=chefin@dein-betrieb.de \
  -e ADMIN_PASSWORD='ein-langes-passwort' \
  -e ADMIN_FIRST_NAME=Katrin -e ADMIN_LAST_NAME=Weber \
  migrate npm run db:admin --workspace @garagentor/api
```

Das Passwort braucht mindestens zwölf Zeichen. Derselbe Aufruf setzt es später
zurück, falls es verloren geht — dabei enden alle offenen Sitzungen des Kontos.

Jetzt `https://garagentor.dein-betrieb.de` im Browser öffnen und anmelden.

> **Demodaten:** Für eine Vorführung kannst du den Beispielbetrieb einspielen mit
> `… run --rm migrate npm run db:seed --workspace @garagentor/api`.
> Für den Echtbetrieb **nicht** ausführen — er legt erfundene Kunden, Anlagen und
> Belege an.

## 8. Sicherung einrichten

```bash
# Einmal von Hand ausführen und das Ergebnis ansehen
ZIEL=/var/backups/garagentor /opt/garagentor/deploy/sicherung.sh
ls -lh /var/backups/garagentor/*/
```

Läuft das durch, in den Zeitplan aufnehmen (`crontab -e`):

```
0 2 * * *  ZIEL=/var/backups/garagentor /opt/garagentor/deploy/sicherung.sh >> /var/log/garagentor-sicherung.log 2>&1
```

Das Skript legt Datenbankauszug, Dokumentenablage und Prüfsummen tagesweise ab
und entfernt Stände, die älter als 30 Tage sind (`AUFBEWAHRUNG_TAGE` ändert das).

### Die Sicherung vom Server wegholen

**Eine Sicherung, die nur auf demselben Server liegt, ist keine.** Stirbt die
Maschine, ist beides weg. Wähle einen Weg:

- **Auf deinen Rechner ziehen** (dort einrichten, nicht auf dem Server):

  ```bash
  rsync -avz --delete garagentor@<server-ip>:/var/backups/garagentor/ ~/Garagentor-Sicherungen/
  ```

  Zeigt das Zielverzeichnis in iCloud Drive, ist die Kopie gleich mit gesichert.

- **Hetzner Storage Box** (ab ~4 €/Monat), direkt vom Server per `rsync` oder
  `borg`.

Beides gilt: Eine synchronisierte Kopie ist eine _Ausfallsicherung_, keine
revisionssichere Ablage. Wie die Aufbewahrung der Rechnungen nach GoBD abgedeckt
wird, klärst du mit deiner Steuerberatung.

### Rückspielen

```bash
cd /opt/garagentor
docker compose -f docker-compose.prod.yml --env-file .env.prod stop api web
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_restore -U garagentor -d garagentor --clean --if-exists --no-owner \
  < /var/backups/garagentor/<stand>/datenbank.dump
docker compose -f docker-compose.prod.yml --env-file .env.prod start api web
```

Probiere das einmal aus, solange noch keine echten Daten drauf sind. Eine
Sicherung, die nie zurückgespielt wurde, ist eine Vermutung.

## Laufender Betrieb

**Neuen Stand einspielen:**

```bash
cd /opt/garagentor
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Migrationen laufen dabei automatisch mit. Die Volumes bleiben unangetastet — die
Daten überstehen jedes Deployment.

**Monatliche Pflege:** `apt upgrade` als `root`, ein Blick in
`/var/log/garagentor-sicherung.log`, und `docker system prune -f` gegen
vollaufende Platten. Etwa eine halbe Stunde im Monat.

## Wenn etwas klemmt

**Kein Zertifikat, Browser meldet einen Fehler.** In die Protokolle sehen:
`docker compose -f docker-compose.prod.yml --env-file .env.prod logs caddy`.
Fast immer zeigt die Domain noch nicht auf den Server oder Port 80 ist zu.
Beides prüfen, dann `restart caddy`.

**Der Build bricht mit `Killed` ab.** Zu wenig Arbeitsspeicher — die
Auslagerungsdatei aus Schritt 2 anlegen oder auf 8 GB wechseln.

**Anmeldung schlägt fehl, obwohl das Passwort stimmt.** Prüfen, ob `.env.prod`
zwischenzeitlich geändert wurde: ein neues `JWT_REFRESH_SECRET` entwertet alle
Sitzungen. Neu anmelden genügt.

**`P1000: Authentication failed`.** Das Datenbankpasswort in `.env.prod` wurde
nach dem ersten Start geändert. PostgreSQL übernimmt es nicht nachträglich —
entweder den alten Wert wieder eintragen oder das Passwort in der Datenbank
selbst ändern.

**Alles vergessen?** `docker compose … logs -f` zeigt, was die Dienste sagen.

## Checkliste

- [ ] Server bestellt, SSH-Schlüssel hinterlegt, AV-Vertrag abgeschlossen
- [ ] A-Eintrag gesetzt, `dig` liefert die Server-IP
- [ ] System aktualisiert, Zeitzone gesetzt, automatische Updates aktiv
- [ ] Arbeitsbenutzer angelegt, Firewall aktiv (22, 80, 443)
- [ ] Auslagerungsdatei angelegt (bei 4 GB RAM)
- [ ] Docker installiert, Repository geklont
- [ ] `.env.prod` ausgefüllt, Rechte auf 600, Werte im Passwortmanager
- [ ] Stack gestartet, alle Dienste laufen, `migrate` auf `Exited (0)`
- [ ] Erster Administrator angelegt, Anmeldung im Browser geprüft
- [ ] Sicherung von Hand gelaufen, Cron-Eintrag gesetzt
- [ ] Sicherung wird vom Server weggeholt
- [ ] Rückspielen einmal geprobt

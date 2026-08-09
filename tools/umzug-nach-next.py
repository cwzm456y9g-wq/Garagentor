#!/usr/bin/env python3
"""Holt die Fachlogik aus der NestJS-Anwendung nach Next.js.

Die Verzeichnisstruktur wird gespiegelt. Dadurch bleiben die Querverweise
zwischen den Diensten (`../customers/customers.service`) gültig und nur die
Infrastruktur-Importe müssen umgebogen werden.

Was hier passiert, ist bewusst mechanisch: Dekorator weg, Konstruktor weg,
`this.prisma` wird `prisma`. Die Rechenlogik selbst wird nicht angefasst.
"""

import pathlib
import re
import shutil
import sys

QUELLE = pathlib.Path('apps/api/src')
ZIEL = pathlib.Path('apps/web/src/server/dienste')

# Wird eigenständig ersetzt, nicht mitgenommen.
UEBERSPRINGEN = {
    'main.ts',
    'app.module.ts',
    'prisma/prisma.service.ts',
    'prisma/prisma.module.ts',
    'common/dto/pagination.dto.ts',
    'common/audit/request-context.ts',
    'common/audit/request-context.interceptor.ts',
    'config/configuration.ts',
    'customers/dto/customer-name.validator.ts',
}

# Die eingespritzten Dienste und der Name, unter dem sie künftig importiert werden.
EINSPRITZUNGEN = {
    'prisma': None,  # Sonderfall: kommt aus @/server/prisma
    'config': None,  # Sonderfall: NestJS' ConfigService entfällt ersatzlos
    'numbers': ('NumberRangeService', 'numbers', 'common/numbering/number-range.service'),
    'customers': ('CustomersService', 'customers', 'customers/customers.service'),
    'doors': ('DoorsService', 'doors', 'doors/doors.service'),
    'audit': ('AuditService', 'audit', 'common/audit/audit.service'),
    'pdf': ('PdfService', 'pdf', 'pdf/pdf.service'),
    'documents': ('DocumentsService', 'documents', 'documents/documents.service'),
    'articles': ('ArticlesService', 'articles', 'inventory/articles.service'),
}


# Anpassungen, die sich nicht aus einer Regel ergeben, aber jeden Lauf
# überstehen müssen.
NACHBESSERUNGEN: dict[str, list[tuple[str, str]]] = {
    'documents/documents.service.ts': [
        # Multer gibt es in Next.js nicht; die Felder heißen bewusst weiter so,
        # damit die Prüfungen im Dienst unverändert bleiben.
        (
            'async upload(file: Express.Multer.File,',
            'async upload(file: HochgeladeneDatei,',
        ),
        (
            '/** Zulässige Dateitypen der Dokumentenablage. */',
            """/**
 * Eine hochgeladene Datei, unabhängig davon, wer sie entgegennimmt.
 *
 * Vorher kam sie von Multer aus Express. Next.js liefert stattdessen ein
 * `File` aus `request.formData()`.
 */
export interface HochgeladeneDatei {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Zulässige Dateitypen der Dokumentenablage. */""",
        ),
        # Konfiguration erst beim Zugriff lesen: Next.js lädt jede Route schon
        # während `next build`. Als Feld bräuchte der Bau die Produktivgeheimnisse.
        (
            """  private readonly config = konfiguration();
  private readonly uploadRoot = resolve(this.config.uploads.dir);""",
            """  private get config() {
    return konfiguration();
  }

  private get uploadRoot(): string {
    return resolve(this.config.uploads.dir);
  }""",
        ),
    ],
    'auth/users.service.ts': [
        (
            "import { prisma } from '@/server/prisma';",
            "import { prisma } from '@/server/prisma';\n"
            "import { alleSitzungenBeenden, passwortHashen } from '../anmeldedienst';",
        ),
        ('auth.hashPassword(', 'passwortHashen('),
        ('auth.revokeAllForUser(', 'alleSitzungenBeenden('),
    ],
}


# Reine Helfer ohne DTO-Bezug, die modulübergreifend gebraucht werden.
EXTRA_DATEIEN = {'invoices/invoice-status.ts', 'auth/users.service.ts'}


def unbenutzte_importe_entfernen(text: str) -> str:
    """Räumt Namen weg, die erst durch den Abbau des Konstruktors verwaisen.

    Ein Dienst importierte `NumberRangeService` nur für die Typangabe im
    Konstruktor. Ohne Konstruktor bleibt ein toter Import zurück, und
    `noUnusedLocals` lässt das zu Recht nicht durchgehen.
    """
    def pruefe(m: re.Match) -> str:
        vorn, namen, quelle = m.group(1), m.group(2), m.group(3)
        rumpf = re.sub(r"^import .*?;$", '', text, flags=re.M)
        behalten = []
        for eintrag in (n.strip() for n in namen.split(',')):
            if not eintrag:
                continue
            bezeichner = eintrag.split(' as ')[-1].strip().removeprefix('type ').strip()
            if re.search(rf'\b{re.escape(bezeichner)}\b', rumpf):
                behalten.append(eintrag)
        if not behalten:
            return ''
        return f"{vorn}{{ {', '.join(behalten)} }} from '{quelle}';"

    return re.sub(r"(import (?:type )?)\{([^}]+)\} from '([^']+)';", pruefe, text)


def relativ(von: pathlib.Path, nach: str) -> str:
    """Relativer Importpfad von einer Datei zu einem Modul im gespiegelten Baum."""
    ziel = ZIEL / nach
    pfad = pathlib.posixpath.relpath(ziel.as_posix(), von.parent.as_posix())
    return pfad if pfad.startswith('.') else './' + pfad


def konstruktor_ausbauen(text: str) -> tuple[str, list[str]]:
    """Entfernt den Konstruktor und meldet, welche Dienste er eingespritzt hat."""
    treffer = re.search(r'\n  constructor\((.*?)\) \{\s*\}\n', text, re.S)
    if not treffer:
        return text, []

    eingespritzt = re.findall(r'private readonly (\w+):', treffer.group(1))
    return text[: treffer.start()] + '\n' + text[treffer.end() :], eingespritzt


def umschreiben(pfad: pathlib.Path, text: str) -> str:
    zielpfad = ZIEL / pfad
    noetig: set[str] = set()

    text, eingespritzt = konstruktor_ausbauen(text)

    # `this.prisma` wird zu `prisma` – aber nur für tatsächlich eingespritzte
    # Namen, damit eigene Felder wie `this.logger` unberührt bleiben.
    for name in eingespritzt:
        text = re.sub(rf'\bthis\.{name}\b', name, text)
        noetig.add(name)

    text = re.sub(
        r"config\.getOrThrow<AppConfig\['(\w+)'\]>\('\w+'\)",
        r'konfiguration().\1',
        text,
    )
    text = re.sub(r"AppConfig\['(\w+)'\]", r"Konfiguration['\1']", text)
    text = re.sub(r'\bloadConfiguration\b', 'konfiguration', text)

    # Der Dekorator entfällt ersatzlos.
    text = re.sub(r'\n?@Injectable\(\)\n', '\n', text)

    # PrismaService taucht auch als Typ auf (etwa in Union-Typen).
    text = re.sub(r'\bPrismaService\b', 'PrismaClient', text)

    zeilen_vorn: list[str] = []

    def import_ersetzen(m: re.Match) -> str:
        namen, quelle = m.group(1), m.group(2)
        liste = [n.strip() for n in namen.split(',') if n.strip()]

        if quelle == '@nestjs/common':
            behalten = [n for n in liste if n not in {'Injectable', 'Inject'}]
            if not behalten:
                return ''
            return f"import {{ {', '.join(behalten)} }} from '@/server/nest-ersatz';"

        if quelle.endswith('prisma/prisma.service'):
            return ''  # der Client kommt jetzt aus dem Singleton

        if quelle.endswith('common/dto/pagination.dto'):
            return f"import {{ {', '.join(liste)} }} from '@/server/anfrage';"

        if quelle.endswith('request-context'):
            ersetzt = [n.replace('currentUserId', 'aktuelleBenutzerId as currentUserId') for n in liste]
            return f"import {{ {', '.join(ersetzt)} }} from '@/server/kontext';"

        if quelle == '@nestjs/config':
            return ''  # der ConfigService entfällt

        if quelle.endswith('config/configuration'):
            # `loadConfiguration` wurde oben schon in `konfiguration` umbenannt,
            # steht also bereits in der Liste – sonst stünde es doppelt da.
            weg = {'AppConfig', 'loadConfiguration', 'konfiguration', 'Konfiguration'}
            behalten = [n for n in liste if n not in weg]
            teile = ['konfiguration', 'type Konfiguration'] + behalten
            return f"import {{ {', '.join(teile)} }} from '@/server/konfiguration';"

        return m.group(0)

    text = re.sub(r"import (?:type )?\{([^}]+)\} from '([^']+)';", import_ersetzen, text)

    # PrismaClient als Typ braucht einen Import, wenn er noch vorkommt.
    if re.search(r'\bPrismaClient\b', text):
        zeilen_vorn.append("import type { PrismaClient } from '@prisma/client';")

    if 'prisma' in noetig:
        zeilen_vorn.append("import { prisma } from '@/server/prisma';")

    for name in sorted(noetig - {'prisma', 'config'}):
        eintrag = EINSPRITZUNGEN.get(name)
        if not eintrag:
            print(f'  ! unbekannte Einspritzung {name} in {pfad}', file=sys.stderr)
            continue
        _, singleton, modul = eintrag
        zeilen_vorn.append(f"import {{ {singleton} }} from '{relativ(zielpfad, modul)}';")

    if zeilen_vorn:
        text = '\n'.join(zeilen_vorn) + '\n' + text

    # Für jede Dienstklasse ein Singleton, das die frühere Einspritzung ersetzt.
    for klasse in re.findall(r'export class (\w+Service)\b', text):
        kurz = None
        for eintrag in EINSPRITZUNGEN.values():
            if eintrag and eintrag[0] == klasse:
                kurz = eintrag[1]
                break
        if kurz is None:
            kurz = klasse[0].lower() + klasse[1:]
        text = text.rstrip() + f'\n\nexport const {kurz} = new {klasse}();\n'

    for alt, neu in NACHBESSERUNGEN.get(pfad.as_posix(), []):
        text = text.replace(alt, neu)

    text = unbenutzte_importe_entfernen(text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text


def main() -> None:
    # Ohne Argumente: alles. Mit Argumenten: nur die genannten Module.
    module = sys.argv[1:]

    anzahl = 0
    for datei in sorted(QUELLE.rglob('*')):
        if not datei.is_file() or datei.suffix not in {'.ts', '.tsx'}:
            continue
        rel = datei.relative_to(QUELLE)
        name = rel.as_posix()

        if name in UEBERSPRINGEN:
            continue
        if name not in EXTRA_DATEIEN and (name.startswith('auth/') or name.startswith('health/')):
            continue
        if name.endswith(('.controller.ts', '.module.ts', '.spec.ts')):
            continue
        if '/filters/' in name or '/interceptors/' in name or '/guards/' in name:
            continue
        if '/strategies/' in name or '/decorators/' in name:
            continue
        if name.endswith('.dto.ts'):
            continue  # werden von Hand nach Zod übersetzt
        if module and name not in EXTRA_DATEIEN:
            if not any(name.startswith(m + '/') for m in module):
                continue

        ziel = ZIEL / rel
        ziel.parent.mkdir(parents=True, exist_ok=True)
        ziel.write_text(umschreiben(rel, datei.read_text()), encoding='utf-8')
        anzahl += 1

    print(f'{anzahl} Dateien übernommen')


if __name__ == '__main__':
    main()
